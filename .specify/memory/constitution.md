# omnius.team CRM Constitution

## I. Принципы разработки

### Простота прежде всего
Это внутренний инструмент для команды 4 человека. Архитектурные усложнения, паттерны корпоративного масштаба и преждевременные абстракции запрещены. Если задачу можно решить проще — решаем проще.

### Spec-First (NON-NEGOTIABLE)
Каждая фича начинается со спецификации через spec-kit. Порядок: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Прямая реализация без спецификации запрещена.

### Последовательность фич
Порядок разработки строго соблюдается: F-01 → F-02 → F-03 → F-04 → F-05 → F-06 → F-07 → F-08 → F-09 → F-10 → F-11. Фича не начинается до завершения всех зависимостей.

### YAGNI
Ничего из бэклога без явного запроса. Никаких фич "на будущее". Никакого over-engineering.

## II. Технологический стек

### Backend
- **Runtime**: Node.js (LTS)
- **Framework**: Express
- **Package manager**: npm

### База данных
- **СУБД**: PostgreSQL 15+
- **Запуск**: Docker (образ postgres:15-alpine, контейнер omnius_crm_db)
- **Миграции**: node-pg-migrate (файлы в `server/migrations/`)
- **Драйвер**: pg

### Авторизация и сессии
- **Auth**: Google OAuth 2.0 через Passport.js + passport-google-oauth20
- **Сессии**: express-session + connect-pg-simple (хранение в таблице session в PostgreSQL)
- **Доступ только для pre-approved пользователей**: аккаунт должен существовать в таблице users (email-матчинг)

### Загрузка файлов
- **Библиотека**: multer ^2.0.0
- **Хранение**: локальная файловая система (папка uploads/)
- **Contact photo path**: `uploads/contacts/{id}/avatar_{uuid}.ext`

### Deploy
- Docker + docker-compose

### Frontend (не выбран)
Next.js или React+Vite — зафиксировать до F-04. До выбора — только backend API.

## III. Соглашения по БД

### Первичные ключи
UUID v4 для всех таблиц. Тип: `UUID DEFAULT gen_random_uuid()`.

