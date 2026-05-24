# Tasks: F-02 Google SSO Авторизация

**Input**: Design documents from `specs/002-google-sso-auth/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Не запрошены — верификация через ручные проверки в браузере и psql.

**Organization**: Задачи сгруппированы по User Story для независимой реализации и тестирования.

**Из F-01 (не трогаем)**: `server/db/pool.js`, таблицы `users`/`session`, все npm-зависимости, `docker-compose.yml`, `.env.example`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Можно выполнять параллельно (разные файлы, нет зависимостей)
- **[Story]**: К какой User Story относится задача (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Создать директории для новых модулей

- [x] T001 Создать директории `server/routes/` и `server/middleware/` (необходимы для F-02 и всех последующих фич)

**Checkpoint**: Структура директорий готова

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Четыре новых файла, от которых зависят все три User Story. **Все остальные фазы блокированы до завершения этой.**

- [x] T002 [P] Создать `server/middleware/auth.js` — функция `ensureAuthenticated(req, res, next)`: если `req.isAuthenticated()` → `next()`; иначе → `res.status(401).json({ error: 'Unauthorized' })`. Экспортировать: `module.exports = { ensureAuthenticated }`.
- [x] T003 [P] Создать `server/routes/auth.js` — Express Router с маршрутами: `GET /` (inline HTML страница входа с кнопкой "Войти через Google"; при `?error=access_denied` показывает "Доступ запрещён. Обратитесь к администратору.", при `?error=email_not_verified` показывает "Google-аккаунт не подтверждён."); `GET /auth/google` → `passport.authenticate('google', { scope: ['profile', 'email'] })`; `GET /auth/google/callback` → кастомный passport callback (см. research.md D-07) для различения ошибок `access_denied` и `email_not_verified`; `GET /auth/logout` → `req.logout(callback)` + `res.redirect('/')`. Экспортировать: `module.exports = router`.
- [x] T004 Создать `server/app.js` — Express app (без listen): **dotenv не вызывать** — index.js загружает его первым до `require('./app')`; подключить `pool` из `./db/pool`, настроить `express-session` с `connect-pg-simple` (`tableName: 'session'`, `maxAge: 7 * 24 * 60 * 60 * 1000`, `httpOnly: true`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`, `resave: false`, `saveUninitialized: false`), зарегистрировать `passport.use(new GoogleStrategy(...))` (email.toLowerCase() матчинг, проверка `profile._json.email_verified`, UPDATE google_id если NULL), `passport.serializeUser` (сохранять `user.id`), `passport.deserializeUser` (SELECT по id, `done(null, false)` если не найден — реализует FR-009), `passport.initialize()`, `passport.session()`, защита `/api/v1/*` через `ensureAuthenticated`, роутер auth на `/`. Экспортировать: `module.exports = app`.
- [x] T005 Создать `server/index.js` — точка входа: `require('dotenv').config()`, fail-fast валидация обязательных переменных (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`) — `throw new Error('Missing required env vars: ...')` если хоть одна отсутствует, затем `const app = require('./app')`, `app.listen(process.env.PORT || 3000, ...)`.

**Checkpoint**: Все 4 файла созданы, `npm run dev` стартует без ошибок (при наличии `.env` с корректными credentials)

---

## Phase 3: User Story 1 — Вход в систему (Priority: P1) 🎯 MVP

**Goal**: Зарегистрированный участник команды входит в CRM через Google OAuth; незарегистрированный получает понятный отказ; неавторизованные запросы к `/api/v1/*` → 401

**Independent Test**: Запустить `npm run dev`, открыть браузер → войти под `shevtsova_julia@omnius.team` → попасть в CRM; попробовать войти с посторонним аккаунтом → получить "Доступ запрещён"; `curl /api/v1/ping` без cookie → 401

### Implementation

- [x] T006 [US1] [MANUAL] Верифицировать US1 по сценариям из `specs/002-google-sso-auth/quickstart.md`:
  - Сценарий 1: вход зарегистрированного пользователя → сессия в БД (`SELECT sid FROM session`), `google_id` обновлён (`SELECT google_id FROM users`)
  - Сценарий 2: вход незарегистрированного → `/?error=access_denied`, сообщение на странице, 0 строк в session
  - Сценарий 3: `curl -i http://localhost:3000/api/v1/ping` → `HTTP/1.1 401`, `{"error":"Unauthorized"}`

**Checkpoint**: User Story 1 завершена — вход работает, whitelist-защита работает, маршруты защищены.

---

## Phase 4: User Story 2 — Выход из системы (Priority: P2)

**Goal**: Авторизованный пользователь завершает сессию; сессия удаляется из PostgreSQL; повторный запрос к `/api/v1/*` → 401

**Independent Test**: Войти → `GET /auth/logout` → `SELECT COUNT(*) FROM session` = 0; повторный запрос к `/api/v1/ping` → 401

### Implementation

- [x] T007 [US2] [MANUAL] Верифицировать US2 по сценариям из `specs/002-google-sso-auth/quickstart.md`:
  - Войти (US1 Сценарий 1)
  - Перейти на `http://localhost:3000/auth/logout`
  - Убедиться: редирект на `/`, страница входа
  - В psql: `SELECT COUNT(*) FROM session;` → 0
  - `curl -i http://localhost:3000/api/v1/ping` (с тем же cookie) → 401

**Checkpoint**: User Story 2 завершена — logout уничтожает сессию.

---

## Phase 5: User Story 3 — Сохранение сессии между перезапусками (Priority: P3)

**Goal**: Сессии хранятся в PostgreSQL; перезапуск сервера не разлогинивает пользователей; удалённый из users пользователь инвалидируется при следующем запросе

**Independent Test**: Войти → `Ctrl+C` → `npm run dev` → запрос с тем же cookie → не 401

### Implementation

- [x] T008 [US3] [MANUAL] Верифицировать US3 и edge cases по `specs/002-google-sso-auth/quickstart.md`:
  - Войти → перезапустить сервер → обратиться к `/api/v1/ping` с тем же cookie → успех (не 401)
  - Edge case: войти под Ilya → `DELETE FROM users WHERE email = 'ilya.bolkhovsky@gmail.com'` → запрос к `/api/v1/ping` → 401 (deserializeUser вернул false)
  - После теста: `npm run seed` для восстановления пользователя

**Checkpoint**: User Story 3 завершена — сессии переживают перезапуск; удалённые пользователи инвалидируются.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T009 [P] Верифицировать fail-fast: убрать `SESSION_SECRET` из `.env` → `npm start` → сервер должен упасть с сообщением `Missing required env vars: SESSION_SECRET`; вернуть значение после теста
- [ ] T010 [P] Верифицировать что все 4 участника команды (`dima@omnius.team`, `shevtsova_julia@omnius.team`, `anastasia@omnius.team`, `ilya.bolkhovsky@gmail.com`) могут успешно войти в систему через Google OAuth — отложено, выполнить при следующей совместной сессии команды

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: Нет зависимостей
- **Phase 2 (Foundational)**: Зависит от T001 — блокирует все User Stories
- **US1 (Phase 3)**: Зависит от Phase 2 (все 4 файла должны существовать)
- **US2 (Phase 4)**: Зависит от US1 (выход тестируется после успешного входа)
- **US3 (Phase 5)**: Зависит от US1 (перезапуск тестируется после входа)
- **Polish (Phase 6)**: Зависит от всех US

### Внутри Phase 2

```
T001 (dirs) → T002 [P] (middleware/auth.js) ┐
              T003 [P] (routes/auth.js)       ├→ T004 (app.js) → T005 (index.js)
```

T002 и T003 не зависят друг от друга — разные файлы, можно писать параллельно.

---

## Parallel Opportunities

```bash
# Phase 2 — параллельно:
T002: server/middleware/auth.js
T003: server/routes/auth.js

# Phase 6 — параллельно:
T009: fail-fast verification
T010: all 4 users login test
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Завершить Phase 1 + Phase 2: создать 4 файла
2. **СТОП и ВАЛИДАЦИЯ**: `npm run dev` стартует без ошибок
3. Завершить Phase 3 (US1): верификация входа/whitelist/401
4. **СТОП**: вход работает → F-03 может начинаться

### Incremental Delivery

1. Setup + Foundational → сервер запускается ✅
2. US1 → вход + защита маршрутов ✅
3. US2 → выход ✅
4. US3 → персистентность сессий ✅
5. Polish → fail-fast + все пользователи ✅

---

## Notes

- `[P]` задачи = разные файлы, нет зависимостей между собой
- `[MANUAL]` верификационные задачи выполняются вручную в браузере/psql/curl
- `server/db/pool.js` из F-01 переиспользуется напрямую — не изменяется
- Новых миграций нет — таблицы `users` и `session` уже существуют
- После `/speckit-implement` — коммит через `/speckit-git-commit`
