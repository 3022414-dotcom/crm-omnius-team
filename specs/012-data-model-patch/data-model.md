# Data Model: F-12 Data Model Patch

**Feature**: F-12 Data Model Patch  
**Date**: 2026-07-10  
**Principle**: Все изменения аддитивные — новые типы, новые столбцы. Никаких DROP COLUMN на существующих данных.

---

## Новые ENUM-типы (создаются в начале миграции)

| Тип | Значения | Используется в |
|-----|----------|----------------|
| `location_enum` | Russia, Belorussia, Kazakhstan, Armenia | accounts.location · contacts.location · deals.location |
| `industry_enum` | FinTech, MedTech, Agro, Oil and Gas, Commerce, HoReCa, Customer services, Production | accounts.industry · deals.project_domain |
| `account_type_enum` | Prospect, Client, Partner, Vendor | accounts.type |
| `account_size_enum` | 1-50, 51-200, 201-1000, 1000+ | accounts.size |
| `contact_source_enum` | Founder, Marketing, Organic, BizDev, Customer, Referral, Agent, Event, Employee | contacts.source |
| `preferred_communication_enum` | Telegram, WhatsApp, Email, LinkedIn | contacts.preferred_communication |
| `language_enum` | Russian, English | contacts.language |
| `deal_type_enum` | New Client, New Project with existing client, Upsale | deals.deal_type |
| `deal_source_enum` | Founder, Marketing, Organic, BizDev, Customer, Referral, Agent, Event, Tender Platforms, Employee | deals.source |
| `currency_enum` | RUB, EUR, USD | deals.currency |
| `deal_stage` (REPLACE) | lead, qualifying, discovery, proposal, closing, contract, won, lost | deals.stage |

> **Важно**: `deal_stage` пересоздаётся (не добавляется). Существующий тип дропается после миграции данных через временный столбец.
> `contact_source_enum` (9 значений) и `deal_source_enum` (10 значений, +Tender Platforms) — разные типы.

---

## Таблица: accounts (расширение)

### Изменённые столбцы

| Столбец | Было | Стало | Примечание |
|---------|------|-------|------------|
| `industry` | VARCHAR(255) | `industry_enum` NULL | Временный столбец + переименование. Все существующие значения → NULL |

### Новые столбцы

| Столбец | Тип | Nullable | Default | FR |
|---------|-----|----------|---------|-----|
| `type` | `account_type_enum` | YES | NULL | FR-001 |
| `location` | `location_enum` | YES | NULL | FR-002 |
| `size` | `account_size_enum` | YES | NULL | FR-004 |
| `is_target` | BOOLEAN | NO | FALSE | FR-005 |
| `account_storage` | VARCHAR(500) | YES | NULL | FR-006 |
| `account_manager_id` | UUID FK → users ON DELETE SET NULL | YES | NULL | FR-007 |

---

## Таблица: contacts (расширение)

### Изменённые столбцы

Нет изменений в существующих столбцах. Поле `email` остаётся без изменений (обратная совместимость).

### Новые столбцы

| Столбец | Тип | Nullable | Default | FR |
|---------|-----|----------|---------|-----|
| `telegram` | VARCHAR(255) | YES | NULL | FR-010 |
| `linkedin` | VARCHAR(500) | YES | NULL | FR-010 |
| `facebook` | VARCHAR(500) | YES | NULL | FR-010 |
| `email_corp` | VARCHAR(255) | YES | NULL (заполняется из email при миграции) | FR-011 |
| `email_personal` | VARCHAR(255) | YES | NULL | FR-012 |
| `location` | `location_enum` | YES | NULL | FR-013 |
| `language` | `language_enum` | YES | NULL | FR-014 |
| `preferred_communication` | `preferred_communication_enum` | YES | NULL | FR-015 |
| `birthday` | DATE | YES | NULL | FR-016 |
| `comments` | TEXT | YES | NULL | FR-017 |
| `source` | `contact_source_enum` | YES | NULL | FR-018 |

> **Примечание email_corp**: При миграции выполняется `UPDATE contacts SET email_corp = email` — данные копируются. Поле `email` остаётся в схеме и API.

