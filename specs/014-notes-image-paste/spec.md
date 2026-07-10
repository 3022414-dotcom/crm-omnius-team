# Feature Specification: Notes — Image Paste

**Feature Branch**: `014-notes-image-paste`

**Created**: 2026-07-10

**Status**: Draft

**Input**: F-14 — в поле добавления/редактирования заметки пользователь должен иметь возможность вставить изображение через Ctrl+V / Cmd+V. Вставленное изображение загружается как вложение и отображается inline в теле заметки.

**Dependencies**: F-07 (Notes), F-08 (Attachments)

---

## Clarifications

### Session 2026-07-10

- Q: Как должно храниться вставленное изображение в теле заметки? → A: Markdown-ссылка (`![image](url)`) встраивается прямо в текстовое поле `content` заметки — без изменений схемы БД.
- Q: Что пользователь видит в редакторе после вставки изображения (до сохранения заметки)? → A: Textarea остаётся для текста; вставленные изображения отображаются как thumbnail-полоса под полем ввода. Inline-рендеринг (изображение внутри текста) — только в режиме просмотра сохранённой заметки.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Paste Image While Writing a Note (Priority: P1)

A user with write access is composing or editing a note. They copy an image from anywhere (a screenshot tool, a browser, an image editor) and paste it into the note field using Ctrl+V or Cmd+V. The image is uploaded automatically and appears as a thumbnail preview below the text input. The user then saves the note normally. When viewing the saved note, the image renders inline within the note body.

**Why this priority**: This is the core user action the feature is built around. Without it, the feature does not exist.

**Independent Test**: Open any entity detail page (Account, Contact, or Deal), go to the Notes tab, start a new note, copy any image to the clipboard, press Ctrl+V — a thumbnail of the image should appear below the text field. Save the note and verify the image renders inline in the saved note body.

**Acceptance Scenarios**:

1. **Given** a user with write access is typing a new note, **When** they paste an image from the clipboard (Ctrl+V / Cmd+V), **Then** the image is uploaded immediately and a thumbnail preview appears below the text input area.

2. **Given** a user pastes an image that is still uploading, **When** the upload is in progress, **Then** a loading indicator appears in the thumbnail strip below the text input until the upload completes.

3. **Given** an image has been pasted and uploaded successfully, **When** the user clicks "Add" to save the note, **Then** the note is saved with the image embedded as a markdown reference, and when viewing the note the image renders inline within the note body.

4. **Given** a user with write access is editing an existing note, **When** they paste an image, **Then** a thumbnail appears below the text area and the note can be saved with the new image included.

---

### User Story 2 — View Notes with Inline Images (Priority: P2)

Any user (including viewers) opens a saved note that contains one or more pasted images. The images render inline within the note body, visible without any extra action.

**Why this priority**: Without rendering, pasted images are useless. This is the read-side of the feature and must work for all roles.

**Independent Test**: After saving a note with a pasted image (US1), reload the page and open the Notes tab — the image must render inline in the note body for all users including viewers.

**Acceptance Scenarios**:

1. **Given** a note contains a pasted image, **When** any user views the note, **Then** the image is displayed inline within the note body without requiring any extra action.

2. **Given** a viewer-role user opens a Notes tab, **When** viewing notes with embedded images, **Then** the images are visible and the paste action is not available to them (note editor is not accessible to viewers).

3. **Given** a note contains multiple pasted images, **When** any user views the note, **Then** all images render inline in the order they were pasted.

---

### Edge Cases

