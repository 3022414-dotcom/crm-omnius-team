# Data Model: Kanban-доска

**Feature**: F-10 Kanban-доска
**Date**: 2026-07-05

## Источники данных

Kanban — агрегация данных из существующих таблиц. **Новых таблиц нет.**

| Таблица | Роль |
|---------|------|
| `deals` | Основной источник: id, title, value, stage, close_date, account_id, owner_id, created_at |
| `accounts` | LEFT JOIN: name (nullable — сделка может быть без аккаунта) |
| `users` | JOIN: id, name (владелец сделки) |
| `deal_contacts` | LEFT JOIN: COUNT(contact_id) → contacts_count |

## Kanban Card Shape (ответ API)

```json
{
  "id": "uuid",
  "title": "string",
  "value": "decimal | null",
  "account": { "name": "string" } | null,
  "owner": { "id": "uuid", "name": "string" },
  "close_date": "date | null",
  "contacts_count": "integer"
}
```

**Правила:**
- `account` = `null` если `deals.account_id IS NULL`
- `value` = null если сделка создана без суммы
- `contacts_count` ≥ 0 (никогда null; LEFT JOIN + COUNT возвращает 0)
- Карточка НЕ содержит `owner_id`, `account_id`, `stage` (stage — ключ в объекте-ответе, не поле карточки), `created_at`, `updated_at`

## Kanban Board Response Shape

```json
{
  "lead":        [ { ...card }, { ...card } ],
  "qualified":   [ { ...card } ],
  "proposal":    [],
  "negotiation": [ { ...card } ],
  "won":         [],
  "lost":        []
}
```

**Правила:**
- Всегда 6 ключей — порядок: `lead → qualified → proposal → negotiation → won → lost`
- Карточки внутри каждой стадии отсортированы: `created_at DESC` (новые сверху)
- Пустые стадии = `[]`, не `null`

## SQL-запрос (getKanbanDeals)

```sql
SELECT
  d.id,
  d.title,
  d.value,
  d.stage,
  d.close_date,
  a.name        AS account_name,
  u.id          AS owner_id,
  u.name        AS owner_name,
  COUNT(dc.contact_id)::int AS contacts_count
FROM deals d
LEFT JOIN users u ON d.owner_id = u.id
LEFT JOIN accounts a ON d.account_id = a.id
LEFT JOIN deal_contacts dc ON dc.deal_id = d.id
WHERE ($1::uuid IS NULL OR d.owner_id = $1::uuid)
GROUP BY d.id, d.title, d.value, d.stage, d.close_date, a.name, u.id, u.name
ORDER BY d.created_at DESC
```

**Параметры**: `[$1 = owner_id | null]`

## updateDealStage — Request / Response

**Request body:**
```json
{ "stage": "qualified" }
```

**Response (200 — полный объект сделки):**
```json
{
  "id": "uuid",
  "title": "string",
  "value": "decimal | null",
  "stage": "qualified",
  "close_date": "date | null",
  "account": { "id": "uuid", "name": "string" } | null,
  "owner": { "id": "uuid", "name": "string" },
  "created_at": "timestamptz",
  "updated_at": "timestamptz"
}
```

*Формат ответа updateDealStage идентичен getDealById — полный объект сделки, не Kanban-карточка.*

## Валидация stage

```js
const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
// уже определён в dealsController.js — переиспользуется
```

- Отсутствующий `stage` → 400 Bad Request
- Невалидное значение → 400 Bad Request
- Несуществующая сделка → 404 Not Found
- Роль viewer → 403 Forbidden (middleware)

## Инварианты

- `deals.stage` всегда входит в `VALID_STAGES` (ограничение на уровне приложения, установлено в F-06)
- Смена `stage` не изменяет другие поля сделки
- `owner_id` фильтр принимает только валидный UUID; невалидный UUID → pg error → 500 (допустимо для MVP с 4 пользователями)
