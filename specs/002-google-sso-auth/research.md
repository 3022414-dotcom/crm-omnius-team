# Research: F-02 Google SSO Авторизация

## Контекст уже реализованного (F-01)

Следующее **уже существует** и переиспользуется — создавать заново не нужно:
- `server/db/pool.js` — синглтон pg.Pool
- Таблица `users` — email UNIQUE, google_id UNIQUE, role ENUM
- Таблица `session` — sid VARCHAR PK, sess JSON, expire TIMESTAMP(6)
- Индекс `IDX_session_expire` на session.expire
- Все зависимости в `package.json`: express, passport, passport-google-oauth20, express-session, connect-pg-simple, dotenv
- `docker-compose.yml` — PostgreSQL 15-alpine, контейнер omnius_crm_db
- `.env.example` — все переменные: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, SESSION_SECRET, DATABASE_URL, PORT

---

## D-01: Конфигурация express-session + connect-pg-simple

**Decision**: `cookie.maxAge = 7 * 24 * 60 * 60 * 1000` (604 800 000 мс = 7 дней); `resave: false`, `saveUninitialized: false`.

**Rationale**:
- `resave: false` — не пересохранять сессию при каждом запросе (снижает нагрузку на БД)
- `saveUninitialized: false` — не создавать пустые сессии для анонимных пользователей
- `maxAge: 7 days` — выбрано в ходе clarify (баланс безопасности и удобства)
- `tableName: 'session'` — таблица уже создана в F-01 миграции

**Конфигурация**:
```javascript
const PgSession = require('connect-pg-simple')(session);
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
```

**Alternatives considered**: Хранение сессий в памяти (MemoryStore) — отклонено, так как не переживает перезапуск сервера (SC-004).

---

## D-02: Passport.js GoogleStrategy — email-matching и обновление google_id

**Decision**: В verify-коллбэке стратегии: поиск пользователя по `email.toLowerCase()`, проверка `profile._json.email_verified`, обновление `google_id` если NULL.

**Rationale**:
- Email-матчинг (не google_id) — основа whitelist-модели: пользователи добавляются по email до первого входа
- `email_verified: false` → вход отклоняется (FR-008, edge case из all-features-mvp.md)
- `google_id` обновляется при первом успешном входе (FR-007) через `UPDATE users SET google_id = $1 WHERE id = $2`

**Паттерн**:
```javascript
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  if (!profile._json.email_verified) return done(null, false, { message: 'email_not_verified' });
  const email = profile.emails[0].value.toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!rows[0]) return done(null, false, { message: 'access_denied' });
  const user = rows[0];
  if (!user.google_id) {
    await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, user.id]);
    user.google_id = profile.id;
  }
  return done(null, user);
}));
```

**Alternatives considered**: Матчинг по google_id — отклонено, т.к. при первом входе google_id ещё неизвестен.

---

## D-03: serializeUser / deserializeUser — проверка существования пользователя (FR-009)

**Decision**: `deserializeUser` делает SELECT по `id` при каждом запросе. Если пользователь не найден — возвращает `false`, что инвалидирует сессию.

**Rationale**:
- FR-009: "система MUST инвалидировать сессию пользователя при следующем запросе, если пользователь удалён из таблицы users"
- При `done(null, false)` Passport помечает сессию как невалидную → `req.isAuthenticated()` вернёт false
- Для 4 пользователей дополнительный SELECT per-request не является проблемой производительности

**Паттерн**:
```javascript
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  done(null, rows[0] || false);
});
```

**Alternatives considered**: Кэширование пользователя только в сессии без DB-запроса — отклонено, т.к. нарушает FR-009.

---

## D-04: Fail-fast валидация конфигурации при старте

**Decision**: Проверять `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET` при старте сервера. Бросать ошибку если отсутствуют.

**Rationale**:
- Edge case из all-features-mvp.md: "сервер отказывается стартовать с понятным сообщением об ошибке конфигурации"
- Раннее обнаружение конфигурационных ошибок предотвращает запуск с сломанной авторизацией

**Паттерн**:
```javascript
const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'SESSION_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
```

---

## D-05: Страница входа — минимальный inline HTML

**Decision**: Маршрут `GET /` возвращает inline HTML с кнопкой "Войти через Google". Сообщение об ошибке передаётся через query-параметр `?error=`.

**Rationale**:
- Spec clarification Q2: "минимальная server-rendered HTML-страница с кнопкой" (без дизайна, только функциональность)
- Фронтенд не выбран до F-04 → никакого React/Next.js
- Inline HTML в роуте — проще всего, не требует template engine или static file serving
- При denied access callback редиректит на `/?error=access_denied`

**Паттерн ошибки**: `/auth/google/callback` при ошибке → `res.redirect('/?error=access_denied')`

---

## D-06: Middleware ensureAuthenticated

**Decision**: Простая функция-middleware, проверяющая `req.isAuthenticated()`. Для API-маршрутов возвращает JSON 401. Применяется ко всем маршрутам `/api/v1/*`.

**Rationale**:
- FR-004: "система MUST защищать все маршруты `/api/v1/*`, возвращая 401"
- Разделение: auth-маршруты (`/auth/*`) публичные; API-маршруты (`/api/v1/*`) защищены

```javascript
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
```

---

## D-07: Кастомный passport callback для различения ошибок аутентификации

**Decision**: Вместо стандартного `passport.authenticate('google', { failureRedirect: '...' })` использовать кастомный callback, чтобы различать причины отказа (`access_denied` vs `email_not_verified`).

**Rationale**:
- Стандартный `failureRedirect` не позволяет передать разные ошибки — все отказы идут на один URL
- Spec требует разные сообщения: "Доступ запрещён" (не в whitelist) vs "аккаунт не подтверждён" (email_verified: false)
- `info.message` из `done(null, false, { message: '...' })` доступен в кастомном callback

**Паттерн**:
```javascript
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const error = info?.message || 'access_denied';
      return res.redirect(`/?error=${encodeURIComponent(error)}`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.redirect('/');
    });
  })(req, res, next);
});
```

**Связь с D-02**: D-02 описывает verify-коллбэк GoogleStrategy, где выставляется `info.message`. D-07 описывает, как этот message используется в HTTP-слое для редиректа.

---

## Файловая структура F-02 (создаётся впервые)

```
server/
  app.js                    # Express app: session, passport, routes (без listen) — НОВЫЙ
  index.js                  # Точка входа: require('dotenv'), fail-fast check, app.listen — НОВЫЙ
  middleware/
    auth.js                 # ensureAuthenticated — НОВЫЙ
  routes/
    auth.js                 # GET /, GET /auth/google, GET /auth/google/callback, GET /auth/logout — НОВЫЙ
  db/
    pool.js                 # ✅ УЖЕ СУЩЕСТВУЕТ (F-01)
    seed.js                 # ✅ УЖЕ СУЩЕСТВУЕТ (F-01)
  migrations/
    1748044800000_initial_schema.js  # ✅ УЖЕ СУЩЕСТВУЕТ (F-01)
```

**Новых миграций не требуется** — таблицы `users` и `session` уже созданы в F-01.
