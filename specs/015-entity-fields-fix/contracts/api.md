# API Contracts: Entity Field Fixes — F-15

## 1. GET /api/v1/deals/:id — расширение ответа

**Изменение**: добавляется поле `created_by` (non-breaking).

### Response (добавленное поле)

```json
{
  "id": "uuid",
  "title": "Deal Name",
  "value": 5000000,
  "stage": "proposal",
  "owner": { "id": "uuid", "name": "Юлия Шевцова" },
  "created_by": { "id": "uuid", "name": "Анастасия Стефанова" },
  "created_at": "2026-07-13T10:00:00.000Z",
  "..."
}
```

**Null case** (старые записи):
```json
{ "created_by": null }
```

**SQL change in getDealById**:
```sql
-- Добавить в SELECT:
cb.id AS created_by_id_val, cb.name AS created_by_name
-- Добавить JOIN:
LEFT JOIN users cb ON d.created_by_id = cb.id
```

**Response mapping**:
```js
created_by: row.created_by_id ? { id: row.created_by_id, name: row.created_by_name } : null
```

---

## 2. POST /api/v1/deals — изменение INSERT

**Изменение**: `created_by_id` добавляется в INSERT из `req.user.id`. Не принимается из тела запроса.

```sql
INSERT INTO deals (..., created_by_id) VALUES (..., $N)
-- $N = req.user.id
```

---

## 3. GET /api/v1/accounts/:id — расширение ответа

Аналогично deals: добавляется `created_by: { id, name } | null`.

**SQL change in getAccountById** (добавить в `ACCOUNT_WITH_COUNTS`):
```sql
cb.id AS created_by_uid, cb.name AS created_by_name
-- JOIN:
LEFT JOIN users cb ON a.created_by_id = cb.id
```

---

## 4. POST /api/v1/accounts — изменение INSERT

`created_by_id` добавляется из `req.user.id` в INSERT.

---

## 5. GET /api/v1/contacts/:id — расширение ответа

Аналогично: добавляется `created_by: { id, name } | null`.

---

## 6. POST /api/v1/contacts — изменение INSERT

`created_by_id` добавляется из `req.user.id` в INSERT.

---

## 7. GET /api/v1/users — снятие ограничения доступа

**Изменение**: убирается middleware `requireRole(['admin'])`.

**До**:
```js
router.get('/', requireRole(['admin']), listUsers);
```

**После**:
```js
router.get('/', listUsers);
```

Response shape не меняется. Эндпоинт по-прежнему требует аутентификации через глобальный middleware.
