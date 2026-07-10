# Quickstart & Test Scenarios: Notes — Image Paste

**Feature**: F-14 | **Branch**: `014-notes-image-paste`

---

## Prerequisites

- App running (`npm run dev` in both `server/` and `client/`)
- Logged in as admin or bdm (write access)
- At least one Account, Contact, or Deal exists

---

## Scenario 1: Paste Image in New Note (Happy Path)

1. Open any entity detail page (e.g., `/accounts/{id}`)
2. Click the **Notes** tab
3. Click **+ Add Note** (or equivalent to enter note editor)
4. Copy any image to clipboard (screenshot, PNG from browser, etc.)
5. Click inside the textarea and press **Ctrl+V** (or **Cmd+V** on Mac)

**Expected**:
- Textarea text is unchanged (no garbled text inserted)
- A thumbnail strip appears below the textarea immediately
- A loading spinner shows in the thumbnail during upload (~1-2 sec)
- Spinner is replaced by a thumbnail preview of the image
- The note text area now ends with `![image](/uploads/...)` (appended automatically)

6. Type additional text if desired, then click **Add** / **Save**

**Expected**:
- Note saved successfully
- Note appears in the list with inline image rendered where the markdown reference was
- Image is fully visible (not a broken link)

---

## Scenario 2: View Note with Inline Image (All Roles)

1. Ensure a note with a pasted image exists (from Scenario 1)
2. Log in as **viewer** (Илья Болховский)
3. Open the same entity detail page
4. Open the **Notes** tab

**Expected**:
- Note body shows inline image (renders, not broken)
- No "Add Note" button or paste controls visible to viewer
- Text segments and image render in correct order

---

## Scenario 3: Paste Non-Image (Text or File)

1. Copy a block of text from anywhere
2. In the note textarea, press **Ctrl+V**

**Expected**:
- Normal text paste — text appears in the textarea
- No thumbnail strip appears
- No upload triggered

---

## Scenario 4: Paste Unsupported Image Type (e.g., SVG)

1. Copy an SVG image to clipboard
2. Paste into the note textarea

**Expected**:
- No upload triggered
- Inline error shown below the textarea: "Unsupported image format" (or similar)
- Textarea text unchanged

---

## Scenario 5: Multiple Images in One Note

1. In note editor, paste image A → thumbnail A appears with spinner, then preview
2. Paste image B while A may still be uploading → thumbnail B appears next to A with its own spinner

**Expected**:
- Both thumbnails show independently in the strip
- Both `![image](url)` references are appended to the text (in order)
- Saving includes both images in the note content
- View mode renders both images inline

---

## Scenario 6: Upload Failure

1. Disconnect network or stop the backend server
2. Paste an image in the note editor

**Expected**:
- Thumbnail shows loading spinner briefly
- Spinner replaced by an error message in the thumbnail (e.g., "Upload failed")
- No `![image](url)` appended to the note text
- Note text is unaffected; user can still save the note without the image

---

## Scenario 7: Paste Image While Editing Existing Note

1. Open an existing note (click edit / pencil icon)
2. Paste an image

**Expected**:
- Same behavior as Scenario 1 (thumbnail strip, upload, markdown reference appended)
- On save, the existing note content is updated to include the new image

---

## Verification Checklist

- [ ] Image uploads appear in `/uploads/{entity_type}s/{entity_id}/` directory
- [ ] Attachment record appears in DB: `SELECT * FROM attachments WHERE entity_id = '<id>'`
- [ ] Note content in DB contains `![image](/uploads/...)`: `SELECT content FROM notes WHERE id = '<id>'`
- [ ] Page reload still shows inline image (not ephemeral)
- [ ] Image accessible at the URL without auth from a new incognito tab (static serving confirmed)
