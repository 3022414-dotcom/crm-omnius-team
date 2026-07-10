# Tasks: Entity Detail Page Redesign

**Input**: Design documents from `specs/013-entity-detail-redesign/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: Not requested — manual browser testing via quickstart.md (14 scenarios) in Polish phase.

**Organization**: Tasks grouped by user story. US1 (layout + routing) → US2 (inline editing) → US3 (photo). All phases depend on Phase 1 shared components.

---

## Phase 1: Setup (Shared Components)

**Purpose**: Create reusable UI components used across all three entity detail pages. No backend changes needed.

- [X] T001 Create `client/src/components/detail/DetailLayout.jsx` — two-panel CSS Grid wrapper (`grid-cols-[340px_1fr]`, both panels `overflow-y-auto h-full`); props: `leftPanel` (ReactNode), `rightPanel` (ReactNode)
- [X] T002 Create `client/src/components/detail/InlineField.jsx` — inline-edit component with read/edit mode toggle; supports types: `text`, `select`, `date`, `textarea`, `url`, `email`, `toggle`; props per data-model.md (`label`, `value`, `onSave`, `type`, `options`, `readOnly`, `required`, `placeholder`); internal state: `isEditing`, `tempValue`, `saving`, `error`; save on blur/Enter, cancel on Escape, spinner on saving, toast+rollback on error
- [X] T003 Create `client/src/components/detail/InlineMultiSelect.jsx` — checkbox dropdown for array fields (used for Deal "Our Services"); props: `label`, `value` (string[]), `options` (string[]), `onSave`, `readOnly`; shows floating panel with checkboxes on click, closes + saves on blur
- [X] T004 Create `client/src/components/detail/ContactAvatar.jsx` — avatar display + upload/delete widget; props: `contactId`, `photoUrl`, `firstName`, `lastName`, `canEdit`, `onPhotoChange`; shows photo or initials placeholder; triggers hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` on click; internal state: `uploading`, `error`
- [X] T005 Create `client/src/components/detail/EntityTabs.jsx` — tab navigation + content for the right panel; props: `tabs` (array of `{ id, label, content: ReactNode }`), `defaultTab` (string); renders tab bar and switches content on click without unmounting other panels; used by all three detail pages

**Checkpoint**: All 5 shared components created. Can be mounted temporarily in any page for visual inspection.

---

## Phase 2: Foundational (API Functions)

**Purpose**: Ensure all required frontend API functions exist before wiring up pages. These functions are called by US1 (fetching detail), US2 (PATCH saves), and US3 (photo upload/delete).

**⚠️ CRITICAL**: Phases 3–5 cannot begin until these API functions are verified/created.

- [X] T006 [P] Audit `client/src/api/accounts.js` — verify `getAccountById(id)` (GET /api/v1/accounts/:id) and `updateAccount(id, data)` (PATCH /api/v1/accounts/:id) exist with correct signatures; create if missing
- [X] T007 [P] Audit `client/src/api/contacts.js` — verify `getContactById(id)`, `updateContact(id, data)`, `uploadContactPhoto(id, file)` (POST multipart), and `deleteContactPhoto(id)` (DELETE) exist; create any missing functions
- [X] T008 [P] Audit `client/src/api/deals.js` — verify `getDealById(id)` (GET /api/v1/deals/:id) and `updateDeal(id, data)` (PATCH /api/v1/deals/:id) exist; create if missing

**Checkpoint**: All API functions verified. Phase 3 can begin.

---

## Phase 3: User Story 1 — Structured Entity Detail View (Priority: P1) 🎯 MVP

**Goal**: Each entity has a dedicated URL (`/accounts/:id`, `/contacts/:id`, `/deals/:id`) with a consistent 2-column layout. Fields are displayed in read-only mode at this stage. Clicking a row in the list navigates to the detail URL.

