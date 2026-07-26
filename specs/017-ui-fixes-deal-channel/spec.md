# Feature Specification: UI Bug Fixes & Deal Channel Field

**Feature Branch**: `017-ui-fixes-deal-channel`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "По итогам тестирования выявлены баги и доработки: (1) поля с гиперссылками нельзя отредактировать из карточки — клик открывает ссылку вместо режима редактирования; (2) фото контакта нельзя открыть в полном размере; (3) поле ввода текста в заметках слишком маленькое для большого текста; (4) в сущность Deal нужно добавить новое поле Deal Channel (гиперссылка), сразу после поля Storage URL."

## Clarifications

### Session 2026-07-26

- Q: How should users distinguish "click to edit" from "click to open the link" on a hyperlink field? → A: Option A — a small "open in new tab" icon appears next to the link text (visible always or on hover); clicking the icon opens the link, clicking anywhere else on the field enters edit mode.
- Q: What is the maximum expand height for the notes text input before it switches to internal scrolling? → A: Auto-grow up to ~10 lines (~240px), then scroll internally.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit hyperlink fields from an entity card (Priority: P1)

A team member opens an Account, Contact, or Deal card and needs to update a field that holds a link (e.g. Website, Storage URL, LinkedIn, Facebook). Today, clicking that field opens the link in a new tab instead of letting them edit the value, so the field is effectively stuck once a link is set.

**Why this priority**: This blocks a core, everyday CRUD action — correcting or updating a stored link — for every entity that has a link-type field. Without a fix, users cannot fix typos or update outdated links at all through the UI.

