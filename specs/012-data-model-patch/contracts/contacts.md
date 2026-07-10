# API Contract: Contacts (F-12 updates)

**Endpoint prefix**: `/api/v1/contacts`  
**Auth**: Session required. admin/bdm — CUD; viewer — R only.

---

## POST /api/v1/contacts — Create Contact

### Request Body (JSON)

```json
{
  "first_name": "string (required)",
  "last_name": "string (required)",
  "account_id": "UUID | null",
  "email": "string | null",
  "email_corp": "string | null",
  "email_personal": "string | null",
  "phone": "string | null",
  "position": "string | null",
  "telegram": "string | null",
  "linkedin": "string | null",
  "facebook": "string | null",
  "location": "Russia | Belorussia | Kazakhstan | Armenia | null",
  "language": "Russian | English | null",
  "preferred_communication": "Telegram | WhatsApp | Email | LinkedIn | null",
  "birthday": "YYYY-MM-DD | null",
  "comments": "string | null",
  "source": "Founder | Marketing | Organic | BizDev | Customer | Referral | Agent | Event | Employee | null"
}
```

### Response 201

```json
{
  "id": "UUID",
  "first_name": "string",
  "last_name": "string",
  "account_id": "UUID | null",
  "email": "string | null",
  "email_corp": "string | null",
  "email_personal": "string | null",
  "phone": "string | null",
  "position": "string | null",
  "photo_path": "string | null",
  "telegram": "string | null",
  "linkedin": "string | null",
  "facebook": "string | null",
  "location": "string | null",
  "language": "string | null",
  "preferred_communication": "string | null",
  "birthday": "YYYY-MM-DD | null",
  "comments": "string | null",
  "source": "string | null",
  "owner_id": "UUID",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

## GET /api/v1/contacts — List Contacts

### Response 200

```json
{
  "data": [
    {
      "id": "UUID",
      "first_name": "string",
      "last_name": "string",
      "email": "string | null",
      "email_corp": "string | null",
      "phone": "string | null",
      "position": "string | null",
      "account_id": "UUID | null",
      "account_name": "string | null",
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

> Список возвращает subset полей. Полный набор — только в GET /:id.

---

## GET /api/v1/contacts/:id — Get Contact

### Response 200 — полный объект контакта со всеми полями + account_name (через LEFT JOIN)

---

## PATCH /api/v1/contacts/:id — Update Contact

### Request Body: любые поля из POST request body (все опциональны)

### Response 200: обновлённый объект контакта

---

## Backward Compatibility Note

Поле `email` остаётся в API и схеме. После миграции значение `email_corp` является приоритетным для работы. UI отображает `email_corp` как «Email corp.», а старое поле `email` — скрытое (для совместимости с существующим кодом, который может его читать).

---

## Validation Rules

| Поле | Правило |
|------|---------|
| `first_name` | Обязательно |
| `last_name` | Обязательно |
| `location` | ENUM или null |
| `language` | ENUM или null |
| `preferred_communication` | ENUM или null |
| `source` | ENUM или null |
| `birthday` | DATE формат YYYY-MM-DD или null |
| Остальные | Строки без ограничений |
