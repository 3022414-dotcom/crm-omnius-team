# Feature Specification: Entity Detail Page Redesign

**Feature Branch**: `013-entity-detail-redesign`

**Created**: 2026-07-10

**Status**: Draft

## Clarifications

### Session 2026-07-10

- Q: How does the detail page open — dedicated URL or expanded side panel? → A: Dedicated URL per entity (`/accounts/:id`, `/contacts/:id`, `/deals/:id`); clicking an entity in the list navigates to its own route.
- Q: What happens to the existing modal Edit button after inline editing is introduced? → A: Remove modal Edit button entirely. Inline editing is the only way to edit fields. Modal dialogs remain only for creating new records.
- Q: What visual feedback does the user see while an inline save is in progress? → A: Field immediately returns to read-mode and shows a small spinner next to the value; on success the spinner disappears; on error the original value is restored and a toast notification is shown.

**Input**: User description: "F-13 Редизайн карточек сущностей — переработка детальных страниц Account, Contact и Deal. Включает: 2-колоночный layout (поля слева, tabs со связанными сущностями справа); inline-редактирование полей (клик по полю → edit in place без открытия модального окна, сохранение по blur или Enter); отображение и загрузка фото контакта (аватарка в карточке, кнопки upload/delete); английские лейблы полей и статусов (как в ТЗ). Зависит от F-03, F-04, F-05, F-06, F-12."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured Entity Detail View (Priority: P1)

A CRM user navigates to any entity (Account, Contact, or Deal) and sees a consistent two-panel layout: the left panel shows all entity fields with labels and values, the right panel shows tabs with related entities (contacts, deals, notes, attachments, activities). Both panels are visible simultaneously without scrolling. Field labels are in English.

**Why this priority**: This is the foundation for all other stories. Without a usable, consistent detail view, inline editing and photo upload have no surface to live on. The current layout lacks structure and forces users to scroll through flat lists.

**Independent Test**: Open any Account, Contact, or Deal — the page renders both panels, all fields are visible with English labels, and related-entity tabs are accessible.

**Acceptance Scenarios**:

1. **Given** a user opens an Account detail page, **When** the page loads, **Then** the left panel shows all Account fields (Name, Type, Industry, Size, Location, Website, Phone, Notes, Manager, Target, Storage) with English labels, and the right panel shows tabs: Contacts, Deals, Notes, Attachments, Activities.

2. **Given** a user opens a Contact detail page, **When** the page loads, **Then** the left panel shows the contact avatar area and all Contact fields (First Name, Last Name, Position, Account, Email Corp, Email Personal, Phone, Telegram, LinkedIn, Facebook, Location, Language, Preferred Communication, Birthday, Source, Comments) with English labels, and the right panel shows tabs: Deals, Notes, Attachments, Activities.

3. **Given** a user opens a Deal detail page, **When** the page loads, **Then** the left panel shows all Deal fields (Title, Stage, Account, Value, Currency, Close Date, Expected Start Date, Deal Type, Source, Location, Project Domain, Our Services, Description, Storage, Lost Reason) with English labels, and the right panel shows tabs: Contacts, Notes, Attachments, Activities.

4. **Given** a user is on an entity detail page, **When** they click a tab in the right panel, **Then** the right panel content switches to that tab without reloading the left panel or losing scroll position.

5. **Given** a Deal is in "lost" stage, **When** the user views the Deal detail, **Then** the Lost Reason field is visible with its value.

---

### User Story 2 - Inline Field Editing (Priority: P2)

A CRM user (admin or bdm) can edit any individual field directly on the detail page by clicking on it. A text input, select dropdown, or date picker appears in place of the value. The user saves by pressing Enter or clicking away, or cancels by pressing Escape. No modal window is opened.