**Independent Test**: Open `/accounts/:id` — see left panel with all 12 Account fields (English labels) and right panel with tabs. Click Contacts/Deals/Notes tabs — content loads. Click "← Accounts" — returns to list. Repeat for `/contacts/:id` and `/deals/:id`.

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `client/src/pages/accounts/AccountDetailPage.jsx` — fetch account with `useQuery(['account', id], () => getAccountById(id))`; render `<DetailLayout>` with left panel (all 12 Account fields from Account Field Registry in data-model.md as `<InlineField readOnly={true}>`; labels in English per FR-004) and right panel (`<EntityTabs>` with tabs: Contacts, Deals, Notes, Attachments, Activities — render existing list/content components for each tab); breadcrumb: `← Accounts` link to `/accounts`
- [X] T010 [US1] Modify `client/src/pages/accounts/AccountsPage.jsx` — add nested `<Routes>`: index route renders existing account list, `:id` route renders `<AccountDetailPage />`; update list row click handler to `navigate(\`/accounts/${id}\`)` instead of opening side panel; preserve "New Account" button and creation modal
- [X] T011 [P] [US1] Create `client/src/pages/contacts/ContactDetailPage.jsx` — fetch contact with `useQuery(['contact', id], () => getContactById(id))`; render `<DetailLayout>` with left panel (`<ContactAvatar canEdit={false} photoUrl={...} firstName={...} lastName={...}>` + all 16 Contact fields from Contact Field Registry as `<InlineField readOnly={true}>`) and right panel (`<EntityTabs>` with Deals, Notes, Attachments, Activities); breadcrumb: `← Contacts`
- [X] T012 [US1] Modify `client/src/pages/contacts/ContactsPage.jsx` — add nested `<Routes>` with `:id` → `<ContactDetailPage />`; update click handler to `navigate(\`/contacts/${id}\`)`; preserve "New Contact" button
- [X] T013 [P] [US1] Create `client/src/pages/deals/DealDetailPage.jsx` — fetch deal with `useQuery(['deal', id], () => getDealById(id))`; render `<DetailLayout>` with left panel (all Deal fields from Deal Field Registry as `<InlineField readOnly={true}>`; Lost Reason rendered only when `deal.stage === 'lost'`) and right panel (`<EntityTabs>` with Contacts — showing deal_contacts with role/comment column, Notes, Attachments, Activities); breadcrumb: `← Deals`
- [X] T014 [US1] Modify `client/src/pages/deals/DealsPage.jsx` — add nested `<Routes>` with `:id` → `<DealDetailPage />`; update click handler to `navigate(\`/deals/${id}\`)`; preserve "New Deal" button

**Checkpoint**: All 3 detail pages accessible by URL. Fields display values with English labels. List navigation works. Tabs load related content.

---

## Phase 4: User Story 2 — Inline Field Editing (Priority: P2)

**Goal**: Admin and bdm users can click any field to edit it inline. Save on blur/Enter, cancel on Escape. ENUM fields show dropdown. Save failure restores original value + shows toast. Modal Edit button removed.

**Independent Test**: On `/accounts/:id` (as admin), click "Industry" → select new value → field saves (spinner → new value). Press Escape → original value restored. Clear "Name" field → error shown. As viewer → no fields editable.

**Note on field names**: Replace `fieldName` in `onSave` handlers with the actual DB field name from the Field Registry in data-model.md (e.g., for Industry: `updateAccount(id, { industry: val })`; for Location: `updateContact(id, { location: val })`).

### Implementation for User Story 2

- [X] T015 [P] [US2] Update `client/src/pages/accounts/AccountDetailPage.jsx` — replace `readOnly={true}` InlineFields with wired versions: `onSave={(val) => updateAccount(id, { <field>: val })}` for each of 12 fields (use actual field names from Account Field Registry); pass `readOnly={user.role === 'viewer'}` via `useAuthStore`; for `account_manager_id` field fetch users list and pass as `options`; use `useMutation` + `queryClient.invalidateQueries(['account', id])` on success
- [X] T016 [P] [US2] Update `client/src/pages/contacts/ContactDetailPage.jsx` — wire all 16 Contact InlineFields with `onSave={(val) => updateContact(id, { <field>: val })}`; pass `readOnly={user.role === 'viewer'}`; for `account_id` field fetch accounts list and pass as options; use mutation + query invalidation
- [X] T017 [P] [US2] Update `client/src/pages/deals/DealDetailPage.jsx` — wire all Deal InlineFields with `onSave={(val) => updateDeal(id, { <field>: val })}`; conditional Lost Reason: `{deal.stage === 'lost' && <InlineField label="Lost Reason" field="lost_reason" ...>}`; for `our_services` use `<InlineMultiSelect>`; pass `readOnly={user.role === 'viewer'}`
- [X] T018 [P] [US2] Remove "Edit" button and modal invocation from `client/src/pages/accounts/AccountsPage.jsx` list view — remove edit state, AccountModal edit-mode import, and onSave edit handler; retain creation modal
- [X] T019 [P] [US2] Remove "Edit" button and modal invocation from `client/src/pages/contacts/ContactsPage.jsx` list view — same pattern as T018; retain creation modal
- [X] T020 [P] [US2] Remove "Edit" button and modal invocation from `client/src/pages/deals/DealsPage.jsx` list view — same pattern; retain creation modal

**Checkpoint**: Inline editing works across all 3 entity types. Modal Edit gone. Viewer role sees read-only fields.

---

## Phase 5: User Story 3 — Contact Photo Management (Priority: P3)

