# API Contracts: UI Bug Fixes & Deal Channel Field — F-17

Only item 4 (Deal Channel) touches the API. Items 1–3 are frontend-only and have no API contract changes.

## 1. GET /api/v1/deals/:id — расширение ответа

**Изменение**: добавляется поле `deal_channel` (non-breaking).

### Response (добавленное поле)

```json
{
  "id": "uuid",
  "title": "Deal Name",
  "deal_storage": "https://drive.google.com/...",
  "deal_channel": "https://t.me/some_channel",
  "...": "..."
}
```

**Null case** (поле не заполнено / старые записи):
```json
{ "deal_channel": null }
```

**SQL change in `getDealById`** (`server/controllers/dealsController.js`):
```sql
-- Добавить в SELECT:
d.deal_channel
```
Поле уже попадает в ответ через `...row` / прямой маппинг — добавляется в тот же список колонок, что и `d.deal_storage`.

---

## 2. POST /api/v1/deals — изменение INSERT

**Изменение**: `deal_channel` принимается из тела запроса как опциональная строка, аналогично `deal_storage`.

```sql
INSERT INTO deals (..., deal_storage, deal_channel, ...) VALUES (..., $N, $N+1, ...)
-- $N = req.body.deal_storage || null
-- $N+1 = req.body.deal_channel || null
```

---

## 3. PUT /api/v1/deals/:id — изменение UPDATABLE_FIELDS

**Изменение**: `'deal_channel'` добавляется в массив `UPDATABLE_FIELDS` в `server/controllers/dealsController.js`, рядом с `'deal_storage'`.

```js
const UPDATABLE_FIELDS = ['title', 'value', 'close_date', 'account_id', 'stage', 'owner_id',
  'location', 'deal_type', 'source', 'project_domain', 'description', 'our_services',
  'deal_storage', 'deal_channel', 'expected_start_date', 'currency', 'lost_reason'];
```

Никакой доп. валидации на сервере не добавляется — поведение идентично `deal_storage` (не проверяется формат URL на бэкенде, только `type="url"` на клиенте).

---

## No changes to other endpoints

- `GET /api/v1/deals` (list) — не расширяется; `deal_channel` не нужен в списке (только в детальной карточке и форме), аналогично тому, как `deal_storage` тоже не входит в list-ответ.
- `GET /api/v1/accounts/:id`, `GET /api/v1/contacts/:id`, photo endpoints, notes endpoints — без изменений контракта (фиксы 1–3 полностью на фронтенде, серверные ответы не меняются).
