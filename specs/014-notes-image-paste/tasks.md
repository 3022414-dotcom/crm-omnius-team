# Tasks: Notes — Image Paste

**Input**: Design documents from `specs/014-notes-image-paste/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Scope**: 2 files modified, no new files, no migrations, no new routes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup & Verification

**Purpose**: Confirm the existing infrastructure that F-14 extends is in the expected state before modifying it.

- [X] T001 Read `server/controllers/attachmentsController.js` and confirm `createAttachment` computes `relPath` and it is accessible at the point of the `res.status(201).json(...)` call
- [X] T002 Read `client/src/components/tabs/NotesTab.jsx` and confirm the structure: textarea renders in create/edit mode, note content displays in view mode, `uploadAttachment` is imported from `api/attachments.js`
- [X] T003 Read `client/src/api/attachments.js` and confirm `uploadAttachment` accepts a `FormData` body and returns the parsed JSON response from the server

**Checkpoint**: Both source files located, structure understood, ready to modify.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Backend response contract change — must be done first so that the frontend receives the `url` field when testing US1.

**⚠️ CRITICAL**: US1 frontend paste flow depends on the `url` field from the backend. Complete this before Phase 3.

- [X] T004 In `server/controllers/attachmentsController.js`, add `url: '/' + relPath` to the `res.status(201).json(...)` call inside `createAttachment`. The `relPath` variable (relative path from project root, e.g., `uploads/accounts/uuid/uuid_file.png`) is already computed above; just add the field to the response object.

**Checkpoint**: `POST /api/v1/attachments` now returns `{ ..., url: "/uploads/..." }`. Verify by uploading any file and inspecting the JSON response.

---

## Phase 3: User Story 1 — Paste Image While Writing (Priority: P1) 🎯 MVP

**Goal**: A user with write access pastes an image into the note textarea, it uploads automatically, a thumbnail appears below the textarea, and a markdown reference is appended to the note text.

**Independent Test**: Open any entity Notes tab, paste a screenshot (Ctrl+V / Cmd+V) into the new-note textarea — a thumbnail strip appears with a spinner that resolves to a preview. Save the note; the note is stored with `![image](/uploads/...)` in its content.

### Implementation for User Story 1

- [X] T005 [US1] In `client/src/components/tabs/NotesTab.jsx`, add `const [pendingImages, setPendingImages] = useState([])` to the component state (import `useState` if not already imported). Add a reset call `setPendingImages([])` wherever the note editor is cancelled or the saved note is dismissed.

- [X] T006 [US1] In `client/src/components/tabs/NotesTab.jsx`, add the `handlePaste` function (per `contracts/ui.md`):
  - Check `event.clipboardData.items` for an item where `item.kind === 'file'` and `item.type.startsWith('image/')`
  - If no image: return (allow normal paste)
  - If image type not in `['image/jpeg','image/png','image/gif','image/webp']`: set an error entry in `pendingImages`, return
  - **If `file.size > 50 * 1024 * 1024` (50 MB): push `{ localId: crypto.randomUUID(), status: 'error', errorMessage: 'Image too large (max 50 MB)' }` to `pendingImages` and return** (FR-008 — client-side pre-check before upload)
  - Call `event.preventDefault()`
  - Generate `localId = crypto.randomUUID()`
  - Push `{ localId, status: 'uploading' }` to `pendingImages`
  - Build a `FormData` with `file`, `entity_type`, `entity_id`
  - Call `uploadAttachment(formData)`
    - On success: update entry to `{ localId, status: 'done', url: att.url }`, append `![image](${att.url})\n` to the note text state
    - On error: update entry to `{ localId, status: 'error', errorMessage: err.message || 'Upload failed' }`

- [X] T007 [US1] In `client/src/components/tabs/NotesTab.jsx`, attach `onPaste={handlePaste}` to the note `<textarea>` element used in create/edit mode.

- [X] T008 [US1] In `client/src/components/tabs/NotesTab.jsx`, add the thumbnail strip UI below the `<textarea>` in create/edit mode (per `contracts/ui.md`):
  - Render only when `pendingImages.length > 0`
  - A `<div className="flex flex-wrap gap-2 mt-2">` containing one `<div className="relative w-16 h-16 rounded border border-border overflow-hidden bg-muted">` per entry
  - Status `'uploading'`: centered `<Loader2 className="animate-spin w-4 h-4 text-muted-foreground" />` (import `Loader2` from `lucide-react`)
  - Status `'done'`: `<img src={img.url} className="w-full h-full object-cover" />`
  - Status `'error'`: centered `<span className="text-xs text-destructive text-center p-1">{img.errorMessage}</span>`

**Checkpoint**: User Story 1 is fully functional. Verify with quickstart.md Scenarios 1, 3, 4, 5, 6, 7.

---

## Phase 4: User Story 2 — View Notes with Inline Images (Priority: P2)

**Goal**: Any user (including viewers) sees saved notes with inline images rendered from the `![image](url)` markdown references stored in `note.content`.

**Independent Test**: After saving a note with a pasted image, reload the page — the image renders inline in the note body for all users including the viewer role.

### Implementation for User Story 2

- [X] T009 [US2] In `client/src/components/tabs/NotesTab.jsx`, add the `renderNoteContent(content)` function (per `contracts/ui.md`):
  - Regex: `/!\[([^\]]*)\]\(([^)]+)\)/g`
  - Walk through matches, collecting alternating text and image segments
  - Return an array of React elements:
    - Text segments: `<span key={i} className="whitespace-pre-wrap">{segment}</span>`
    - Image segments: `<img key={i} src={src} alt={alt} className="max-w-full rounded border border-border my-1" style={{ maxHeight: '400px' }} />`

- [X] T010 [US2] In `client/src/components/tabs/NotesTab.jsx`, replace the plain-text display of note content in view mode with `renderNoteContent(note.content)`. The call site is wherever the note body is currently rendered (typically `<p className="...">note.content</p>` or similar) — wrap the output in a `<div className="text-sm">` to maintain consistent spacing.

**Checkpoint**: User Story 2 is complete. Verify with quickstart.md Scenarios 1 (view step), 2, 5 (multiple images).

---

## Phase 5: Polish & Validation

**Purpose**: Cross-cutting verification, edge case spot-checks, reset-on-cancel confirmation.

- [X] T011 [P] In `client/src/components/tabs/NotesTab.jsx`, confirm `pendingImages` resets when the note editor is dismissed. During T002 you read the component — if the editor is **conditionally rendered** (`{isEditing && <textarea>}`), state resets automatically on unmount (no code change needed, just verify). If the editor is **CSS-hidden** (always mounted, toggled with a class), add an explicit `useEffect(() => { if (!isEditing) setPendingImages([]) }, [isEditing])` to force the reset. Confirm either way that reopening the editor shows an empty thumbnail strip.

- [X] T012 [P] Verify quickstart.md Scenario 3 (non-image paste): copy plain text and paste into note textarea — no thumbnail appears, no upload triggered, text inserts normally

- [X] T013 [P] Verify quickstart.md Scenario 4 (unsupported format): if possible, paste an SVG — error thumbnail shows, no upload, textarea unchanged

- [ ] T014 Run all 7 quickstart.md scenarios and confirm each passes (include Scenario 2 to verify viewer role sees no paste UI — FR-011)

- [ ] T015 [P] Verify paste behavior in Firefox and Safari: open Notes tab, paste a screenshot, confirm thumbnail strip appears, upload completes, and saving stores the image reference (SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks US1 frontend work** (T005–T008 need `att.url` in response)
- **US1 (Phase 3)**: Depends on Phase 2 (T004 complete)
- **US2 (Phase 4)**: Depends on Phase 3 being complete (view mode builds on same component)
- **Polish (Phase 5)**: Depends on Phase 4

### Within User Story 1

- T005 (state) → T006 (handler) → T007 (wire handler) → T008 (thumbnail UI)
- T005 and T006 can be written in parallel (different logical blocks in the same file) but both must be complete before T007

### Within User Story 2

- T009 (renderNoteContent function) → T010 (use in view mode)

### Parallel Opportunities

- T001, T002, T003 (Phase 1) can all run in parallel
- T011, T012, T013 (Phase 5 verification) can run in parallel

---

## Parallel Example: User Story 1 Verification

```
# Verify US1 in parallel from quickstart.md:
Scenario 1 (happy path paste + save + view)
Scenario 3 (non-image paste does nothing)
Scenario 6 (upload failure shows error)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Read existing files — understand structure
2. Complete Phase 2: Add `url` to `createAttachment` response (T004) — backend ready
3. Complete Phase 3: Add paste handler + thumbnail strip to NotesTab (T005–T008)
4. **STOP and VALIDATE**: Run Scenarios 1, 3, 6 from quickstart.md
5. Ship US1 — paste and upload works, markdown stored in DB

### Full Delivery (US1 + US2)

1. After US1 validated → add Phase 4 (T009–T010): inline image rendering in view mode
2. Run Scenarios 1 (full), 2 (viewer), 5 (multiple images)
3. Run Phase 5 Polish
4. All 7 scenarios green → feature complete

---

## Notes

- No new npm packages — use `crypto.randomUUID()` (browser built-in), `Loader2` from lucide-react (already in project)
- No migration — `notes.content` is already `TEXT`
- No new routes — reusing `POST /api/v1/attachments`
- Orphaned attachments (uploaded but note discarded) are acceptable in MVP per spec Assumptions
- The `/uploads/*` static path has no auth — acceptable for 4-person internal CRM (same pattern as contact photos)
