# Data Model: F-02 Google SSO Авторизация

## Важно: новых таблиц нет

F-02 **не создаёт новых таблиц** — все необходимые структуры данных реализованы в F-01.

---

## Существующие сущности (из F-01)

### User (таблица `users`)

Уже реализована в миграции `1748044800000_initial_schema.js`.

| Поле | Тип | Ограничение | Примечание |
|------|-----|-------------|------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| email | VARCHAR(255) | UNIQUE NOT NULL | Используется для whitelist-матчинга при OAuth |
| name | VARCHAR(255) | NOT NULL | |
| role | user_role ENUM | NOT NULL | admin / bdm / viewer |
| google_id | VARCHAR(255) | UNIQUE, NULLABLE | Заполняется при первом успешном входе (FR-007) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Обновляется триггером |

**Поведение в F-02**:
- При OAuth callback: `SELECT * FROM users WHERE email = $1` (lowercase)
- При первом входе: `UPDATE users SET google_id = $1 WHERE id = $2`
- При deserializeUser (каждый запрос): `SELECT * FROM users WHERE id = $1`

### Session (таблица `session`)

Уже реализована в миграции `1748044800000_initial_schema.js`. Управляется автоматически библиотекой connect-pg-simple.

| Поле | Тип | Ограничение | Примечание |
|------|-----|-------------|------------|
| sid | VARCHAR | PK | ID сессии (cookie) |
| sess | JSON | NOT NULL | Сериализованные данные сессии (user.id) |
| expire | TIMESTAMP(6) | NOT NULL | Время истечения: NOW() + 7 дней |

**Индекс**: `IDX_session_expire` на `session.expire` — уже создан в F-01.

**TTL**: 7 дней (maxAge = 604 800 000 мс). connect-pg-simple автоматически удаляет устаревшие записи по полю `expire`.

---

## Lifecycle сессии

```
[Анонимный запрос]
    → GET / (страница входа)
    → GET /auth/google (редирект на Google)
    → GET /auth/google/callback (OAuth callback)
        ├─ email_verified: false → redirect /?error=email_not_verified
        ├─ email не в users → redirect /?error=access_denied
        └─ email найден → CREATE session (sess={user.id}, expire=NOW()+7d)
                        → UPDATE users SET google_id IF NULL
                        → redirect /

[Авторизованный запрос]
    → express-session читает cookie → SELECT из session WHERE sid
    → Passport deserializeUser → SELECT из users WHERE id
        ├─ пользователь не найден → session инвалидируется → 401
        └─ пользователь найден → req.user = user → next()

[Выход]
    → GET /auth/logout
    → req.logout() → DELETE из session WHERE sid
    → redirect /
```
