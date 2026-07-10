# Research: Entity Detail Page Redesign

**Feature**: F-13 | **Date**: 2026-07-10 | **Branch**: 013-entity-detail-redesign

## Decision 1: Inline Editing Pattern

**Decision**: Per-field local state (`useState`) within an `InlineField` wrapper component — not react-hook-form.

**Rationale**: react-hook-form is optimized for form-wide submission (all fields at once). Inline editing saves one field at a time on blur/Enter. Local state per field is simpler, avoids form context overhead, and maps cleanly to single-field PATCH requests. Each field manages: `isEditing (bool)` + `tempValue (string|array)` + `saving (bool)`.

**Alternatives considered**:
- react-hook-form with `mode: "onBlur"` — rejected because the form context would wrap the entire page, complicating the data flow and adding unnecessary re-renders on unrelated field edits.
- contentEditable — rejected due to accessibility issues, difficulty controlling cursor behavior, and poor compatibility with ENUM/date field types.

---

## Decision 2: Routing Approach

**Decision**: Add `:id` sub-routes within existing wildcards in AppShell. Each page component (`AccountsPage`, `ContactsPage`, `DealsPage`) uses nested `<Routes>` to handle both list (`/accounts`) and detail (`/accounts/:id`).

**Rationale**: `AppShell.jsx` already declares `path="accounts/*"` etc. Adding `<Route path=":id" element={<AccountDetailPage />} />` inside `AccountsPage` is zero-friction — no changes to AppShell routing needed. This follows the existing pattern.

**Alternatives considered**:
- Adding `:id` routes directly in AppShell — rejected because it would require duplicating the `ProtectedRoute` wrapping and restructuring all existing routes.
- Using modal/overlay pattern — rejected per clarification Q1 (dedicated URL required).

---

## Decision 3: Two-Panel Layout Implementation

**Decision**: CSS Grid with fixed left column (~340px) and flexible right column. Both columns independently scrollable via `overflow-y: auto` on each panel.

**Rationale**: Fixed pixel width for left panel gives consistent field label/value alignment regardless of viewport width. Right panel takes remaining space. Independent scroll means a long notes list in tabs doesn't bury field values.

**Alternatives considered**:
- Flexbox with percentage widths — usable but fields with short labels look misaligned at wider viewports.
- Tailwind `grid-cols-[340px_1fr]` — selected approach, clean and declarative.

---

## Decision 4: Contact Photo Upload

**Decision**: Hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` triggered programmatically by clicking the avatar `<div>`. File size validation (>5MB) on the client before sending. Use `FormData` for multipart upload to `POST /api/v1/contacts/:id/photo`.

**Rationale**: Backend endpoint already exists with multer handling. No new backend work. Client-side size check (5MB) gives instant feedback; server-side limit is the authoritative guard.

**Alternatives considered**:
- Drag-and-drop upload zone — more complex, out of scope for MVP.
- Base64 encoding — rejected because the backend expects multipart/form-data.

---

## Decision 5: ENUM Fields Inline Editor

**Decision**: Clicking an ENUM field renders a native `<select>` in place, pre-populated with valid values. On change, immediately saves (no Enter needed for selects — `onChange` fires on selection).

**Rationale**: Native `<select>` is accessible, keyboard-navigable, and requires no custom dropdown component. For ENUM fields the value is constrained — free-text input is never appropriate.

**Alternatives considered**:
- Custom dropdown (Radix Select) — richer UX but more code; native select sufficient for internal tool.
- Combobox for ENUM — over-engineered for fields with <10 options.

---

## Decision 6: "Our Services" Multi-Select Inline Editor

**Decision**: Clicking the "Our Services" field shows a small dropdown panel with checkboxes (one per service). Panel closes on blur and saves the selected array via PATCH.

**Rationale**: `Our Services` is the only array-type field. A checkbox list in a floating div is the simplest multi-select pattern that doesn't require a third-party component.

**No new dependency needed**: implemented as a small inline component using `useState` for the panel open state and the checked values.

---

## Decision 7: Removing Modal Edit Buttons

**Decision**: Remove the `Edit` button (and its modal) from AccountDetail, ContactDetail, and DealDetail within the list pages. The `New [Entity]` creation button and its modal are retained.

**Rationale**: With inline editing on the detail page, the modal edit path is redundant. The clarification session confirmed: modal Edit removed, modal Create retained.

**Implementation note**: The existing `AccountModal`, `ContactModal`, and `DealModal` components are used for creation. They are NOT deleted — only the "Edit" invocation paths are removed from list pages.
