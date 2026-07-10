# API Contracts: Entity Detail Page Redesign

**Feature**: F-13 | All endpoints are pre-existing (no new backend development required)

---

## Entity Detail — GET

### GET /api/v1/accounts/:id
Fetch full Account detail including account manager name and counts.

**Response 200**:
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "type": "Company",
  "industry": "FinTech",
  "size": "51-200",
  "location": "Russia",
  "is_target": true,
  "website": "https://acme.com",
  "phone": "+7-999-000",
  "address": "Moscow, Russia",
  "notes": "Key partner",
  "account_storage": "https://drive.google.com/...",
  "account_manager_id": "uuid",
  "account_manager_name": "Julia Shevtsova",
  "owner_id": "uuid",
  "contactsCount": 3,
  "dealsCount": 2,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-07-01T00:00:00Z"
}
```

**Response 404**: `{ "error": "Not Found" }`

---

### GET /api/v1/contacts/:id
Fetch full Contact detail including account name.

**Response 200**:
```json
{
  "id": "uuid",
  "first_name": "Anna",
  "last_name": "Kovaleva",
  "position": "CEO",
  "photo_path": "uploads/contacts/uuid/avatar_uuid.jpg",
  "email_corp": "anna@acme.com",
  "email_personal": "anna@gmail.com",
  "phone": "+7-999-111",
  "telegram": "@annakovaleva",
  "linkedin": "https://linkedin.com/in/annakovaleva",
  "facebook": null,
  "location": "Russia",
  "language": "Russian",
  "preferred_communication": "Telegram",
  "birthday": "1985-06-15T00:00:00Z",
  "source": "Founder",
  "comments": "Key decision maker",
  "account_id": "uuid",
  "account_name": "Acme Corp",
  "owner_id": "uuid",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-07-01T00:00:00Z"
}
```

---

### GET /api/v1/deals/:id
Fetch full Deal detail.

**Response 200**:
```json
{
  "id": "uuid",
  "title": "Acme AI Integration",
  "stage": "proposal",
  "account_id": "uuid",
  "account_name": "Acme Corp",
  "value": 500000,
  "currency": "RUB",
  "close_date": "2026-09-30T00:00:00Z",
  "expected_start_date": "2026-08-01T00:00:00Z",
  "deal_type": "New Client",
  "source": "Founder",
  "location": "Russia",
  "project_domain": "FinTech",
  "our_services": ["AI Consulting", "AI Outsource"],
  "description": "Full AI integration project",
  "deal_storage": "https://drive.google.com/...",
  "lost_reason": null,
  "owner_id": "uuid",
  "deal_contacts": [
    { "id": "uuid", "first_name": "Anna", "last_name": "Kovaleva", "role": "Decision Maker", "comment": "" }
  ],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-07-01T00:00:00Z"
}
```

---

## Entity Update — PATCH

### PATCH /api/v1/accounts/:id
Update one or more Account fields.

**Request**: `Content-Type: application/json`
```json
{ "industry": "FinTech" }
```
Only include the field(s) being updated. Empty string `""` is treated as `null` by the backend.

**Response 200**: Full account object (same as GET).  
**Response 400**: `{ "error": "Bad Request", "message": "..." }`  
**Response 404**: `{ "error": "Not Found" }`

---

### PATCH /api/v1/contacts/:id
Update one or more Contact fields.

**Request**: `Content-Type: application/json`
```json
{ "position": "CTO" }
```

**Response 200**: Full contact object (same as GET).

---

### PATCH /api/v1/deals/:id
Update one or more Deal fields.

**Request**: `Content-Type: application/json`
```json
{ "stage": "won" }
```

Special rule: if `stage` is set to `"lost"`, `lost_reason` should be included or updated separately.

**Response 200**: Full deal object (same as GET).

---

## Contact Photo

### POST /api/v1/contacts/:id/photo
Upload a contact photo.

**Request**: `Content-Type: multipart/form-data`  
Field name: `photo`  
Accepted: JPEG, PNG, WebP  
Max size: enforced by multer on backend

**Response 200**:
```json
{ "photo_url": "/uploads/contacts/uuid/avatar_uuid.jpg" }
```

**Response 400**: `{ "error": "Bad Request", "message": "Файл не загружен" }`

---

### DELETE /api/v1/contacts/:id/photo
Delete contact photo.

**Response 200**: `{}`

---

## Related Entities (Tab Content)

### GET /api/v1/accounts/:id/contacts
List contacts for an account. Used in Account detail → Contacts tab.

**Response 200**: `{ "data": [...contacts], "total": N, "page": 1, "limit": 20 }`

### GET /api/v1/accounts/:id/deals  
List deals for an account. Used in Account detail → Deals tab.

**Response 200**: `{ "data": [...deals], "total": N, "page": 1, "limit": 20 }`

### GET /api/v1/notes?entity_type=account&entity_id=:id
### GET /api/v1/attachments?entity_type=account&entity_id=:id
### GET /api/v1/activities?entity_type=account&entity_id=:id
Used for Notes, Attachments, Activities tabs respectively. Same pattern for contact/deal.

### GET /api/v1/deals/:id/contacts
List contacts linked to a deal. Used in Deal detail → Contacts tab.

**Response 200**: `{ "data": [...deal_contacts with role/comment] }`
