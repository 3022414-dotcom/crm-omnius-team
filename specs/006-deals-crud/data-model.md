# Data Model: Сделки (Deals)

**Feature**: F-06 | **Branch**: `006-deals-crud`

---

## Таблицы БД (существуют с F-01)

### deals

| Колонка | Тип | Constraints |
|---------|-----|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| title | VARCHAR NOT NULL | REQUIRED, trim, непустой |
| value | DECIMAL(15,2) | NULLABLE |
| stage | ENUM(lead/qualified/proposal/negotiation/won/lost) | NOT NULL DEFAULT 'lead' |
| close_date | DATE | NULLABLE |
| account_id | UUID FK → accounts(id) | NULLABLE, ON DELETE SET NULL |
| owner_id | UUID FK → users(id) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW(), триггер set_updated_at |

### deal_contacts

| Колонка | Тип | Constraints |
|---------|-----|-------------|
| deal_id | UUID FK → deals(id) | ON DELETE CASCADE |
| contact_id | UUID FK → contacts(id) | ON DELETE CASCADE |
| | | PRIMARY KEY (deal_id, contact_id) |

---

## Shapes — форматы ответов API

### Deal Object (в списке GET /deals)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Внедрение CRM",
  "value": "250000.00",
  "stage": "qualified",
  "close_date": "2026-09-30",
  "account_id": "uuid-or-null",
  "owner_id": "uuid",
  "account": { "id": "uuid", "name": "ООО Ромашка" },
  "owner": { "id": "uuid", "name": "Анастасия Стефанова" },
  "contacts_count": 2,
  "created_at": "2026-07-05T10:00:00.000Z",
  "updated_at": "2026-07-05T10:00:00.000Z"
}
```

Note: `account` = null если account_id = null; `owner` всегда присутствует.

### Deal Object (GET /deals/:id — полный с контактами)

```json
{
  "id": "uuid",
  "title": "Внедрение CRM",
  "value": "250000.00",
  "stage": "qualified",
  "close_date": "2026-09-30",
  "account_id": "uuid-or-null",
  "owner_id": "uuid",
  "account": { "id": "uuid", "name": "ООО Ромашка" },
  "owner": { "id": "uuid", "name": "Анастасия Стефанова" },
  "contacts": [
    { "id": "uuid", "first_name": "Иван", "last_name": "Петров", "photo_path": null }
  ],
  "created_at": "2026-07-05T10:00:00.000Z",
  "updated_at": "2026-07-05T10:00:00.000Z"
}
```

### Paginated List Envelope

```json
{
  "data": [ ...Deal Objects... ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

## Валидационные правила

| Поле | Правило |
|------|---------|
| title | NOT NULL, trim, непустой (400 если пустой) |
| stage (create) | Автоматически 'lead', игнорировать из body |
| stage (update) | Должен быть из VALID_STAGES (400 иначе) |
| value | Любое число ≥ 0 или null; DECIMAL хранит |
| close_date | Любая дата или null; ISO 8601 (YYYY-MM-DD) |
| account_id | Если передан — должен существовать в accounts (400 иначе); null допустимо |
| owner_id (update) | Если передан — должен существовать в users (400 иначе) |
| contact_id (link) | Должен существовать в contacts (400 иначе) |

---

## Константы

```js
const VALID_STAGES     = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const UPDATABLE_FIELDS = ['title', 'value', 'close_date', 'account_id', 'stage', 'owner_id'];
```

---

## Хранилище файлов

Deals не имеют файловых вложений (F-08 добавит attachments как отдельную фичу). `uploads/` не используется в F-06.

---

## Индексы (созданы в F-01)

- `deals.account_id` — FK index
- `deals.owner_id` — FK index
- `deals.stage` — для фильтрации
- `deal_contacts(deal_id, contact_id)` — composite PK = unique index
