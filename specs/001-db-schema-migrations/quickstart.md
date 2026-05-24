# Quickstart: F-01 Схема данных и миграции

## Предварительные требования

- Docker Desktop запущен
- Node.js v22+ установлен (`node -v`)
- npm установлен (`npm -v`)
- Файл `.env` создан на основе `.env.example`

## Шаги

### 1. Создать .env

```bash
cp .env.example .env
# Заполнить GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
# DATABASE_URL уже настроен для локального Docker
```

### 2. Запустить PostgreSQL

```bash
docker compose up -d
# Ждём healthy: docker compose ps
```

### 3. Установить зависимости

```bash
npm install
```

### 4. Применить миграции

```bash
npm run migrate
# Ожидаемый вывод: Migrations complete!
```

### 5. Заполнить начальные данные

```bash
npm run seed
# Ожидаемый вывод: Seeded 4 users
```

### 6. Проверить схему

```bash
docker exec -it omnius_crm_db psql -U omnius -d omnius_crm -c "\dt"
# Должны появиться: users, accounts, contacts, deals, deal_contacts,
#                   notes, attachments, activities, session
```

## npm-скрипты

| Скрипт | Команда | Описание |
|--------|---------|----------|
| `npm run migrate` | node-pg-migrate up | Применить все новые миграции |
| `npm run migrate:down` | node-pg-migrate down | Откатить последнюю миграцию |
| `npm run seed` | node server/db/seed.js | Добавить команду (идемпотентно) |

## Переменные окружения

| Переменная | Пример | Обязательна |
|-----------|--------|-------------|
| DATABASE_URL | postgresql://omnius:omnius_secret@localhost:5432/omnius_crm | ✅ |
| GOOGLE_CLIENT_ID | 123456.apps.googleusercontent.com | ✅ (нужна для F-02) |
| GOOGLE_CLIENT_SECRET | GOCSPX-... | ✅ (нужна для F-02) |
| GOOGLE_CALLBACK_URL | http://localhost:3000/auth/google/callback | ✅ (нужна для F-02) |
| SESSION_SECRET | min-32-chars-random-string | ✅ (нужна для F-02) |
| PORT | 3000 | ➖ (default: 3000) |

## Откат

```bash
npm run migrate:down
# Откатывает последнюю миграцию, удаляет все таблицы
```
