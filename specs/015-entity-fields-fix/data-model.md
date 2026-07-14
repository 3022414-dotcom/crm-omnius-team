# Data Model: Entity Field Fixes — Deal, Contact, Account

**Feature**: F-15 | **Branch**: `015-entity-fields-fix` | **Date**: 2026-07-13

## Schema Changes

### New column: deals.created_by_id

```sql
ALTER TABLE deals ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_deals_created_by_id ON deals(created_by_id);
```

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| created_by_id | UUID | YES | NULL | FK → users(id), ON DELETE SET NULL |

**Behavior**:
- SET on INSERT: `req.user.id` (server-side, not from client)
- Existing records: NULL → отображается как «—»
- NOT in UPDATABLE_FIELDS (read-only after creation)

### New column: accounts.created_by_id

```sql
ALTER TABLE accounts ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_accounts_created_by_id ON accounts(created_by_id);
```

Идентичная структура и поведение.

### New column: contacts.created_by_id

```sql
ALTER TABLE contacts ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_contacts_created_by_id ON contacts(created_by_id);
```

Идентичная структура и поведение.

## API Response Shape Changes

### GET /api/v1/deals/:id (non-breaking extension)

До:
```json
{ "id": "...", "owner": { "id": "...", "name": "..." }, ... }
```

После:
```json
{
  "id": "...",
  "owner": { "id": "...", "name": "..." },
  "created_by": { "id": "...", "name": "..." },
  ...
}
```

При `created_by_id = NULL`: `"created_by": null`

### GET /api/v1/accounts/:id (non-breaking extension)

Аналогично: добавляется `created_by: { id, name } | null`

### GET /api/v1/contacts/:id (non-breaking extension)

Аналогично: добавляется `created_by: { id, name } | null`

### GET /api/v1/users (access change)

- Было: доступен только `role = admin`
- Стало: доступен всем аутентифицированным пользователям
- Response shape: не изменяется

## Frontend Data Mapping

### DealDetailPage.jsx — поле Amount (DB column: `value`)

| DB column | UI label | Format | Edit mode |
|-----------|----------|--------|-----------|
| `value` | Amount | `5 000 000` (decimal, ru-RU) | Raw number input |

### Константа OUR_SERVICES

До: `['AI Consulting', 'AI Outsource', 'AI Outstaff', 'AI Course', 'AI Product']`  
После: `['Workshop', 'Webinar', 'Consulting', 'POC', 'Development', 'Accelerator', 'Performance']`

### Новые read-only поля (все три сущности)

| Field | Source | Display | Nullable behavior |
|-------|--------|---------|-------------------|
| Created By | `entity.created_by?.name` | String | `'—'` if null |
| Created Date | `deal.created_at` (deals only) | `formatDate(deal.created_at)` | never null |

### Deal Owner (существующее поле, новый UI)

| DB column | Current state | After F-15 |
|-----------|---------------|------------|
| `owner_id` | Не отображается в карточке | InlineField type="select" из getUsers |

## Entities — без изменений

Все существующие FK, индексы, CASCADE/SET NULL политики для `notes`, `attachments`, `activities` остаются без изменений.