- **Non-image paste**: User pastes text or a non-image file — normal text paste behavior, no upload triggered, no thumbnail shown.
- **Oversized image**: User pastes an image exceeding the size limit — an error message is shown below the text area, no upload occurs, the note text is unaffected.
- **Unsupported format**: User pastes a file type that is not a supported image format — error shown below the text area, no upload.
- **Upload failure**: Network error during upload — an error is shown in the thumbnail strip, the thumbnail is removed; the note text is unaffected; the user can try pasting again.
- **Cancel note after paste**: User pastes an image (upload succeeds), then discards the note — the uploaded image file remains in storage as an attachment to the entity (acceptable in MVP; no orphan cleanup required).
- **Multiple pastes in one note**: Each image is uploaded independently; all thumbnails appear in the strip below the text area in order pasted.
- **Paste while previous upload is in progress**: Second paste is accepted; both show their own loading indicators in the thumbnail strip simultaneously.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users with write access (admin, bdm) MUST be able to paste an image from the system clipboard into the note creation field using standard paste keyboard shortcuts (Ctrl+V on Windows/Linux, Cmd+V on macOS).
- **FR-002**: Upon detecting an image in the paste event, the system MUST begin uploading the image immediately as an attachment linked to the same entity (account, contact, or deal) as the note.
- **FR-003**: While the image is uploading, the system MUST display a loading indicator in the thumbnail strip below the text input area.
- **FR-004**: Upon successful upload, the system MUST display the image as a thumbnail in the strip below the text input area. A markdown image reference (`![image](url)`) is automatically appended to the note content.
- **FR-005**: The note body MUST store a markdown image reference (`![image](url)`) in the existing `content` text field — no database schema change is required. The URL points to the uploaded attachment file.
- **FR-006**: When any user views a saved note, inline images MUST render within the note body without requiring additional user action. The markdown image reference is parsed and rendered as an `<img>` element.
- **FR-007**: If the pasted content is not a supported image format (JPEG, PNG, GIF, WebP), the system MUST ignore the image paste and leave the note text unchanged.
- **FR-008**: If the pasted image exceeds the maximum allowed file size, the system MUST display an inline error message below the text area and abort the upload without affecting the note text.
- **FR-009**: If the image upload fails for any reason, the system MUST display an error in the thumbnail strip and remove the failed thumbnail; the note text is unaffected.
- **FR-010**: The paste-to-upload feature MUST work identically across all three entity types: Account, Contact, and Deal notes.
- **FR-011**: Viewer-role users MUST NOT be able to paste images (the note editor is not accessible to viewers).

### Key Entities

- **Note**: An existing entity. Its `content` text field stores plain text mixed with markdown image references (`![image](url)`). No schema change required.
- **Attachment**: An existing entity. Images pasted into notes are stored as attachments linked to the same entity as the note. The attachment's file URL is used as the image source in the markdown reference.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From clipboard paste to thumbnail preview appearing below the text input takes no more than 3 seconds on a standard connection.
- **SC-002**: Notes containing pasted images render correctly (images visible inline) for 100% of users across all three entity types.
- **SC-003**: Upload errors are surfaced to the user within 2 seconds of the failure occurring.
- **SC-004**: The paste feature works in all modern browsers (Chrome, Firefox, Safari, Edge — latest 2 major versions each).
- **SC-005**: Non-image pastes (text, non-supported files) do not trigger any upload or error; normal paste behavior is preserved.

---

## Assumptions

- Only clipboard paste (keyboard shortcut) is in scope. Drag-and-drop image upload into notes is a separate feature.
- The note editor remains a plain textarea; no rich-text or markdown editor is introduced. Inline image rendering occurs only in view mode (saved notes).
- Images pasted during editing are displayed as a thumbnail strip below the textarea — not embedded in the text while editing.
- The maximum image file size is inherited from the existing attachment upload limit (50 MB).
- No server-side image compression or resizing is applied; images are stored as-is.
- The feature targets desktop browsers only; mobile paste behavior is out of scope for MVP.
- Images pasted into a note that is subsequently discarded (not saved) remain stored as attachments — no automatic cleanup of orphaned images in MVP.
- The existing attachment upload infrastructure is reused without modification to backend endpoints.
- No new user roles or permissions are introduced; write access follows the existing role matrix (admin and bdm can write, viewer cannot).
- The note `content` field stores markdown image references inline with text; the field type remains `text` (no schema migration needed).