**Independent Test**: Open any entity card with a populated link field (e.g. a Contact's LinkedIn field), click on the field value, and confirm an edit control appears allowing the value to be changed and saved — without navigating away from the card.

**Acceptance Scenarios**:

1. **Given** an entity card with a link field that already has a value, **When** the user clicks on the field's text/label area, **Then** the field switches into edit mode showing the current value in an editable input, and no new browser tab is opened.
2. **Given** a link field in edit mode, **When** the user changes the value and confirms, **Then** the new value is saved and displayed as a clickable link again.
3. **Given** an entity card with a link field that already has a value, **When** the user looks at the field, **Then** a small "open in new tab" icon is visible next to the link text, and clicking that icon opens the link in a new tab without entering edit mode.
4. **Given** an entity card with an empty link field, **When** the user clicks on it, **Then** it switches into edit mode the same way as any other empty field.

---

### User Story 2 - Add and manage the Deal Channel field (Priority: P2)

A sales team member working a Deal needs to record which acquisition/communication channel is tied to the deal (a link, e.g. to a chat, channel, or campaign page), so this information is available alongside the deal's other reference links.

**Why this priority**: This is a data-completeness gap raised directly by the business — without it, a piece of information the team already tracks informally has no home in the CRM, forcing workarounds outside the system.

**Independent Test**: Open a Deal card, locate the new "Deal Channel" field positioned directly after "Storage URL", enter a link, save, and confirm it persists and displays as a clickable link on reload.

**Acceptance Scenarios**:

1. **Given** a Deal's detail card, **When** the user views the field list, **Then** a "Deal Channel" field appears immediately after "Storage URL".
2. **Given** the Deal Channel field is empty, **When** the user enters a valid link and saves, **Then** the value is stored and shown as a clickable link on the card.
3. **Given** the Deal Channel field already has a value, **When** the user edits it (per User Story 1's fix), **Then** the updated value is saved and reflected immediately.
4. **Given** a Deal Channel field left empty, **When** the deal is saved, **Then** no error occurs — the field is optional.
5. **Given** the Deal create/edit form, **When** the user views it, **Then** "Deal Channel" also appears there, positioned after "Storage URL", consistent with the detail card.

---

### User Story 3 - View a contact's photo full-size (Priority: P3)

A team member looking at a Contact's card wants to see the contact's photo at full size (e.g. to verify identity or read details in the image) instead of the small thumbnail shown on the card.

**Why this priority**: Useful verification/reference capability, but does not block any data-entry workflow — it's a viewing convenience.

**Independent Test**: Open a Contact card that has a photo, interact with the photo thumbnail, and confirm a larger view of the photo opens above the card content and can be dismissed to return to the card.

**Acceptance Scenarios**:

1. **Given** a Contact card with a photo set, **When** the user hovers over the photo, **Then** a visual cue indicates the photo can be opened larger.
2. **Given** a Contact card with a photo set, **When** the user clicks the photo, **Then** a full-size view of the photo opens as an overlay on top of the card.
3. **Given** the full-size photo view is open, **When** the user dismisses it (e.g. clicking outside the image or a close control), **Then** the overlay closes and the underlying Contact card remains exactly as it was.
4. **Given** a Contact card with no photo set, **When** the user interacts with the empty photo area, **Then** no full-size view attempt occurs.

---

### User Story 4 - Comfortably write long notes (Priority: P4)

A team member adding a Note to an Account, Contact, or Deal wants to write a longer note (multiple paragraphs) without fighting a cramped, single-line-sized input box.

**Why this priority**: A writing-comfort improvement for an existing, already-functional feature — lowest urgency of the four, but frequently annoying in daily use.

**Independent Test**: Open the Notes tab on any entity, start typing a multi-line note, and confirm the input area grows to comfortably fit the content as it's typed (up to a reasonable maximum), rather than staying at its original small size.

**Acceptance Scenarios**:

1. **Given** an empty note input, **When** the user starts typing, **Then** the input area is noticeably larger than the current small default and remains easy to use for short notes too.
2. **Given** a note input with several lines of text already entered, **When** the user continues typing more lines, **Then** the input area expands to keep the text visible, up to a maximum of approximately 10 lines (~240px).
3. **Given** a note input has grown to its maximum height (~10 lines / ~240px), **When** the user keeps typing beyond that, **Then** the input scrolls internally rather than growing indefinitely or pushing the rest of the page out of view.
4. **Given** an existing long note being edited, **When** the edit input opens, **Then** it opens already sized to fit the existing content, up to the ~10-line maximum.

---

### Edge Cases

- What happens when a link field's value is not a well-formed URL (e.g. leftover free text from before validation existed)? Editing must still be possible, and the "open in new tab" icon should not break or navigate incorrectly.
- What happens when the user's tap target for the "open in new tab" icon and the surrounding editable field are very close together on a narrow/mobile screen? The icon must remain a distinct, reliably tappable target separate from the rest of the field.
- What happens when a user without edit permission (e.g. viewer role) views a link field? Clicking anywhere on the field should only ever open the link (no icon needed, no edit mode available).
- What happens when a Deal Channel link is entered without a scheme (e.g. `example.com` instead of `https://example.com`)? Same handling/validation as the existing Storage URL field.
- What happens when a Contact photo fails to load (broken image)? The hover/click-to-expand affordance should not appear, or should fail gracefully without opening a broken overlay.
- What happens when the full-size photo overlay is open and the user presses the Escape key? The overlay should close (standard modal behavior).
- What happens when a note's content is extremely long (far beyond the max input height)? The input must remain scrollable and usable; saving must not be blocked by length.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For every entity field that displays a hyperlink (Account Website, Account Storage URL, Deal Storage URL, Deal Channel, Contact LinkedIn, Contact Facebook), the system MUST allow a user with edit permission to enter edit mode by clicking on the field, without triggering navigation to the link's target.
- **FR-002**: For each populated link field, the system MUST show a small "open in new tab" icon next to the link text; clicking that icon MUST open the link in a new tab, and MUST NOT enter edit mode. Clicking anywhere else on the field MUST enter edit mode.
- **FR-003**: The system MUST preserve existing read-only behavior for users without edit permission — link fields remain click-to-open-only for those users.
- **FR-004**: The system MUST add a "Deal Channel" field to the Deal entity, accepting a hyperlink value.
- **FR-005**: The system MUST display the "Deal Channel" field immediately after the "Storage URL" field in both the Deal detail card and the Deal create/edit form.
- **FR-006**: The "Deal Channel" field MUST be optional (deals can be saved with it empty).
- **FR-007**: The "Deal Channel" field MUST follow the same validation and edit/open-link behavior defined in FR-001–FR-003 for link fields.
- **FR-008**: The system MUST allow a user to open a Contact's photo in a full-size overlay view from the Contact's detail card.
- **FR-009**: The full-size photo overlay MUST appear above the current card content and MUST be dismissible (returning the user to the card unchanged) without a page reload.
- **FR-010**: The system MUST NOT offer the full-size photo view for contacts that have no photo set.
- **FR-011**: The system MUST expand the note text input as the user types longer content, up to a maximum height of approximately 10 lines (~240px), and MUST allow internal scrolling once that maximum is reached.
- **FR-012**: The note text input's expanded behavior MUST apply consistently when creating a new note and when editing an existing note.

### Key Entities

- **Deal**: Existing entity representing a sales opportunity. Gains one new attribute, "Deal Channel" — an optional hyperlink recorded alongside the existing "Storage URL" attribute, positioned immediately after it in field ordering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully edit a populated link field (e.g. change a Storage URL) in under 10 seconds, with zero unintended tab/navigation events, in 100% of attempts during acceptance testing.
- **SC-002**: 100% of Deal cards show the "Deal Channel" field directly after "Storage URL", and a value entered there persists correctly across a page reload.
- **SC-003**: Users can open and close a Contact's full-size photo view without any change to the underlying card's data or scroll position, in 100% of attempts during acceptance testing.
- **SC-004**: The note input auto-grows to fit content up to ~10 lines (~240px) before scrolling internally, verified for both new and existing notes, in 100% of attempts during acceptance testing.
- **SC-005**: Zero regressions in existing read-only (viewer role) link field behavior after the fix — link fields for viewers still only open links, verified across all affected entities.

## Assumptions

- "Hyperlink fields" in scope for FR-001–FR-003 are all fields currently rendered as clickable links on entity cards (Account Website, Account Storage URL, Deal Storage URL, Contact LinkedIn, Contact Facebook), plus the new Deal Channel field. Contact Telegram is a plain text field today (not rendered as a link) and is out of scope for this fix.
- "Deal Channel" stores a single URL per deal (not a list of multiple links).
- The notes input auto-grows up to ~10 lines (~240px), matching typical short-to-medium note length; longer content scrolls within that fixed max height rather than growing further.
- Full-size photo viewing is scoped to Contacts only (the only entity with a photo field today); Accounts and Deals have no photo field currently.
- No new permission rules are introduced — existing role-based edit permissions (admin/bdm can edit, viewer cannot) continue to govern who sees the edit affordance on link fields.
- The full-size photo overlay does not need download/upload/delete controls of its own — it is a read-only viewer; existing photo upload/delete controls on the card are unaffected.