---

## Таблица: deals (расширение)

### Изменённые столбцы

| Столбец | Было | Стало | Примечание |
|---------|------|-------|------------|
| `stage` | `deal_stage` (6 значений) | `deal_stage` (8 значений) | Пересоздание через временный столбец `stage_v2`. Маппинг: qualified→qualifying, negotiation→closing |

### Новые столбцы

| Столбец | Тип | Nullable | Default | FR |
|---------|-----|----------|---------|-----|
| `location` | `location_enum` | YES | NULL | FR-023 |
| `deal_type` | `deal_type_enum` | YES | NULL | FR-024 |
| `source` | `deal_source_enum` | YES | NULL | FR-025 |
| `project_domain` | `industry_enum` | YES | NULL | FR-026 |
| `description` | TEXT | YES | NULL | FR-027 |
| `our_services` | TEXT[] | YES | NULL | FR-028 |
| `deal_storage` | VARCHAR(500) | YES | NULL | FR-029 |
| `expected_start_date` | DATE | YES | NULL | FR-030 |
| `currency` | `currency_enum` | NO | 'RUB' | FR-031 |
| `lost_reason` | TEXT | YES | NULL | FR-032 |

> **Валидация lost_reason**: Не CHECK constraint на уровне БД. Реализуется в dealsController: при `stage = 'lost'` и пустом `lost_reason` — 400 Bad Request.

---

## Таблица: deal_contacts (расширение)

### Новые столбцы

| Столбец | Тип | Nullable | Default | FR |
|---------|-----|----------|---------|-----|
| `role` | VARCHAR(255) | YES | NULL | FR-037 |
| `comment` | TEXT | YES | NULL | FR-038 |

> PRIMARY KEY (deal_id, contact_id) — без изменений.

---

## Порядок операций в миграции

```
1. CREATE TYPE location_enum, industry_enum, account_type_enum, account_size_enum,
              contact_source_enum, preferred_communication_enum, language_enum,
              deal_type_enum, deal_source_enum, currency_enum

2. Миграция deal_stage (6→8):
   a. CREATE TYPE deal_stage_v2 AS ENUM (8 значений)
   b. ALTER TABLE deals ADD COLUMN stage_v2 deal_stage_v2
   c. UPDATE deals SET stage_v2 = CASE ... (маппинг)
   d. ALTER TABLE deals ALTER COLUMN stage_v2 SET NOT NULL
   e. ALTER TABLE deals ALTER COLUMN stage_v2 SET DEFAULT 'lead'
   f. ALTER TABLE deals DROP COLUMN stage
   g. ALTER TABLE deals RENAME COLUMN stage_v2 TO stage
   h. DROP TYPE deal_stage
   i. ALTER TYPE deal_stage_v2 RENAME TO deal_stage

3. Миграция accounts.industry (VARCHAR→ENUM):
   a. ALTER TABLE accounts ADD COLUMN industry_new industry_enum
   b. ALTER TABLE accounts DROP COLUMN industry
   c. ALTER TABLE accounts RENAME COLUMN industry_new TO industry

4. ADD COLUMN для accounts (type, location, size, is_target, account_storage, account_manager_id)

5. ADD COLUMN для contacts (telegram, linkedin, facebook, email_corp, email_personal,
                             location, language, preferred_communication, birthday, comments, source)
   + UPDATE contacts SET email_corp = email

6. ADD COLUMN для deals (location, deal_type, source, project_domain, description,
                          our_services, deal_storage, expected_start_date, currency, lost_reason)

7. ADD COLUMN для deal_contacts (role, comment)

8. ADD INDEX для новых FK: idx_accounts_account_manager_id
```

---

## Совместимость API

После миграции все существующие API-запросы продолжают работать без изменений:
- Новые поля nullable — не ломают INSERT без них
- Поле `email` у contacts остаётся — нет сломанных контрактов
- `stage` у deals принимает старые значения (их не осталось) — новые значения корректны

Контроллеры обновляются для чтения/записи новых полей, но сигнатуры эндпоинтов не меняются.
