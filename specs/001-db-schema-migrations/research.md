# Research: F-01 Схема данных и миграции

**Phase 0 output** | Date: 2026-05-24

## 1. ENUM-типы в node-pg-migrate

**Decision**: Создавать ENUM-типы через `pgm.createType()` до создания таблиц, которые их используют.

**Rationale**: node-pg-migrate оборачивает каждую миграцию в транзакцию. `pgm.createType()` генерирует `CREATE TYPE ... AS ENUM(...)`. При откате (`down`) — `pgm.dropType()` в обратном порядке (сначала таблицы, потом типы).

**ENUM-типы для F-01**:
| Имя типа | Значения |
|----------|---------|
| `user_role` | `admin`, `bdm`, `viewer` |
| `deal_stage` | `lead`, `qualified`, `proposal`, `negotiation`, `won`, `lost` |
| `entity_type` | `account`, `contact`, `deal` |
| `activity_type` | `call`, `email`, `meeting`, `task` |

**Alternatives considered**: Использовать VARCHAR с CHECK constraint — отклонено, т.к. ENUM обеспечивает лучшую документальность схемы и валидацию на уровне БД.

---

## 2. Триггер updated_at

**Decision**: Создать один раз через `pgm.sql()`, применить ко всем таблицам с `updated_at`.

**Rationale**: Одна функция `trigger_set_updated_at()` переиспользуется — нет дублирования. `pgm.sql()` позволяет вставить произвольный SQL в миграцию.

**Реализация**:
```sql
-- Функция (один раз)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер на каждую таблицу
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON <table_name>
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

**Таблицы с updated_at**: users, accounts, contacts, deals, notes, activities (6 таблиц; attachments и session — без updated_at).

**Alternatives considered**: Управлять `updated_at` в коде приложения — отклонено, т.к. это создаёт риск пропуска обновления при прямых SQL-запросах и нарушает принцип единственного источника правды.

---

## 3. Таблица сессий (session)

**Decision**: Создать таблицу `session` вручную в миграции, не полагаться на `store.sync()` connect-pg-simple.

**Rationale**: Явная миграция даёт полный контроль и воспроизводимость — любой разработчик видит полную схему в одном файле. `store.sync()` создаёт таблицу при старте сервера, что смешивает обязанности (деплой схемы ≠ запуск приложения).

**Схема session** (соответствует ожиданиям connect-pg-simple):
```sql
CREATE TABLE session (
  sid  VARCHAR      NOT NULL COLLATE "default",
  sess JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IDX_session_expire ON session (expire);
```

**Alternatives considered**: `store.sync()` — отклонено (см. выше).

---

## 4. Полиморфные ассоциации (notes, attachments, activities)

**Decision**: `entity_type` ENUM + `entity_id` UUID без FK-constraint, каскадное удаление через application/trigger logic не нужно — достаточно индекса.

**Rationale**: PostgreSQL не поддерживает FK на полиморфные ссылки. Ссылочная целостность обеспечивается логикой приложения (DELETE CASCADE вызывается явно при удалении entity). Составной индекс `(entity_type, entity_id)` обеспечивает скорость выборки.

**Alternatives considered**: Отдельные таблицы notes_for_accounts, notes_for_contacts и т.д. — отклонено как over-engineering для 4-пользовательской CRM.

---

## 5. Seed-скрипт

**Decision**: Отдельный файл `server/db/seed.js` (Node.js + pg), запускается через `npm run seed`.

**Rationale**: Отделён от миграций — seed можно запустить повторно без риска. Использует `INSERT ... ON CONFLICT (email) DO NOTHING` для идемпотентности.

**Участники команды (seed data)**:
| name | email | role |
|------|-------|------|
| Дмитрий Твердохлебов | dima@omnius.team | admin |
| Юлия Шевцова | shevtsova_julia@omnius.team | admin |
| Анастасия Стефанова | anastasia@omnius.team | bdm |
| Илья Болховский | ilya.bolkhovsky@gmail.com | viewer |

**Alternatives considered**: SQL-файл `seed.sql` через psql — возможен, но JS-скрипт удобнее (использует DATABASE_URL из .env автоматически без дополнительных флагов psql).

---

## 6. Порядок создания объектов в миграции

Порядок важен из-за зависимостей:

```
1. ENUM типы (user_role, deal_stage, entity_type, activity_type)
2. trigger_set_updated_at() функция
3. Таблица users          ← нет FK-зависимостей
4. Таблица accounts       ← FK → users
5. Таблица contacts       ← FK → users, accounts
6. Таблица deals          ← FK → users, accounts
7. Таблица deal_contacts  ← FK → deals, contacts
8. Таблица notes          ← FK → users (author_id)
9. Таблица attachments    ← FK → users (uploaded_by)
10. Таблица activities    ← FK → users (owner_id)
11. Таблица session       ← нет FK
12. Триггеры updated_at   ← на все таблицы с updated_at
13. Индексы               ← на все FK и поисковые поля
```

Порядок `down` — строго обратный (индексы → триггеры → session → activities → ... → users → ENUM типы).
