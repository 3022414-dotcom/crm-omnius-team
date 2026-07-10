# API Contracts: Notes — Image Paste

**Feature**: F-14 | **Branch**: `014-notes-image-paste`

All existing routes. F-14 adds one field to an existing response and modifies no routes.

---

## Modified Response: POST /api/v1/attachments

**Change**: Add `url` field to the success response. All other request/response fields unchanged.

**Request** (unchanged):
```
POST /api/v1/attachments
Content-Type: multipart/form-data

Fields:
  entity_type: "account" | "contact" | "deal"
  entity_id:   UUID
  file:        <binary image file>
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "file_name": "screenshot.png",
  "file_size": 145632,
  "mime_type": "image/png",
  "entity_type": "account",
  "entity_id": "uuid",
  "uploaded_by": { "id": "uuid", "name": "Юлия Шевцова" },
  "created_at": "2026-07-10T12:34:56.789Z",
  "url": "/uploads/accounts/uuid/uuid_screenshot.png"
}
```

**New field**: `url` — the browser-accessible path to the uploaded file, served by Express static middleware at `/uploads/*`. Format: `/${file_path}` where `file_path` is the relative path stored in the DB.

**Auth**: Session cookie required (via `app.use('/api/v1', ensureAuthenticated)`).

---

## Reused: GET /uploads/* (static serving)

Images embedded in notes are served via Express static middleware:
```
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
```
No auth required. Files are addressed by UUID-prefixed paths, making them non-guessable.

---

## Reused: POST /api/v1/notes

Used to save a note after images are pasted and uploaded.

**Request**:
```json
{
  "entity_type": "account" | "contact" | "deal",
  "entity_id": "uuid",
  "content": "Meeting notes.\n\n![image](/uploads/accounts/uuid/uuid_file.png)\n\nFollow-up items."
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "entity_type": "account",
  "entity_id": "uuid",
  "content": "...",
  "author": { "id": "uuid", "name": "..." },
  "created_at": "2026-07-10T12:34:56.789Z"
}
```

---

## Reused: PUT /api/v1/notes/:id

Used to save an existing note after pasting images.

**Request**:
```json
{
  "content": "Updated text with ![image](/uploads/accounts/uuid/uuid_file.png)"
}
```

**Response** (200 OK): Returns the updated note object.

---

## Reused: GET /api/v1/{entity}s/:id/notes

Used to load notes for display. Returns `content` field which may contain markdown image references.

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "content": "Text with ![image](/uploads/accounts/uuid/uuid.png)",
    "author": { "id": "uuid", "name": "..." },
    "created_at": "2026-07-10T12:34:56.789Z"
  }
]
```

The frontend parses `content` and renders inline images.
