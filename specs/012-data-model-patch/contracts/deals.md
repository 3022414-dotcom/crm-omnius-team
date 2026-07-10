# API Contract: Deals (F-12 updates)

**Endpoint prefix**: `/api/v1/deals`  
**Auth**: Session required. admin/bdm — CUD; viewer — R only.

---

## POST /api/v1/deals — Create Deal

### Request Body (JSON)

```json
{
  "title": "string (required)",
  "account_id": "UUID | null",
  "stage": "lead | qualifying | discovery | proposal | closing | contract | won | lost (default: lead)",
  "value": "number | null",
  "close_date": "YYYY-MM-DD | null",
  "location": "Russia | Belorussia | Kazakhstan | Armenia | null",
  "deal_type": "New Client | New Project with existing client | Upsale | null",
  "source": "Founder | Marketing | Organic | BizDev | Customer | Referral | Agent | Event | Tender Platforms | Employee | null",
  "project_domain": "FinTech | MedTech | Agro | Oil and Gas | Commerce | HoReCa | Customer services | Production | null",
  "description": "string | null",
  "our_services": "string[] | null",
  "deal_storage": "string (URL) | null",
  "expected_start_date": "YYYY-MM-DD | null",
  "currency": "RUB | EUR | USD (default: RUB)",
  "lost_reason": "string | null (required when stage = 'lost')"
}
```

### Response 201

```json
{
  "id": "UUID",
  "title": "string",
  "account_id": "UUID | null",
  "account": { "id": "UUID", "name": "string" } ,
  "stage": "string",
  "value": "number | null",
  "close_date": "YYYY-MM-DD | null",
  "location": "string | null",
  "deal_type": "string | null",
  "source": "string | null",
  "project_domain": "string | null",
  "description": "string | null",
  "our_services": "string[] | null",
  "deal_storage": "string | null",
  "expected_start_date": "YYYY-MM-DD | null",
  "currency": "string",
  "lost_reason": "string | null",
  "owner_id": "UUID",
  "owner": { "id": "UUID", "name": "string" },
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

## GET /api/v1/deals — List Deals

### Response 200

```json
{
  "data": [
    {
      "id": "UUID",
      "title": "string",
      "stage": "string",
      "value": "number | null",
      "currency": "string",
      "expected_start_date": "YYYY-MM-DD | null",
      "account": { "id": "UUID", "name": "string" },
      "owner": { "id": "UUID", "name": "string" },
      "owner_id": "UUID",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "total": "integer",
  "page": "integer",
  "limit": "integer"
}
```

---

## GET /api/v1/deals/:id — Get Deal

### Response 200 — полный объект сделки со всеми полями + account + owner

---

## PATCH /api/v1/deals/:id — Update Deal

### Request Body: любые поля из POST request body (все опциональны)

### Response 200: обновлённый объект сделки

---

## GET /api/v1/deals/kanban — Kanban View

### Response 200

```json
{
  "lead": [{ "id": "UUID", "title": "...", "account": {...}, "value": null, "currency": "RUB", "owner": {...}, "expected_start_date": null }],
  "qualifying": [...],
  "discovery": [...],
  "proposal": [...],
  "closing": [...],
  "contract": [...],
  "won": [...],
  "lost": [...]
}
```

> Возвращает сделки по всем 8 стейджам. Карточка содержит: title, account, value, currency, owner, expected_start_date.

---

## Deal Contacts: PATCH /api/v1/deals/:id/contacts/:contactId

Обновить role и comment для связи сделка-контакт.

### Request Body

```json
{
  "role": "string | null",
  "comment": "string | null"
}
```

### Response 200

```json
{
  "deal_id": "UUID",
  "contact_id": "UUID",
  "role": "string | null",
  "comment": "string | null"
}
```

---

## Validation Rules

| Поле | Правило |
|------|---------|
| `title` | Обязательно |
| `stage` | Должно быть одним из 8 значений ENUM |
| `lost_reason` | **Обязательно** при `stage = 'lost'` (400 если пусто) |
| `currency` | ENUM или null (default RUB) |
| `location` | ENUM или null |
| `deal_type` | ENUM или null |
| `source` | ENUM или null |
| `project_domain` | ENUM или null |
| `our_services` | Массив строк; допустимые значения: Workshop, Webinar, Consulting, POC, Development, Accelerator, Performance |
| Даты | YYYY-MM-DD или null |
| `value` | Число (decimal) или null |

---

## Stage Values (после F-12)

```
lead → qualifying → discovery → proposal → closing → contract → won
                                                               ↓
                                                             lost
```

Переходы без ограничений (любой → любой) кроме: stage = 'lost' требует lost_reason.