**Goal**: Admin/bdm can upload and delete contact photos on `/contacts/:id`. Avatar displays immediately after upload. Viewer sees avatar but no upload controls.

**Independent Test**: On `/contacts/:id` (as admin), click avatar → file picker opens → select JPEG under 5MB → avatar updates immediately. Click delete → placeholder shown. Select 6MB file → error shown, no upload.

### Implementation for User Story 3

- [X] T021 [US3] Update `client/src/pages/contacts/ContactDetailPage.jsx` — wire `<ContactAvatar>` with `canEdit={user.role !== 'viewer'}`, `onPhotoChange` handler that calls `uploadContactPhoto(id, file)` or `deleteContactPhoto(id)` and then `queryClient.invalidateQueries(['contact', id])`; pass `photoUrl={contact.photo_path ? \`/\${contact.photo_path}\` : null}`
- [X] T022 [US3] Add client-side validation in `client/src/components/detail/ContactAvatar.jsx` — before upload: reject files > 5MB (show inline error "File too large (max 5 MB)"); reject non-image MIME types (show "Please select a JPEG, PNG, or WebP image"); only call upload API if validation passes

**Checkpoint**: Photo upload and delete functional. Viewer cannot upload or delete. Size/type errors shown before upload.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize edge cases, enforce permissions consistently, run all quickstart test scenarios.

- [X] T023 Verify empty-state messages in all tab content components used in detail pages — each tab (Contacts, Deals, Notes, Attachments, Activities) must show a friendly empty message (e.g., "No contacts yet") when no related records exist; update tab content components as needed
- [X] T024 Verify breadcrumb/back navigation on all 3 detail pages — `← Accounts`, `← Contacts`, `← Deals` links render correctly and navigate to list; no broken navigation
- [X] T025 [P] Verify `Deal.stage === 'lost'` conditional (FR-016): when Stage inline-saves to 'lost', Lost Reason InlineField appears without page reload; when changed away from 'lost', Lost Reason disappears
- [ ] T026 Manual browser testing — run all 14 quickstart.md scenarios; explicitly time Scenario 9 (photo upload) to verify it completes within 3 seconds (SC-004); mark each scenario Pass/Fail; fix any failures found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Can run in parallel with Phase 1 (different files)
- **US1 (Phase 3)**: Requires Phase 1 (T001–T005) + Phase 2 (T006–T008) complete
- **US2 (Phase 4)**: Requires Phase 3 complete (detail pages exist to wire into)
- **US3 (Phase 5)**: Requires T011/T012 (ContactDetailPage exists) + T007 (photo API functions)
- **Polish (Phase 6)**: Requires Phases 3–5 complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 + Phase 2 — no US dependencies
- **US2 (P2)**: Depends on US1 complete — needs detail pages to exist before wiring
- **US3 (P3)**: Depends on US1's Contact detail page (T011, T012) — can start in parallel with US2

### Parallel Opportunities

Within Phase 1: T001–T005 can all run in parallel (different files).  
Within Phase 2: T006, T007, T008 can all run in parallel (different files).  
Within Phase 3: T009, T011, T013 can run in parallel; T010 after T009; T012 after T011; T014 after T013.  
Within Phase 4: T015, T016, T017 can run in parallel; T018, T019, T020 can run in parallel.  
Within Phase 5: T021 and T022 are sequential (T022 adds validation to component used by T021).  

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Shared components (T001–T005)
2. Complete Phase 2: API functions (T006–T008)
3. Complete Phase 3: All 3 detail pages — read-only field display + routing (T009–T014)
4. **STOP and VALIDATE**: Navigate to `/accounts/:id`, `/contacts/:id`, `/deals/:id` — see 2-column layout, tabs work, click navigation works
5. Continue to US2 if US1 validates

### Incremental Delivery

1. Phase 1 + Phase 2 → Shared infrastructure ready
2. Phase 3 (US1) → Detail pages with read-only fields, routing works
3. Phase 4 (US2) → Fields become editable, modal Edit removed
4. Phase 5 (US3) → Contact photo upload/delete
5. Phase 6 (Polish) → All 14 scenarios pass

---

## Notes

- No backend changes. No new npm packages.
- All ENUM options per field are in `data-model.md` field registries — use those exact values.
- Account, Contact, Deal modals (AccountModal, ContactModal, DealModal) are NOT deleted — only the "Edit" invocation is removed. They remain for creation.
- `user.role` comes from `useAuthStore()` hook already available in the project.
- Photo URL: backend returns `photo_path` as `"uploads/contacts/..."` — prepend `/` for display: `/uploads/contacts/...`.
- Toast notifications: use existing toast pattern already in the project (check how other mutations show errors).
- FR references: FR-001 to FR-026 in spec.md; task-to-FR mapping available in the analyze report.
