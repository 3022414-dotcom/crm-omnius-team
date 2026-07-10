# API Contract: Accounts (F-12 updates)

**Endpoint prefix**: `/api/v1/accounts`  
**Auth**: Session required. admin/bdm — CUD; viewer — R only.

---

## POST /api/v1/accounts — Create Account

### Request Body (JSON)

```json
{
  "name": "string (required)",
  "type": "Prospect | Client | Partner | Vendor | null",
  "website": "string | null",
  "phone": "string | null",
  "address": "string | null",
  "notes": "string | null",
  "location": "Russia | Belorussia | Kazakhstan | Armenia | null",
  "industry": "FinTech | MedTech | Agro | Oil and Gas | Commerce | HoReCa | Customer services | Production | null",
  "size": "1-50 | 51-200 | 201-1000 | 1000+ | null",
  "is_target": "boolean (default false)",
  "account_storage": "string (URL) | null",
  "account_manager_id": "UUID | null"
}
```

### Response 201

```json
{
  "id": "UUID",
  "name": "string",
  "type": "string | null",
  "website": "string | null",
  "phone": "string | null",
  "address": "string | null",
  "notes": "string | null",
  "location": "string | null",
  "industry": "string | null",
  "size": "string | null",
  "is_target": "boolean",
  "account_storage": "string | null",
  "account_manager_id": "UUID | null",
  "owner_id": "UUID",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

## GET /api/v1/accounts — List Accounts

### Response 200

```json
{
  "data": [
    {
      "id": "UUID",
      "name": "string",
      "type": "string | null",
      "location": "string | null",
      "industry": "string | null",
      "size": "string | null",
      "is_target": "boolean",
      "owner_id": "UUID",
      "contactsCount": "integer",
      "dealsCount": "integer",
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

## GET /api/v1/accounts/:id — Get Account

### Response 200 — полный объект аккаунта (все поля из POST response + contactsCount + dealsCount)

---

## PATCH /api/v1/accounts/:id — Update Account

### Request Body: любые поля из POST request body (все опциональны)

### Response 200: обновлённый объект аккаунта

---

## Validation Rules

| Поле | Правило |
|------|---------|
| `name` | Обязательно (не пустая строка) |
| `type` | Должно быть одним из допустимых ENUM-значений или null |
| `location` | Должно быть одним из допустимых ENUM-значений или null |
| `industry` | Должно быть одним из допустимых ENUM-значений или null |
| `size` | Должно быть одним из допустимых ENUM-значений или null |
| `account_manager_id` | Должен существовать в таблице users, или null |
| Остальные | Строки/булевы без ограничений |
