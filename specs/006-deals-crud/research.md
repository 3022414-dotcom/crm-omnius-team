# Research: Сделки (Deals)

**Feature**: F-06 | **Branch**: `006-deals-crud` | **Date**: 2026-07-05

---

## D-01: LIST-запрос с JOIN и contacts_count

**Decision**: Один SQL-запрос с LEFT JOIN accounts, LEFT JOIN users, и скалярным субзапросом для contacts_count.

**Rationale**: Избегает N+1. contacts_count нужен для Kanban (F-10). Альтернатива (отдельный запрос для каждой сделки) неприемлема при paginated списке.

**Pattern**:
```sql
SELECT
  d.id, d.title, d.value, d.stage, d.close_date,
  d.account_id, d.owner_id, d.created_at, d.updated_at,
  a.name  AS account_name,
  u.name  AS owner_name,
  (SELECT COUNT(*) FROM deal_contacts dc WHERE dc.deal_id = d.id) AS contacts_count
FROM deals d
LEFT JOIN accounts a ON d.account_id = a.id
LEFT JOIN users   u ON d.owner_id   = u.id
WHERE
  ($1::text   IS NULL OR d.stage      = $1)
  AND ($2::uuid   IS NULL OR d.account_id = $2)
  AND ($3::uuid   IS NULL OR d.owner_id   = $3)
  AND ($4::text   IS NULL OR d.title ILIKE '%' || $4 || '%')
  AND ($5::date   IS NULL OR d.close_date >= $5::date)
  AND ($6::date   IS NULL OR d.close_date <= $6::date)
ORDER BY d.created_at DESC
LIMIT $7 OFFSET $8
```

**Response shape (list item)**:
```json
{
  "id": "uuid",
  "title": "Название сделки",
  "value": "150000.00",
  "stage": "qualified",
  "close_date": "2026-09-01",
  "account": { "id": "uuid", "name": "ООО Ромашка" },
  "owner":   { "id": "uuid", "name": "Анастасия Стефанова" },
  "contacts_count": 3,
  "created_at": "...",
  "updated_at": "..."
}
```

Note: `account` и `owner` — null, если account_id/owner_id = NULL.

---

## D-02: GET /deals/:id — объект со списком контактов

**Decision**: Два последовательных запроса: (1) SELECT deal с JOIN, (2) SELECT контакты через JOIN deal_contacts.

**Rationale**: JOIN с ARRAY_AGG мог бы объединить, но результат сложнее парсить в Node. Два простых запроса — понятнее и надёжнее (YAGNI).

**Pattern**:
```sql
-- Запрос 1: сделка
SELECT d.id, d.title, d.value, d.stage, d.close_date,
  d.account_id, d.owner_id, d.created_at, d.updated_at,
  a.id AS a_id, a.name AS a_name,
  u.id AS u_id, u.name AS u_name
FROM deals d
LEFT JOIN accounts a ON d.account_id = a.id
LEFT JOIN users   u ON d.owner_id   = u.id
WHERE d.id = $1;

-- Запрос 2: привязанные контакты
SELECT c.id, c.first_name, c.last_name, c.photo_path
FROM contacts c
JOIN deal_contacts dc ON c.id = dc.contact_id
WHERE dc.deal_id = $1;
```

**Response shape**:
```json
{
  "id": "uuid",
  "title": "...",
  "value": "150000.00",
  "stage": "qualified",
  "close_date": "2026-09-01",
  "account":  { "id": "uuid", "name": "ООО Ромашка" },
  "owner":    { "id": "uuid", "name": "Анастасия Стефанова" },
  "contacts": [
    { "id": "uuid", "first_name": "Иван", "last_name": "Иванов", "photo_path": null }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

---

## D-03: Partial update с динамическим SET-clause

**Decision**: Итерация по UPDATABLE_FIELDS, добавление только присутствующих в body полей — паттерн F-04/F-05.

```js
const UPDATABLE_FIELDS = ['title', 'value', 'close_date', 'account_id', 'stage', 'owner_id'];
const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

