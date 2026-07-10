# Research: F-12 Data Model Patch

**Feature**: F-12 Data Model Patch  
**Date**: 2026-07-10

## Decision 1: Deal Stage ENUM Migration Strategy

**Decision**: Мигрировать `deal_stage` через временный VARCHAR-столбец — не через `ALTER TYPE ADD VALUE` и не через прямое переименование.

**Rationale**: PostgreSQL позволяет `ALTER TYPE ADD VALUE` (добавить значение в ENUM), но **не** позволяет переименовывать или удалять существующие значения. Нам нужно: переименовать `qualified` → `qualifying`, `negotiation` → `closing` и добавить `discovery`, `contract`. Единственный надёжный способ — пересоздать тип.

**Порядок операций**:
```sql
-- 1. Создать новый тип
CREATE TYPE deal_stage_v2 AS ENUM (
  'lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost'
);

-- 2. Добавить временный столбец
ALTER TABLE deals ADD COLUMN stage_v2 deal_stage_v2;

-- 3. Скопировать данные с маппингом
UPDATE deals SET stage_v2 = CASE
  WHEN stage::text = 'qualified'   THEN 'qualifying'::deal_stage_v2
  WHEN stage::text = 'negotiation' THEN 'closing'::deal_stage_v2
  ELSE stage::text::deal_stage_v2
END;

-- 4. Установить NOT NULL и DEFAULT на новом столбце
ALTER TABLE deals ALTER COLUMN stage_v2 SET NOT NULL;
ALTER TABLE deals ALTER COLUMN stage_v2 SET DEFAULT 'lead';

-- 5. Дропнуть старый столбец
ALTER TABLE deals DROP COLUMN stage;

-- 6. Переименовать новый
ALTER TABLE deals RENAME COLUMN stage_v2 TO stage;

-- 7. Удалить старый тип (ПОСЛЕ удаления столбца)
DROP TYPE deal_stage;

-- 8. Переименовать новый тип (опционально, для единообразия)
ALTER TYPE deal_stage_v2 RENAME TO deal_stage;
```

В node-pg-migrate всё вышеперечисленное реализуется через `pgm.sql()` блоки внутри одного файла миграции.

**Alternatives considered**:
- `ALTER TYPE deal_stage ADD VALUE` — не подходит, т.к. нельзя переименовать `qualified` → `qualifying`
- Прямой `USING` cast при ALTER COLUMN TYPE — не работает для переименования значений ENUM
- Дропнуть и пересоздать таблицу — потеря данных, неприемлемо

---

## Decision 2: Industry VARCHAR → ENUM Migration Strategy

**Decision**: SET NULL для всех существующих значений — без маппинга.

**Rationale**: Поле `industry` в accounts сейчас VARCHAR(255). Нужно привести к `industry_enum`. Поскольку существующие данные могут быть произвольными строками (не совпадающими со значениями ENUM), было решено (FR-003, clarification Q2) обнулить все текущие значения. Admin вручную проставит отрасли после миграции.

**Порядок операций**:
```sql
-- 1. ENUM уже создан (location_enum из Step 1 в плане миграции)
-- industry_enum создаётся на шаге создания ENUM типов

-- 2. Добавить временный столбец с ENUM-типом
ALTER TABLE accounts ADD COLUMN industry_new industry_enum;
-- industry_new = NULL для всех существующих строк (это то, что нам нужно)

-- 3. Дропнуть старый столбец
ALTER TABLE accounts DROP COLUMN industry;

-- 4. Переименовать
ALTER TABLE accounts RENAME COLUMN industry_new TO industry;
```

Альтернатива через USING не работает напрямую (нельзя cast произвольного VARCHAR в ENUM без явного маппинга), поэтому ADD COLUMN + RENAME — самый чистый подход.

**Alternatives considered**:
- Маппинг по строке (ILIKE) — сложен, ненадёжен при опечатках, Юлия решила не делать
- `ALTER COLUMN industry TYPE industry_enum USING NULL::industry_enum` — технически работает, но менее читаемо

---

## Decision 3: Shared ENUM Types Across Tables

**Decision**: `location_enum` и `industry_enum` создаются один раз в начале миграции и переиспользуются во всех таблицах.

**Rationale**: PostgreSQL поддерживает переиспользование пользовательских типов. Создание в начале транзакции миграции гарантирует доступность для всех последующих ADD COLUMN операций в той же миграции.

**Типы и где используются**:
- `location_enum` → accounts.location, contacts.location, deals.location
- `industry_enum` → accounts.industry, deals.project_domain

**Implementation note**: В node-pg-migrate `pgm.createType()` создаёт тип, `pgm.sql()` позволяет использовать raw SQL. Порядок важен — ENUM создаётся до таблиц/колонок, которые его используют.

---

## Decision 4: TEXT[] для our_services

**Decision**: `our_services TEXT[]` — нативный PostgreSQL массив без отдельной таблицы.

**Rationale**: Для 4 пользователей и десятков сделок нет смысла создавать отдельную junction таблицу. TEXT[] в PostgreSQL полностью поддерживается через `pg` драйвер (возвращается как JavaScript array). Валидация допустимых значений — только на уровне UI (не CHECK constraint на уровне БД), что соответствует принципу Simplicity из конституции.

**В миграции**:
```sql
ALTER TABLE deals ADD COLUMN our_services TEXT[];
```

**В API**: поле принимается как `["Workshop", "Consulting"]` в JSON-теле запроса и сохраняется в PG как массив через pg parameterized query.

---

## Decision 5: Migration File Naming

**Decision**: Один файл миграции `1783641600000_f12_data_model_patch.js` содержит все изменения F-12.

**Rationale**: Существующий паттерн в проекте — один большой файл (см. `1748044800000_initial_schema.js`). Единый файл атомарен: либо вся F-12 применяется, либо нет. Разбивка на отдельные файлы добавила бы сложность без выгоды для команды из 4 человек.

**Timestamp**: `1783641600000` = 2026-07-10T00:00:00Z — позже initial schema (1748044800000 = 2025-05-23T20:48:00Z).

---

## Decision 6: deal_contacts Extension

**Decision**: Простое `ADD COLUMN` без изменения PRIMARY KEY или структуры таблицы.

**Rationale**: `deal_contacts` имеет составной PK (deal_id, contact_id). Добавление nullable VARCHAR и TEXT не нарушает PK и не требует пересоздания таблицы.

```sql
ALTER TABLE deal_contacts ADD COLUMN role    VARCHAR(255);
ALTER TABLE deal_contacts ADD COLUMN comment TEXT;
```

---

## Decision 7: Backend — Подход к обновлению контроллеров

**Decision**: Обновить строковые константы полей (`ACCOUNT_FIELDS`, аналоги для contacts/deals) и WHERE-условия без рефакторинга архитектуры.

**Rationale**: Конституция запрещает избыточные абстракции. Добавить поля в константу и в INSERT/UPDATE параметры — самый прямолинейный путь. Никакого ORM, никаких builders.

Для `lost_reason` — добавить валидацию в `createDeal` и `updateDeal`:
```js
if (stage === 'lost' && !lost_reason?.trim()) {
  return res.status(400).json({ error: 'lost_reason обязателен при stage = lost' });
}
```
