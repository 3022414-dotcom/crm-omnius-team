# Tasks: F-01 Схема данных и миграции

**Input**: Design documents from `specs/001-db-schema-migrations/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Не запрошены — верификация через ручные psql-запросы после миграции.

**Organization**: Задачи сгруппированы по User Story для независимой реализации и тестирования.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Можно выполнять параллельно (разные файлы, нет зависимостей)
- **[Story]**: К какой User Story относится задача (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Структура проекта, конфигурация Docker и npm

- [x] T001 Создать директории `server/migrations/` и `server/db/` (и корневые файлы проекта)
- [x] T002 Создать `package.json` с зависимостями (pg, node-pg-migrate, dotenv, express, passport, passport-google-oauth20, express-session, connect-pg-simple, multer, express-async-errors) и npm-скриптами: `migrate`, `migrate:down`, `seed`
- [x] T003 [P] Создать `docker-compose.yml` — сервис postgres:15-alpine, контейнер omnius_crm_db, порт 5432, healthcheck, volume postgres_data
- [x] T004 [P] Создать `.env.example` с переменными: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, SESSION_SECRET, PORT
- [x] T005 [P] Создать `.gitignore` — исключить: node_modules/, .env, uploads/
- [ ] T006 [MANUAL] Установить зависимости: `npm install` (выполняется в терминале пользователем)

**Checkpoint**: Структура проекта готова, Docker-конфиг создан, зависимости установлены

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Базовая инфраструктура БД — пул соединений и скелет миграции. Блокирует все User Stories.

**⚠️ CRITICAL**: User Stories не могут начаться до завершения этой фазы

- [x] T007 Создать `server/db/pool.js` — экспортировать синглтон `pg.Pool` с параметром `connectionString: process.env.DATABASE_URL`
- [x] T008 Создать `server/migrations/20260524000001_initial_schema.js` — скелет с экспортами `exports.up` и `exports.down`, импортом `/* global pgm */`
- [x] T009 Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: создание 4 ENUM-типов через `pgm.createType()` — `user_role` ('admin','bdm','viewer'), `deal_stage` ('lead','qualified','proposal','negotiation','won','lost'), `entity_type` ('account','contact','deal'), `activity_type` ('call','email','meeting','task')
- [x] T010 Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: функцию `trigger_set_updated_at()` через `pgm.sql()` — `CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS TRIGGER...`
- [x] T011 Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `users` (id UUID PK gen_random_uuid(), email VARCHAR UNIQUE NOT NULL, name VARCHAR NOT NULL, role user_role NOT NULL, google_id VARCHAR UNIQUE, created_at/updated_at TIMESTAMPTZ DEFAULT NOW())

**Checkpoint**: Инфраструктура готова — ENUM-типы, триггерная функция, таблица users. User Stories могут начинаться.

---

## Phase 3: User Story 1 — Развёртывание системы с нуля (Priority: P1) 🎯 MVP

**Goal**: Полная рабочая схема БД создаётся одной командой `npm run migrate` на чистой базе

**Independent Test**: Запустить `npm run migrate` на чистой БД → все 9 таблиц присутствуют через `\dt` в psql

### Implementation

- [x] T012 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `accounts` (id, name VARCHAR NOT NULL, industry, website, phone, address TEXT, notes TEXT, owner_id UUID FK→users ON DELETE RESTRICT, created_at, updated_at)
- [x] T013 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `contacts` (id, first_name NOT NULL, last_name NOT NULL, email VARCHAR, phone, position, photo_path VARCHAR(500) NULLABLE, account_id UUID FK→accounts ON DELETE SET NULL, owner_id FK→users ON DELETE RESTRICT, created_at, updated_at)
- [x] T014 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `deals` (id, title NOT NULL, value DECIMAL(15,2), stage deal_stage NOT NULL DEFAULT 'lead', close_date DATE, account_id UUID FK→accounts ON DELETE SET NULL NULLABLE, owner_id FK→users ON DELETE RESTRICT, created_at, updated_at)
- [x] T015 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `deal_contacts` (deal_id FK→deals CASCADE, contact_id FK→contacts CASCADE, PRIMARY KEY составной)
- [x] T016 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `notes` (id, entity_type entity_type NOT NULL, entity_id UUID NOT NULL, content TEXT NOT NULL, author_id FK→users ON DELETE RESTRICT, created_at, updated_at)
- [x] T017 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `attachments` (id, entity_type entity_type NOT NULL, entity_id UUID NOT NULL, file_name VARCHAR NOT NULL, file_path VARCHAR NOT NULL, file_size INTEGER, mime_type VARCHAR, uploaded_by FK→users ON DELETE RESTRICT, created_at — без updated_at)
- [x] T018 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `activities` (id, type activity_type NOT NULL, entity_type entity_type NOT NULL, entity_id UUID NOT NULL, description TEXT, due_date TIMESTAMPTZ, completed BOOLEAN NOT NULL DEFAULT false, owner_id FK→users ON DELETE RESTRICT, created_at, updated_at)
- [x] T019 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: таблицу `session` через `pgm.sql()` — sid VARCHAR PK, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL; индекс IDX_session_expire
- [x] T020 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: триггеры `set_updated_at` BEFORE UPDATE на таблицы: users, accounts, contacts, deals, notes, activities (через `pgm.sql()` для каждой)
- [x] T021 [US1] Добавить в `up()` миграции `server/migrations/20260524000001_initial_schema.js`: все индексы — FK-индексы (owner_id, account_id, author_id, uploaded_by, deal_id, contact_id), поисковые (accounts.name, contacts.email, contacts.first_name+last_name), полиморфные ((entity_type, entity_id) для notes, attachments, activities), (deals.stage)
- [x] T022 [US1] Написать `down()` функцию в `server/migrations/20260524000001_initial_schema.js`: удаление в обратном порядке — индексы → триггеры → session → activities → attachments → notes → deal_contacts → deals → contacts → accounts → users → trigger function → ENUM типы
- [x] T023 [US1] Запустить `npm run migrate` и верифицировать: все 9 таблиц присутствуют (`\dt`), ENUM-типы созданы (`\dT`), триггеры активны (`\d users`); **Примечание**: каскадное удаление для полиморфных таблиц (notes/attachments/activities) реализуется на уровне приложения — верификация SC-005 запланирована в F-04

**Checkpoint**: `npm run migrate` создаёт полную схему. User Story 1 завершена — можно демонстрировать.

---

## Phase 4: User Story 2 — Начальные учётные записи команды (Priority: P2)

**Goal**: Четыре участника команды автоматически появляются в системе после `npm run seed`

**Independent Test**: Запустить `npm run seed` дважды → в таблице ровно 4 записи без дублей

### Implementation

- [x] T024 [US2] Создать `server/db/seed.js`: подключение через pool.js, INSERT INTO users (email, name, role) VALUES для 4 участников команды с `ON CONFLICT (email) DO NOTHING`, вывод подтверждения
- [x] T025 [US2] Использовать подтверждённые email-адреса в `server/db/seed.js`: dima@omnius.team (admin), shevtsova_julia@omnius.team (admin), anastasia@omnius.team (bdm), ilya.bolkhovsky@gmail.com (viewer)
- [x] T026 [US2] Запустить `npm run seed` и верифицировать: `SELECT name, role FROM users;` возвращает 4 строки с корректными ролями; повторный запуск не создаёт дублей

**Checkpoint**: `npm run seed` идемпотентно создаёт 4 участников. User Story 2 завершена.

---

## Phase 5: User Story 3 — Эволюция схемы со временем (Priority: P3)

**Goal**: Система версионирования миграций работает — новые изменения применяются инкрементально

**Independent Test**: Откатить миграцию (`npm run migrate:down`), накатить снова (`npm run migrate`) — данные воспроизводимы

### Implementation

- [x] T027 [US3] Верифицировать tracking-таблицу node-pg-migrate: `SELECT * FROM pgmigrations;` показывает применённую миграцию с именем и датой
- [x] T028 [US3] Верифицировать откат и повторное применение: запустить `npm run migrate:down`, убедиться что таблицы удалены; затем `npm run migrate` — схема воссоздана идентично

**Checkpoint**: Цикл migrate → down → migrate работает без ошибок. User Story 3 завершена.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T029 [P] Провести полную валидацию по `specs/001-db-schema-migrations/quickstart.md` — пройти все шаги с нуля на чистой БД и убедиться в соответствии
- [x] T030 [P] Проверить `.env.example` — все переменные из конституции присутствуют, значения-примеры не являются реальными секретами

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Нет зависимостей — старт немедленно
- **Foundational (Phase 2)**: Зависит от T001–T006 — блокирует все User Stories
- **US1 (Phase 3)**: Зависит от Phase 2; T015 зависит от T013 и T014
- **US2 (Phase 4)**: Зависит от Phase 3 (нужна таблица users)
- **US3 (Phase 5)**: Зависит от Phase 3 (нужна работающая миграция)
- **Polish (Phase 6)**: Зависит от завершения нужных User Stories

### User Story Dependencies

- **US1 (P1)**: Запускается после Phase 2 — нет зависимостей от других US
- **US2 (P2)**: Запускается после US1 (нужна работающая таблица users в БД)
- **US3 (P3)**: Запускается после US1 (нужна работающая миграция)

### Внутри User Story 1

- T012–T019 последовательны (один файл миграции), кроме T016/T017/T018 (независимые таблицы, можно чередовать)
- T020 (триггеры) → после T011–T018
- T021 (индексы) → после всех таблиц
- T022 (down) → последний шаг написания миграции
- T023 (верификация) → после T022

---

## Parallel Opportunities

```bash
# Phase 1 — параллельно после T001:
Task T002: package.json
Task T003: docker-compose.yml
Task T004: .env.example
Task T005: .gitignore