### Временны́е метки
- Тип: `TIMESTAMPTZ` (всегда с timezone)
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()` — обновляется PostgreSQL-триггером автоматически

### Триггеры updated_at
Каждая таблица с `updated_at` получает триггер `set_updated_at` на `BEFORE UPDATE`. Функция триггера создаётся один раз и переиспользуется.

### Схема таблиц MVP

**users** — участники команды (pre-approved list):
- id (UUID PK), email (VARCHAR UNIQUE NOT NULL), name (VARCHAR NOT NULL)
- role (ENUM: admin/bdm/viewer), google_id (VARCHAR UNIQUE)
- created_at, updated_at

**accounts** — компании/организации:
- id (UUID PK), name (VARCHAR NOT NULL), industry (VARCHAR), website (VARCHAR)
- phone (VARCHAR), address (TEXT), notes (TEXT)
- owner_id (UUID FK → users), created_at, updated_at

**contacts** — контактные лица:
- id (UUID PK), first_name (VARCHAR NOT NULL), last_name (VARCHAR NOT NULL)
- email (VARCHAR), phone (VARCHAR), position (VARCHAR)
- photo_path (VARCHAR(500), NULLABLE) — путь к файлу аватара
- account_id (UUID FK → accounts, ON DELETE SET NULL)
- owner_id (UUID FK → users), created_at, updated_at

**deals** — сделки:
- id (UUID PK), title (VARCHAR NOT NULL), value (DECIMAL(15,2))
- stage (ENUM: lead/qualified/proposal/negotiation/won/lost)
- close_date (DATE), account_id (UUID FK → accounts, NULLABLE — сделка без аккаунта допустима)
- owner_id (UUID FK → users), created_at, updated_at

**deal_contacts** — связь сделок и контактов (M:N):
- deal_id (UUID FK → deals), contact_id (UUID FK → contacts)
- PRIMARY KEY (deal_id, contact_id)

**notes** — заметки (полиморфные):
- id (UUID PK), entity_type (ENUM: account/contact/deal)
- entity_id (UUID NOT NULL), content (TEXT NOT NULL)
- author_id (UUID FK → users), created_at, updated_at

**attachments** — вложения (полиморфные):
- id (UUID PK), entity_type (ENUM: account/contact/deal)
- entity_id (UUID NOT NULL), file_name (VARCHAR NOT NULL)
- file_path (VARCHAR NOT NULL), file_size (INTEGER), mime_type (VARCHAR)
- uploaded_by (UUID FK → users), created_at

**activities** — история действий:
- id (UUID PK), type (ENUM: call/email/meeting/task)
- entity_type (ENUM: account/contact/deal), entity_id (UUID NOT NULL)
- description (TEXT), due_date (TIMESTAMPTZ), completed (BOOLEAN DEFAULT FALSE)
- owner_id (UUID FK → users), created_at, updated_at

**session** — Express-сессии (создаётся connect-pg-simple):
- sid (VARCHAR PK), sess (JSON NOT NULL), expire (TIMESTAMP NOT NULL)

### Полиморфные ассоциации
Notes и Attachments используют `entity_type` + `entity_id` для связи с accounts, contacts, deals. Индекс по (entity_type, entity_id) обязателен.

### Contact photo — ОТДЕЛЬНЫЙ механизм
Фото контакта хранится в `contacts.photo_path` и управляется через `POST /api/v1/contacts/:id/photo`. Это НЕ вложение — не попадает в таблицу attachments.

### Каскадное удаление и поведение FK
- `contacts.account_id` → `ON DELETE SET NULL` (контакт без аккаунта допустим)
- `deals.account_id` → `ON DELETE SET NULL` (сделка без аккаунта допустима)
- `notes`, `attachments`, `activities` → `ON DELETE CASCADE` по entity (удаляются вместе с родителем)
- `deal_contacts` → `ON DELETE CASCADE` по обоим FK (при удалении сделки или контакта)
- UI обязан предупреждать пользователя перед деструктивными операциями.

### Индексы
Все FK-колонки индексируются. Дополнительные индексы на поисковые поля: name, email, entity_type+entity_id.

## IV. Соглашения по коду

### Структура проекта
```
server/
  app.js          — Express app (без listen)
  index.js        — точка входа (listen)
  routes/         — роуты по доменам
  controllers/    — обработчики запросов
  middleware/     — auth, roles, upload и т.д.
  migrations/     — node-pg-migrate файлы
  db/
    pool.js       — pg Pool
    seed.sql      — начальные данные (команда)
uploads/          — загружаемые файлы (gitignored)
specs/            — spec-kit спецификации
```

### API
- REST API, prefix `/api/v1/`
- JSON request/response
- HTTP-статусы: 200/201/204/400/401/403/404/500

### Роли и доступ
- **admin**: полный доступ (CRUD всего)
- **bdm**: чтение + создание/редактирование аккаунтов, контактов, сделок, заметок, вложений, активностей
- **viewer**: только чтение

### Переменные окружения
Все секреты через `.env` (gitignored). Пример в `.env.example`.

Обязательные переменные:
- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `SESSION_SECRET`
- `PORT` (default: 3000)

## V. Git-воркфлоу

- Одна ветка на фичу, создаётся spec-kit хуком автоматически
- Ветки: `NNN-short-name` (sequential numbering, 001, 002, ...)
- Коммиты в процессе работы — через spec-kit хуки
- Merge в main после `/speckit-implement` и проверки

## Governance

Эта конституция главнее любых других соглашений. Изменения вносятся только после согласования с Admin (Юлия Шевцова или Дмитрий Твердохлебов).

**Version**: 1.0 | **Ratified**: 2026-05-20 | **Last Amended**: 2026-05-20
