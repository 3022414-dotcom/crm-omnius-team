# Research: Notes — Image Paste

**Feature**: F-14 | **Branch**: `014-notes-image-paste` | **Date**: 2026-07-10

---

## Decision 1: Clipboard Image Detection

**Decision**: Use the browser's native `onPaste` event with `event.clipboardData.items` on the textarea.

**Rationale**: No library required. `DataTransferItemList` is supported in all modern browsers (Chrome, Firefox, Safari, Edge). Detection logic: iterate items, find first item where `item.type.startsWith('image/')` and `item.kind === 'file'`, extract `File` via `item.getAsFile()`.

**Alternatives considered**:
- Clipboard API (`navigator.clipboard.read()`) — requires explicit user permission prompt, worse UX than the passive `onPaste` event.
- Third-party paste libraries — unnecessary overhead for 4-user internal CRM.

---

## Decision 2: Image URL Strategy for Saved Notes

**Decision**: Modify `createAttachment` response to include a `url` field (`'/' + relPath`, e.g., `/uploads/accounts/uuid/uuid_filename.jpg`). Frontend stores this URL in the markdown reference. Images are served by Express static middleware (`/uploads/*`) without auth.

**Rationale**: The existing `GET /api/v1/attachments/:id/download` endpoint uses `res.download()` which sets `Content-Disposition: attachment` — browsers won't render it inline as an image. The `/uploads/` static path is already exposed without auth (same pattern as contact photos: `photo_path → /uploads/contacts/...`). For a 4-person internal CRM this is acceptable — file paths include UUIDs and are not guessable. Adding `url` to the response is a non-breaking, backwards-compatible extension.

**Alternatives considered**:
- New `/api/v1/attachments/:id/view` endpoint (auth-protected, `Content-Disposition: inline`) — cleaner security-wise but adds a new endpoint and changes the scope of no-backend-changes. Deferred as a future improvement.
- Modifying existing download endpoint to serve inline — breaks existing download behavior for non-image files.
- Not storing URL, reconstructing from ID on render — impossible without knowing the generated filename (UUID prefix is server-generated).

---

## Decision 3: Markdown Image Rendering (No New Library)

**Decision**: Custom inline renderer using a single regex. The note content is split on `![...](url)` matches; text segments render as `<span className="whitespace-pre-wrap">`, image matches render as `<img>`.

**Regex**: `/!\[([^\]]*)\]\(([^)]+)\)/g`

**Rationale**: The only markdown construct used in notes is `![alt](url)`. Installing a full markdown library (react-markdown, marked, remark) for a single pattern violates "Простота прежде всего" and adds bundle weight. No new npm packages per the constitution.

**Alternatives considered**:
- `react-markdown` — handles all markdown but ~50 KB gzipped for a feature that only needs `![](url)`.
- `marked` with a DOM sanitizer — same issue plus XSS risk if sanitizer is misconfigured.
- Rich text editor (Tiptap, Quill, Slate) — out of scope per spec clarification.

---

## Decision 4: NotesTab State Management for Thumbnail Strip

**Decision**: Single `pendingImages` state array in NotesTab for the current editing session. Each entry: `{ localId, status: 'uploading'|'done'|'error', url?, errorMessage? }`. On paste:
1. `localId = crypto.randomUUID()` (browser API, no library)
2. Push `{ localId, status: 'uploading' }` to `pendingImages`
3. Call `uploadAttachment(formData)`
4. On success: update entry to `{ localId, status: 'done', url }`, append `![image](url)\n` to `text`
5. On error: update entry to `{ localId, status: 'error', errorMessage }`

Thumbnail strip renders only while creating/editing (not in view mode). Cleared on note save or cancel.

**Rationale**: No global state needed — images are scoped to one note editing session. React local state is sufficient.

**Alternatives considered**:
- Storing pending images in React Query cache — unnecessary indirection.
- Appending a placeholder text marker and replacing on upload — complex regex management.

---

## Decision 5: Supported Formats and Size Limit

**Decision**: Accept JPEG, PNG, GIF, WebP. Validate client-side by checking `file.type`. Max size: 50 MB (inherited from `multer` config in existing attachments controller). Show error inline in thumbnail strip for rejections.

**Rationale**: These are the common web image formats. GIF is explicitly included for animated screenshots. The 50 MB backend limit is already enforced by multer; client-side validation provides immediate feedback without a round trip.

---

## Decision 6: Backend Change Scope

**Decision**: One minimal backend change — add `url` field to `createAttachment` JSON response.

**Rationale**: All other requirements (upload, auth, entity linking, storage) are already handled by the existing `POST /api/v1/attachments` endpoint. No schema migration needed. No new routes needed.

**Change**: In `server/controllers/attachmentsController.js`, `createAttachment` function, add to the response JSON:
```js
url: '/' + relPath,  // e.g., "/uploads/accounts/uuid/uuid_file.jpg"
```
