# Implementation Plan: F-02 Google SSO Авторизация

**Branch**: `002-google-sso-auth` | **Date**: 2026-05-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-google-sso-auth/spec.md`

## Summary

Реализовать вход через Google OAuth 2.0 с whitelist-проверкой по email, сессионное хранилище в PostgreSQL (TTL 7 дней), защиту всех маршрутов `/api/v1/*` middleware `ensureAuthenticated`, и минимальную server-rendered страницу входа.

**Существующая инфраструктура (F-01, не трогаем)**:
- `server/db/pool.js` — pg.Pool синглтон
- Таблицы `users` и `session` — созданы в миграции
- Все npm-зависимости установлены (express, passport, passport-google-oauth20, express-session, connect-pg-simple)
- `docker-compose.yml`, `.env.example`

**Новые файлы F-02**:
- `server/index.js` — точка входа
- `server/app.js` — Express + Passport + session
- `server/middleware/auth.js` — ensureAuthenticated
- `server/routes/auth.js` — OAuth маршруты + login page

**Новых миграций нет.**

## Technical Context

**Language/Version**: Node.js LTS (≥ 20) + Express 4.x

**Primary Dependencies** (уже установлены в F-01):
- `passport ^0.7.0`
- `passport-google-oauth20 ^2.0.0`
- `express-session ^1.18.1`
- `connect-pg-simple ^10.0.0`
- `express ^4.21.2`
- `dotenv ^16.5.0`

**Storage**: PostgreSQL 15+ — таблицы `users` и `session` (из F-01)

**Testing**: Ручная верификация через браузер и curl (по quickstart.md)

**Target Platform**: Linux/macOS сервер, Node.js process

**Project Type**: Web-service (backend API + минимальный HTML)

**Performance Goals**: SC-001 — вход за < 5 сек; SC-005 — logout за < 1 сек

**Constraints**: Session TTL = 7 дней; SESSION_SECRET ≥ 32 символа; secure cookies в production

**Scale/Scope**: 4 пользователя, внутренний инструмент

## Constitution Check

| Принцип | Статус | Комментарий |
|---------|--------|-------------|
| Простота прежде всего | ✅ | Passport.js стандартным образом, без лишних абстракций |
| Spec-First | ✅ | Следуем spec-kit порядку |
| Последовательность фич | ✅ | F-01 завершена (migrate + seed верифицированы) |
| YAGNI | ✅ | Только авторизация; user management — F-03+ |
| Node.js + Express | ✅ | |
| PostgreSQL | ✅ | Существующие таблицы users + session |
| Google OAuth 2.0 | ✅ | passport-google-oauth20 |
| Сессии (express-session + connect-pg-simple) | ✅ | tableName: 'session', maxAge: 7 дней |
| REST API `/api/v1/` | ✅ | Auth маршруты отдельно от API-префикса |

**Нарушений нет. Gate пройден.**

## Project Structure

### Documentation (this feature)

```text
specs/002-google-sso-auth/
├── plan.md              # Этот файл
├── research.md          # Технические решения D-01–D-06
├── data-model.md        # Описание User и Session (без новых таблиц)
├── quickstart.md        # Сценарии ручной верификации
├── contracts/
│   └── auth-routes.md   # Contract: GET /, /auth/google, /auth/logout
└── tasks.md             # Создаётся /speckit-tasks
```

### Source Code

```text
server/
  app.js                  # Express app: session + passport + routes — НОВЫЙ
  index.js                # Точка входа: dotenv + fail-fast + app.listen — НОВЫЙ
  middleware/
    auth.js               # ensureAuthenticated — НОВЫЙ
  routes/
    auth.js               # GET /, /auth/google, /auth/google/callback, /auth/logout — НОВЫЙ
  db/
    pool.js               # ✅ F-01 — не изменяется
    seed.js               # ✅ F-01 — не изменяется
  migrations/
    1748044800000_initial_schema.js  # ✅ F-01 — не изменяется
```

## Ключевые технические решения

Подробное обоснование в [research.md](research.md):

| ID | Решение |
|----|---------|
| D-01 | express-session: `resave: false`, `saveUninitialized: false`, `maxAge: 7 дней` |
| D-02 | GoogleStrategy: match по email.toLowerCase(), проверка `email_verified` |
| D-03 | deserializeUser: SELECT по id на каждый запрос (реализует FR-009) |
| D-04 | Fail-fast: проверка обязательных env vars при старте |
| D-05 | Login page: inline HTML в route handler, error via query param |
| D-06 | ensureAuthenticated: проверяет `req.isAuthenticated()`, возвращает 401 JSON |