**Why this priority**: Reduces friction for routine updates (e.g., changing a deal stage, updating a contact's position). Currently every edit requires opening a full modal with all fields.

**Independent Test**: Click on a field value (e.g., Account Industry) → edit → blur → verify the new value is persisted and visible without page reload.

**Acceptance Scenarios**:

1. **Given** a logged-in admin/bdm on an Account detail page, **When** they click on the "Industry" value, **Then** a dropdown appears with valid options; selecting one and clicking away saves the new value immediately.

2. **Given** a user is editing a text field inline, **When** they press Enter, **Then** the value is saved; **When** they press Escape, **Then** the original value is restored and no save occurs.

3. **Given** a user edits a required field (e.g., Account Name) and clears it, **When** they blur or press Enter, **Then** an error message appears inline and the original value is restored.

4. **Given** a user with viewer role, **When** they view any entity detail page, **Then** all fields are read-only — no inline editor is triggered on click.

5. **Given** a field has an ENUM type (e.g., Deal Stage, Deal Type, Source, Location), **When** the user clicks to edit, **Then** a dropdown with all valid options appears (no free-text input).

6. **Given** a user is editing a field inline, **When** saving fails (e.g., network error), **Then** the original value is restored and an error notification is shown.

7. **Given** a Deal detail page and the stage is changed to "Lost" via inline edit, **When** the stage is saved, **Then** the Lost Reason field becomes visible and editable inline.

---

### User Story 3 - Contact Photo Management (Priority: P3)

A CRM user can upload a photo for a Contact. The avatar is displayed in the left panel of the Contact detail page. The user can replace or delete the photo. The backend already supports photo upload and deletion.

**Why this priority**: Improves contact recognition in lists and detail views. Backend is already implemented; only the UI is missing.

**Independent Test**: On a Contact detail page, click the avatar area → upload an image file → verify the new avatar appears in the left panel.

**Acceptance Scenarios**:

1. **Given** a Contact has no photo, **When** the user views the Contact detail page, **Then** a placeholder avatar (initials or generic icon) is shown in the left panel with a visible "Upload photo" affordance.

2. **Given** a logged-in admin/bdm on a Contact detail page, **When** they click the avatar area, **Then** a file picker opens accepting image files (JPEG, PNG, WebP).

3. **Given** a user selects a valid image file, **When** the upload completes, **Then** the new avatar is immediately displayed in the left panel without page reload.

4. **Given** a Contact already has a photo, **When** the user uploads a new image, **Then** the old photo is replaced by the new one.

5. **Given** a Contact has a photo, **When** the user clicks "Delete photo", **Then** the avatar reverts to the placeholder and the photo is removed.

6. **Given** a viewer-role user, **When** they view a Contact detail page, **Then** the avatar is displayed but no upload/delete controls are visible.

7. **Given** a user tries to upload a file that is not an image or exceeds the size limit, **When** the upload is attempted, **Then** an error message is shown and the existing photo (or placeholder) remains unchanged.

---

### Edge Cases

- What happens when a Contact's account is removed (account_id set to null) via inline edit? The Account field should show empty/blank and the change should save.
- How does inline edit behave on a multi-value field like "Our Services" (checkboxes)? A dropdown with checkboxes should appear in place.
- What if two users edit the same entity simultaneously? Last write wins; no special conflict resolution for MVP.
- What happens when a Deal stage is changed away from "Lost" inline? The Lost Reason field should become hidden/empty.
- What if the user uploads a very large image (>5MB)? The system must reject it with a clear size-limit error.
- How is the avatar URL handled if the backend file is missing? A fallback placeholder should be shown silently.
- What if the entity has zero related records in a tab? The tab should be visible with an empty-state message ("No deals yet").

## Requirements *(mandatory)*

### Functional Requirements

**Layout**

- **FR-001**: Each entity (Account, Contact, Deal) MUST have a dedicated URL route (`/accounts/:id`, `/contacts/:id`, `/deals/:id`). Clicking an entity in a list view navigates to its detail page; a "Back" breadcrumb returns to the list.
- **FR-002**: The detail page for Account, Contact, and Deal MUST render a two-panel layout: left panel (~35% width) containing entity fields, right panel (~65% width) containing related-entity tabs.
- **FR-003**: Both panels MUST be independently scrollable when content overflows the viewport height.
- **FR-004**: All field labels on detail pages MUST be in English, matching the terminology in the project specification.
- **FR-005**: The layout MUST be consistent across all three entity types (Account, Contact, Deal).
- **FR-006**: The right panel MUST include the following tabs per entity:
  - Account: Contacts, Deals, Notes, Attachments, Activities
  - Contact: Deals, Notes, Attachments, Activities
  - Deal: Contacts, Notes, Attachments, Activities

**Inline Editing**

- **FR-007**: The modal "Edit" button on Account, Contact, and Deal pages MUST be removed. Inline field editing is the sole mechanism for updating existing records. Modal dialogs are retained only for creating new records.
- **FR-008**: Users with admin or bdm roles MUST be able to click on any editable field value to activate an inline editor.
- **FR-009**: Text fields MUST show a text input in place of the value when clicked.
- **FR-010**: ENUM fields (Stage, Deal Type, Source, Location, Industry, Size, Language, Preferred Communication, Project Domain, Our Services, Currency) MUST show a dropdown/select in place of the value when clicked.
- **FR-011**: Date fields (Close Date, Expected Start Date, Birthday) MUST show a date picker in place of the value when clicked.
- **FR-012**: Saving MUST occur on blur (clicking outside) or pressing Enter.
- **FR-013**: Cancelling MUST occur on pressing Escape, restoring the original value with no API call.
- **FR-014**: Required fields (Account Name, Contact First Name, Contact Last Name, Deal Title) MUST not be saveable as empty; validation error shown inline.
- **FR-015**: Viewer-role users MUST NOT see inline edit affordances; fields appear as read-only text.
- **FR-016**: When a Deal's Stage field is changed to "Lost", the Lost Reason field MUST become visible and editable; when changed away from "Lost", Lost Reason MUST be hidden.
- **FR-017**: When a save is in progress, the field MUST immediately return to read-mode and display a small inline spinner next to the saved value.
- **FR-018**: On successful save, the spinner disappears and the new value remains displayed.
- **FR-019**: On save failure, the original value MUST be restored and a toast error notification displayed. The user may click the field again to retry.

**Contact Photo**

- **FR-020**: The Contact detail page left panel MUST display an avatar: the contact's photo if available, or a placeholder (initials or generic icon) if not.
- **FR-021**: Admin and bdm users MUST be able to click the avatar to open a file picker accepting JPEG, PNG, and WebP.
- **FR-022**: After a successful upload, the new avatar MUST appear immediately without page reload.
- **FR-023**: Admin and bdm users MUST be able to delete the contact photo; the avatar reverts to the placeholder.
- **FR-024**: Files larger than 5 MB MUST be rejected with an informative error message before upload.
- **FR-025**: Non-image files MUST be rejected.
- **FR-026**: Viewer-role users MUST see the avatar but MUST NOT see upload or delete controls.

### Key Entities

- **Account**: Organisation entity; fields: Name, Type, Location, Industry, Size, Is Target, Website, Phone, Address, Notes, Account Storage, Account Manager. Related: Contacts, Deals, Notes, Attachments, Activities.
- **Contact**: Person entity; fields: First Name, Last Name, Position, Account, Email Corp, Email Personal, Phone, Telegram, LinkedIn, Facebook, Location, Language, Preferred Communication, Birthday, Source, Comments. Has photo_path for avatar. Related: Deals, Notes, Attachments, Activities.
- **Deal**: Sales opportunity; fields: Title, Stage, Account, Value, Currency, Close Date, Expected Start Date, Deal Type, Source, Location, Project Domain, Our Services, Description, Deal Storage, Lost Reason. Related: Contacts, Notes, Attachments, Activities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can view any entity detail page and see all fields and related-entity tabs in a single page load without additional navigation.
- **SC-002**: A user can update a single field on an entity without opening a modal — the edit, save, and confirmation complete in under 3 clicks.
- **SC-003**: All three entity types (Account, Contact, Deal) render with an identical structural layout, verified visually.
- **SC-004**: A contact photo upload completes and the new avatar appears within 3 seconds of file selection on a standard office connection.
- **SC-005**: 100% of field labels visible on detail pages match the English terminology defined in the project specification (no Russian labels remaining).
- **SC-006**: Viewer-role users cannot trigger any edit action on any field; all edit affordances are hidden from their view.
- **SC-007**: The right-panel tabs load their content without reloading the left panel — field values in the left panel remain unchanged while switching tabs.

## Assumptions

- All three entity types share the same two-panel layout structure for visual consistency ("homogeneity" requirement from team feedback).
- The backend API endpoints for creating, updating, and deleting entity fields already exist and are stable (F-04, F-05, F-06, F-12 are complete).
- The photo upload and delete endpoints for contacts are already implemented in the backend (F-05).
- The primary user device is a desktop browser; mobile responsiveness is out of scope for this feature.
- Inline editing is field-by-field (one field editable at a time); bulk edit mode is out of scope.
- The "Our Services" multi-select field on Deals uses checkboxes in a dropdown; saving stores the full array.
- Boolean fields (e.g., Is Target on Account) use a toggle or checkbox as the inline editor.
- Permissions follow existing role definitions: admin and bdm can edit; viewer is read-only.
- No optimistic UI updates required; the saved value is confirmed after a successful API response.