// Validation перед SET-clause:
if ('stage' in body && !VALID_STAGES.includes(body.stage))
  return res.status(400).json({ error: 'Bad Request', message: 'Невалидный stage' });
if ('title' in body && !body.title?.trim())
  return res.status(400).json({ error: 'Bad Request', message: 'title не может быть пустым' });

// Inline owner_id validation:
if ('owner_id' in body && body.owner_id) {
  const { rows } = await pool.query('SELECT id FROM users WHERE id=$1', [body.owner_id]);
  if (!rows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Пользователь не найден' });
}
```

**Alternatives considered**: throw-based validateOwnerId → отклонено, нет custom error handler → дало бы 500 (паттерн аналогичен D-04 из F-05 research.md).

---

## D-04: account_id inline validation

**Decision**: Паттерн идентичен F-04 и F-05 — inline SELECT перед INSERT/UPDATE.

```js
if (account_id) {
  const { rows } = await pool.query('SELECT id FROM accounts WHERE id=$1', [account_id]);
  if (!rows[0]) return res.status(400).json({ error: 'Bad Request', message: 'Аккаунт не найден' });
}
```

`account_id = null` — допустимо (сделка без аккаунта).

---

## D-05: Идемпотентная привязка контакта

**Decision**: `INSERT ... ON CONFLICT DO NOTHING`. Различаем 201 (новая связь) и 200 (дубликат) через `RETURNING deal_id`.

```js
const { rows } = await pool.query(
  'INSERT INTO deal_contacts (deal_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING deal_id',
  [dealId, contactId]
);
// rows.length === 1 → новая связь → 201
// rows.length === 0 → уже существует → 200
```

**Validation contact_id перед INSERT**:
```js
const { rows: c } = await pool.query('SELECT id FROM contacts WHERE id=$1', [contactId]);
if (!c[0]) return res.status(400).json({ error: 'Bad Request', message: 'Контакт не найден' });
```

---

## D-06: Идемпотентное отвязывание контакта

**Decision**: `DELETE FROM deal_contacts WHERE deal_id=$1 AND contact_id=$2` — всегда 204, даже если связи не было. Паттерн Edge Cases spec: «идемпотентно».

---

## D-07: Каскадное удаление сделки

**Decision**:
- `deal_contacts` — DB CASCADE (FK ON DELETE CASCADE на deal_id → уже в F-01 схеме)
- `notes`, `attachments`, `activities` — app-level DELETE (полиморфные, без FK)

**Pattern** (аналогично deleteContact из F-05, deleteAccount из F-04):
```js
await pool.query("DELETE FROM activities  WHERE entity_type='deal' AND entity_id=$1", [id]);
await pool.query("DELETE FROM attachments WHERE entity_type='deal' AND entity_id=$1", [id]);
await pool.query("DELETE FROM notes       WHERE entity_type='deal' AND entity_id=$1", [id]);
// Затем:
await pool.query("DELETE FROM deals WHERE id=$1", [id]);
// deal_contacts удаляется автоматически через DB CASCADE
```

**Note**: Порядок важен — сначала полиморфные таблицы, потом основная запись.

---

## D-08: Фильтрация по date range

**Decision**: `$5::date` и `$6::date` с NULL-guard позволяют опционально передавать date_from / date_to. PostgreSQL приведёт строку к DATE автоматически при CAST.

```js
const date_from = req.query.date_from || null;  // '2026-01-01' или null
const date_to   = req.query.date_to   || null;
```

Граничные значения включительно: `>=` и `<=`.

---

## D-09: Константы контроллера

```js
const VALID_STAGES     = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const UPDATABLE_FIELDS = ['title', 'value', 'close_date', 'account_id', 'stage', 'owner_id'];
```

`owner_id` отличается от F-04/F-05 — там owner_id не обновлялся. Для F-06 это явно разрешено (clarification Q2, вариант C).
