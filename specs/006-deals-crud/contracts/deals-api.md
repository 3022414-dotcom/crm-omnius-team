# API Contract: Deals

**Base URL**: `/api/v1/deals` | **Auth**: все эндпоинты требуют сессии (ensureAuthenticated)

---

## POST /api/v1/deals

**Роли**: admin, bdm | **Статус 403**: viewer

**Request Body**:
```json
{
  "title": "Внедрение CRM",         // REQUIRED
  "value": 250000,                   // optional
  "close_date": "2026-09-30",        // optional, ISO date
  "account_id": "uuid"               // optional
}
```

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 201 | Deal Object (без contacts, без contacts_count) | Успех |
| 400 | `{"error":"Bad Request","message":"title обязателен"}` | title пустой/отсутствует |
| 400 | `{"error":"Bad Request","message":"Аккаунт не найден"}` | account_id не существует |
| 403 | `{"error":"Forbidden"}` | viewer |

**Поведение**: stage = 'lead', owner_id = req.user.id

---

## GET /api/v1/deals

**Роли**: все авторизованные

**Query params**:
- `page` (int, default 1, min 1)
- `limit` (int, default 20, max 100)
- `search` (string, ILIKE по title)
- `stage` (string, один из VALID_STAGES)
- `account_id` (UUID)
- `owner_id` (UUID)
- `date_from` (YYYY-MM-DD, close_date >=)
- `date_to` (YYYY-MM-DD, close_date <=)

**Response 200**:
```json
{
  "data": [ ...Deal List Objects (с account, owner, contacts_count)... ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

## GET /api/v1/deals/:id

**Роли**: все авторизованные

**Response 200**:
```json
{
  "id": "uuid",
  "title": "...",
  "value": "250000.00",
  "stage": "qualified",
  "close_date": "2026-09-30",
  "account_id": "uuid",
  "owner_id": "uuid",
  "account": { "id": "uuid", "name": "ООО Ромашка" },
  "owner":   { "id": "uuid", "name": "Анастасия Стефанова" },
  "contacts": [
    { "id": "uuid", "first_name": "Иван", "last_name": "Петров", "photo_path": null }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

| Code | Условие |
|------|---------|
| 200 | Найдена |
| 404 | Не найдена |

---

## PUT /api/v1/deals/:id

**Роли**: admin, bdm | **Статус 403**: viewer

**Request Body** (все поля опциональны):
```json
{
  "title": "Новое название",
  "value": 300000,
  "close_date": "2026-10-15",
  "account_id": "uuid",
  "stage": "proposal",
  "owner_id": "uuid"
}
```

**Responses**:

| Code | Условие |
|------|---------|
| 200 | Deal Object обновлён (формат как GET /:id без contacts) |
| 400 | title пустой |
| 400 | stage невалидный |
| 400 | account_id не существует |
| 400 | owner_id не существует |
| 403 | viewer |
| 404 | Сделка не найдена |

**Поведение**: только переданные поля изменяются; пустой body {} → 200 без изменений

---

## DELETE /api/v1/deals/:id

**Роли**: admin только | **Статус 403**: bdm, viewer

| Code | Условие |
|------|---------|
| 204 | Удалена (каскад: deal_contacts DB, notes/attachments/activities app-level) |
| 403 | Не admin |
| 404 | Не найдена |

---

## POST /api/v1/deals/:id/contacts

**Роли**: admin, bdm | **Статус 403**: viewer

**Request Body**:
```json
{ "contact_id": "uuid" }
```

| Code | Body | Условие |
|------|------|---------|
| 201 | `{}` | Новая связь создана |
| 200 | `{}` | Контакт уже привязан (идемпотентно) |
| 400 | `{"error":"Bad Request","message":"Контакт не найден"}` | contact_id не существует |
| 404 | `{"error":"Not Found"}` | Сделка не найдена |
| 403 | `{"error":"Forbidden"}` | viewer |

---

## DELETE /api/v1/deals/:id/contacts/:contact_id

**Роли**: admin, bdm | **Статус 403**: viewer

| Code | Условие |
|------|---------|
| 204 | Связь удалена (или не существовала — идемпотентно) |
| 404 | Сделка не найдена |
| 403 | viewer |