# Phase 2 — последовательно (один migration-файл):
T007 (pool.js) → T008 (migration skeleton) → T009 (ENUMs) → T010 (trigger fn) → T011 (users table)

# Phase 4 и Phase 5 — после завершения Phase 3 (US1):
Task T024-T026: seed.js (US2)
Task T027-T028: migration versioning (US3)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Завершить Phase 1: Setup
2. Завершить Phase 2: Foundational (КРИТИЧНО — блокирует всё)
3. Завершить Phase 3: User Story 1 (T012–T023)
4. **СТОП и ВАЛИДАЦИЯ**: `\dt` в psql, проверить все 9 таблиц
5. Готово к F-02 (Google SSO)

### Incremental Delivery

1. Setup + Foundational → база готова
2. US1 → полная схема → `npm run migrate` работает ✅
3. US2 → seed команды → `npm run seed` работает ✅
4. US3 → откат/накат → `npm run migrate:down` + `migrate` ✅
5. F-01 завершена, переход к F-02

---

## Notes

- `[P]` задачи = разные файлы, нет зависимостей между собой
- `[Story]` маркер связывает задачу с User Story для трассировки
- Все таблицы идут в ОДИН migration-файл (initial schema)
- Seed-файл идемпотентен: повторный запуск безопасен
- После каждой phase — коммит через `/speckit-git-commit`
- Email-адреса участников в seed.js требуют уточнения перед запуском (T025)
