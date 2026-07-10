# Data Model: Notes — Image Paste

**Feature**: F-14 | **Branch**: `014-notes-image-paste`

---

## Existing Entities Used (No Schema Changes)

### Note

Source: `notes` table (defined in F-07).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| entity_type | ENUM (account/contact/deal) | |
| entity_id | UUID | |
| content | TEXT NOT NULL | Stores plain text mixed with `![image](url)` markdown references |
| author_id | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**No migration required.** The `content` field is `TEXT` — it already holds arbitrary string content. Markdown image references (`![image](url)`) are stored as-is in this field.

**Example stored value**:
```
Meeting notes from Tuesday call.

![image](/uploads/accounts/abc-123/uuid_screenshot.png)

Follow-up items: see below.
```

---

### Attachment

Source: `attachments` table (defined in F-08).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| entity_type | ENUM (account/contact/deal) | Matches the note's entity_type |
| entity_id | UUID | Matches the note's entity_id |
| file_name | VARCHAR NOT NULL | Original filename |
| file_path | VARCHAR NOT NULL | Relative path: `uploads/{entity_type}s/{entity_id}/{uuid}_{filename}` |
| file_size | INTEGER | Bytes |
| mime_type | VARCHAR | e.g., `image/png`, `image/jpeg` |
| uploaded_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |

**Pasted images are stored as standard attachments** linked to the same entity as the note. The `file_path` field is used to construct the image URL (`/${file_path}`).

**New response field** (backend response change, not schema change): `createAttachment` response adds:
```json
{
  "url": "/uploads/accounts/abc-123/uuid_screenshot.png"
}
```
This is `'/' + relPath` where `relPath` is the value computed in the controller. No DB column change.

---

## No New Entities

F-14 introduces no new database tables, columns, or migrations. All persistence is handled by existing `notes` and `attachments` infrastructure.
