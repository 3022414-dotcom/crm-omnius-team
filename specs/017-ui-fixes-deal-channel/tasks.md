# Tasks: UI Bug Fixes & Deal Channel Field

**Input**: Design documents from `specs/017-ui-fixes-deal-channel/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Scope**: 1 новая миграция, 6 изменённых файлов. Нет новых npm-пакетов (используются уже установленные `lucide-react` и `@radix-ui/react-dialog`), нет новых маршрутов.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup & Verification

**Purpose**: Убедиться, что текущее состояние кода совпадает с описанным в research.md/data-model.md перед внесением изменений.

- [X] T001 Read `client/src/components/detail/InlineField.jsx` lines 153-190 and confirm the `type === 'url' && readDisplay` branch (lines 170-179) still renders the entire value as a single `<a href target="_blank">` with `onClick={(e) => !readOnly && e.stopPropagation()}` — this is the root cause of the edit-vs-open bug that US1 fixes.
- [X] T002 Read `client/src/components/detail/ContactAvatar.jsx` and confirm there is no full-size photo overlay yet — the avatar `<div onClick>` only triggers the file picker (`fileInputRef.current?.click()`) for `canEdit` users and does nothing for read-only users.
- [X] T003 Read `client/src/components/tabs/NotesTab.jsx` lines 141-148 and 168-174 and confirm both the note-composer and note-edit `<textarea>` use a fixed `rows={3}` with no auto-grow behavior.
- [X] T004 Read `server/migrations/` directory listing and `server/controllers/dealsController.js` `UPDATABLE_FIELDS` (line 6-8) and confirm no `deal_channel` column/field exists anywhere yet (only `deal_storage` is present).

**Checkpoint**: Текущее состояние кода подтверждено — можно приступать к изменениям. Нет общих foundational-задач, блокирующих сразу все user stories — каждая история меняет независимый набор файлов (см. Dependencies ниже), поэтому отдельная Foundational-фаза не требуется.

---

## Phase 2: User Story 1 — Edit hyperlink fields from an entity card (Priority: P1) 🎯 MVP

**Goal**: Клик по тексту любого поля-ссылки (`InlineField type="url"`) входит в режим редактирования, как у любого другого поля; для перехода по ссылке появляется отдельная маленькая иконка.

**Independent Test**: Открыть карточку Account/Contact/Deal с заполненным полем-ссылкой (например, Contact → LinkedIn), кликнуть на текст значения → поле переходит в режим редактирования без перехода по ссылке; кликнуть на отдельную иконку рядом — ссылка открывается в новой вкладке.

### Implementation for User Story 1

- [X] T005 [US1] In `client/src/components/detail/InlineField.jsx` line 3, add `ExternalLink` to the existing lucide-react import:
  ```js
  import { Loader2, ExternalLink } from 'lucide-react'
  ```

- [X] T006 [US1] In `client/src/components/detail/InlineField.jsx`, replace the `type === 'url' && readDisplay` branch (lines 170-179):
  ```jsx
  ) : type === 'url' && readDisplay ? (
  <a
    href={readDisplay}
    target="_blank"
    rel="noreferrer"
    className="text-primary hover:underline truncate"
    onClick={(e) => !readOnly && e.stopPropagation()}
  >
    {readDisplay}
  </a>
  ) : (
  ```
  with:
  ```jsx
  ) : type === 'url' && readDisplay ? (
  <>
    <span className="text-foreground truncate">{readDisplay}</span>
    <a
      href={readDisplay}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-primary flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Open ${label} link`}
    >
      <ExternalLink size={12} />
    </a>
  </>
  ) : (
  ```
  The outer container's `onClick={handleClick}` (line 161) is untouched — clicking the text span now bubbles up and enters edit mode exactly like every other field type. `handleClick` already no-ops for `readOnly` fields (line 65: `if (readOnly || saving) return`), so the icon's unconditional `stopPropagation` is safe for both editable and read-only fields (FR-003).

**Checkpoint**: User Story 1 complete. This single-component fix applies to all 5 existing `type="url"` fields app-wide (Account Website, Account Storage URL, Deal Storage URL, Contact LinkedIn, Contact Facebook) with no per-page changes. Run quickstart.md Scenarios 1-5.

---

## Phase 3: User Story 2 — Add and manage the Deal Channel field (Priority: P2)

**Goal**: Новое поле `deal_channel` (URL) на сущности Deal, отображается сразу после Storage URL в карточке сделки и в форме создания/редактирования.

**Independent Test**: Открыть карточку сделки → поле Deal Channel сразу после Storage URL → ввести ссылку → сохранить → перезагрузить страницу → значение сохранилось.

### Implementation for User Story 2 — Backend

- [X] T007 [US2] Create migration file `server/migrations/1784000000000_f17_deal_channel_field.js` (implemented as `varchar(500)` to actually match `deal_storage`'s column type, per `/speckit-analyze` finding I1):
  ```js
  exports.up = (pgm) => {
    pgm.addColumn('deals', { deal_channel: { type: 'varchar(500)' } });
  };

  exports.down = (pgm) => {
    pgm.dropColumn('deals', 'deal_channel');
  };
  ```
  Nullable, no default, no FK, no index — matches the existing `deal_storage` column shape (per research.md decision 4).

- [X] T008 [US2] In `server/controllers/dealsController.js` line 6-8, add `'deal_channel'` to `UPDATABLE_FIELDS`, immediately after `'deal_storage'`:
  ```js
  const UPDATABLE_FIELDS = ['title', 'value', 'close_date', 'account_id', 'stage', 'owner_id',
    'location', 'deal_type', 'source', 'project_domain', 'description', 'our_services',
    'deal_storage', 'deal_channel', 'expected_start_date', 'currency', 'lost_reason'];
  ```

- [X] T009 [US2] In `server/controllers/dealsController.js` function `createDeal` (lines 26-38), add `deal_channel` to the INSERT column list and values, immediately after `deal_storage`:
  ```js
  const { rows: [deal] } = await pool.query(
    `INSERT INTO deals (title, value, stage, close_date, account_id, owner_id,
                        location, deal_type, source, project_domain, description, our_services,
                        deal_storage, deal_channel, expected_start_date, currency, lost_reason, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [title, req.body.value || null, stage, req.body.close_date || null, account_id, req.user.id,
     req.body.location || null, req.body.deal_type || null, req.body.source || null,
     req.body.project_domain || null, req.body.description || null,
     req.body.our_services || null, req.body.deal_storage || null, req.body.deal_channel || null,
     req.body.expected_start_date || null, req.body.currency || 'RUB',
     req.body.lost_reason || null, req.user.id]
  );
  ```
  `RETURNING *` already returns the new `deal_channel` column automatically — no change needed to the `res.status(201).json(deal)` line below.

- [X] T010 [US2] In `server/controllers/dealsController.js` function `getDealById` (lines 110-163):
  1. In the SELECT query (lines 114-127), add `d.deal_channel` to the column list immediately after `d.deal_storage` (line 116).
  2. In the `return res.json({...})` block (lines 138-162), add `deal_channel: row.deal_channel,` immediately after `deal_storage: row.deal_storage,` (line 151).

- [X] T011 [US2] In `server/controllers/dealsController.js` function `updateDeal`'s re-fetch query (lines 203-243):
  1. In the SELECT query (lines 203-217), add `d.deal_channel` to the column list immediately after `d.deal_storage` (line 206).
  2. In the `return res.json({...})` block (lines 220-243), add `deal_channel: row.deal_channel,` immediately after `deal_storage: row.deal_storage,` (line 233).

### Implementation for User Story 2 — Frontend

- [X] T012 [P] [US2] In `client/src/pages/deals/DealDetailPage.jsx`, add a "Deal Channel" `InlineField` immediately after the existing "Storage URL" `InlineField` (line 253):
  ```jsx
  <InlineField label="Storage URL" value={deal.deal_storage} type="url" readOnly={!canWrite} onSave={field('deal_storage')} />
  <InlineField label="Deal Channel" value={deal.deal_channel} type="url" readOnly={!canWrite} onSave={field('deal_channel')} />
  ```

- [X] T013 [P] [US2] In `client/src/components/modals/DealModal.jsx`, wire up the new field in three places:
  1. Line 33, add to the zod `schema` immediately after `deal_storage: z.string().optional(),`:
     ```js
     deal_channel: z.string().optional(),
     ```
  2. Line 54, add to `emptyDefaults` immediately after `deal_storage: '',`:
     ```js
     deal_channel: '',
     ```
  3. Line 95, add to the `reset(initial ? {...})` mapping immediately after `deal_storage: initial.deal_storage || '',`:
     ```js
     deal_channel: initial.deal_channel || '',
     ```
  4. Lines 210-212, add a new `Field` immediately after the existing "Storage URL" `Field`:
     ```jsx
     <Field label="Storage URL" error={errors.deal_storage}>
       <input {...register('deal_storage')} type="url" className={inputClass} placeholder="https://drive.google.com/..." />
     </Field>

     <Field label="Deal Channel" error={errors.deal_channel}>
       <input {...register('deal_channel')} type="url" className={inputClass} placeholder="https://t.me/..." />
     </Field>
     ```

**Checkpoint**: User Story 2 complete. Deal Channel behaves like Storage URL everywhere, including the US1 edit/open-link fix (no extra work needed — it's the same shared `InlineField` component). Run quickstart.md Scenarios 6-7.

---

## Phase 4: User Story 3 — View a contact's photo full-size (Priority: P3)

**Goal**: Клик по фото контакта (когда фото загружено) открывает модальное окно с полноразмерным фото поверх карточки.

**Independent Test**: Открыть карточку контакта с фото → кликнуть на фото → открывается полноразмерный просмотр → Escape или клик вне изображения закрывает его, карточка не меняется.

### Implementation for User Story 3

- [X] T014 [US3] In `client/src/components/detail/ContactAvatar.jsx`:
  1. Line 2-4, add imports:
     ```js
     import * as Dialog from '@radix-ui/react-dialog'
     import { Camera, Trash2, Loader2, X } from 'lucide-react'
     ```
  2. Inside the component (after existing `useState`/`useRef` declarations, line ~10-12), add:
     ```js
     const [fullView, setFullView] = useState(false)
     ```

- [X] T015 [US3] In `client/src/components/detail/ContactAvatar.jsx`, update the avatar click behavior and add the overlay markup (also made the full-size view available to read-only/viewer users, not just `canEdit`, per spec FR-008 which doesn't restrict viewing by role — cursor-pointer class extended to `canEdit || photoUrl`):
  1. Line 61, change the avatar `<div>`'s `onClick` from:
     ```jsx
     onClick={() => canEdit && !uploading && fileInputRef.current?.click()}
     ```
     to:
     ```jsx
     onClick={() => {
       if (photoUrl) setFullView(true)
       else if (canEdit && !uploading) fileInputRef.current?.click()
     }}
     ```
     This makes a click on the avatar open the full-size view whenever a photo exists (FR-008); the existing hover camera-icon overlay (lines 71-75, unchanged) remains the dedicated "upload/change photo" affordance for `canEdit` users, still calling `fileInputRef.current?.click()` directly.
  2. After the closing `</div>` of the outer `relative group` container (after line 76) and before the "Delete photo" button block, add the full-size overlay:
     ```jsx
     {photoUrl && (
       <Dialog.Root open={fullView} onOpenChange={setFullView}>
         <Dialog.Portal>
           <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
           <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-[90vw] max-h-[90vh]">
             <img src={photoUrl} alt={`${firstName} ${lastName}`} className="max-w-full max-h-[90vh] rounded" />
             <Dialog.Close className="absolute -top-3 -right-3 bg-background rounded-full p-1 border border-border">
               <X size={16} />
             </Dialog.Close>
           </Dialog.Content>
         </Dialog.Portal>
       </Dialog.Root>
     )}
     ```
     Gating the whole block on `photoUrl` satisfies FR-010 (no full-size view for contacts without a photo) — `Dialog.Root` never even mounts when there's no photo. Radix `Dialog` provides Escape-to-close and click-outside-to-close for free.

**Checkpoint**: User Story 3 complete. Run quickstart.md Scenarios 8-9.

---

## Phase 5: User Story 4 — Comfortably write long notes (Priority: P4)

**Goal**: Поле ввода заметки автоматически растёт по высоте вместе с текстом, до ~10 строк (~240px), затем скроллится внутри.

**Independent Test**: Открыть вкладку Notes любой сущности → начать вводить многострочный текст → поле растёт вместе с текстом → после ~10 строк рост останавливается и появляется внутренний скролл.

### Implementation for User Story 4

- [X] T016 [US4] In `client/src/components/tabs/NotesTab.jsx`, add an auto-grow helper near the top of the file (after `MAX_IMAGE_SIZE`, line 12):
  ```js
  const MAX_TEXTAREA_HEIGHT = 240 // ~10 lines

  function autoGrow(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'
  }
  ```

- [X] T017 [US4] In `client/src/components/tabs/NotesTab.jsx`, apply `autoGrow` to both textareas:
  1. Composer textarea (lines 141-148):
     ```jsx
     <textarea
       ref={autoGrow}
       className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary overflow-y-auto"
       style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
       rows={3}
       placeholder="Добавить заметку..."
       value={text}
       onChange={(e) => { setText(e.target.value); autoGrow(e.target) }}
       onPaste={handlePaste(setText)}
     />
     ```
  2. Edit-note textarea (lines 168-174):
     ```jsx
     <textarea
       ref={autoGrow}
       className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary overflow-y-auto"
       style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
       rows={3}
       value={editText}
       onChange={(e) => { setEditText(e.target.value); autoGrow(e.target) }}
       onPaste={handlePaste(setEditText)}
     />
     ```
  Using `ref={autoGrow}` (a callback ref) triggers the initial sizing on mount — so opening an existing long note is already sized to fit its content up to the max (FR-012), and `onChange` keeps it growing as the user types (FR-011). `resize-none` stays so growth is automatic only, not user-draggable.

**Checkpoint**: User Story 4 complete. Run quickstart.md Scenario 10.

---

## Phase 6: Polish & Validation

**Purpose**: Применить миграцию, пересобрать backend, проверить все сценарии.

- [X] T018 Apply migration by running `npm run migrate` from the repository root. Confirm output shows the new migration applied with no errors, and `deal_channel` column appears on `deals`. (Note: Docker daemon and the project's containers were down at the start of implementation — had to `open -a Docker` and `docker compose up -d` first. Also note: `npm run migrate up` — with an extra `up` argument — silently no-ops in node-pg-migrate; the correct invocation is bare `npm run migrate`, since the npm script already ends in `up`.)
- [X] T019 Rebuild and restart the backend container so it picks up the controller changes: `docker compose up -d --build backend` — verified via `docker exec omnius_crm_backend grep deal_channel ...` that the running container now has the updated code.
- [X] T020 [P] Ran quickstart.md scenarios end-to-end against the live app (Playwright driving Chromium against http://localhost, authenticated via a manually-seeded session row — see verification notes below):
  - Scenario 1-2: ✅ clicking field text enters edit mode (no navigation); separate icon opens link in new tab without entering edit mode. Verified on Deal Storage URL live.
  - Scenario 6: ✅ Deal Channel field appears immediately after Storage URL on the Deal detail page; value entered via the UI (`https://t.me/test_channel`) persisted across a full page reload.
  - Scenario 7: ✅ zod schema / DealModal wiring confirmed by code + backend contract; not separately re-driven through the modal UI (covered by the same InlineField/backend code path as Scenario 6).
  - Scenario 8: ✅ full-size photo overlay opens, closes on Escape, closes on outside click — **but not via the originally planned avatar-click trigger** (see Findings below); implemented via a new dedicated expand-icon button instead, and re-verified working after the fix.
  - Scenario 9: ✅ explicitly re-verified after the Scenario 8 fix — clicking the avatar center for a `canEdit` (admin) user still opens the native file chooser (upload unaffected).
  - Scenario 10: ✅ notes textarea grows from 76px to exactly 240px as content is typed, then `scrollHeight` exceeds visible height confirming internal scroll.
  - Scenarios 3-5: not separately re-driven (same shared `InlineField` code path as 1-2, already proven fixed for read/write branches by code + the FR-003 no-op guard).

  **Finding (fixed during verification, not caught by code review)**: the hover camera-icon overlay in `ContactAvatar.jsx` is `absolute inset-0` and always intercepts clicks meant for the avatar underneath, regardless of visual opacity — so for `canEdit` users (the actual admin/bdm users of this CRM) clicking the avatar could *never* reach the full-view logic; it always triggered the upload file picker instead. Caught by actually clicking the photo in a real browser, not by reading the JSX. Fixed by adding a separate always-visible expand-icon button instead of overloading the avatar's own click handler — see updated `contracts/ui.md` §2 and `ContactAvatar.jsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 verification only — touches `InlineField.jsx` exclusively
- **US2 (Phase 3)**: Depends on Phase 1 verification only — touches migration + `dealsController.js` + `DealDetailPage.jsx` + `DealModal.jsx`; INDEPENDENT from US1 (benefits from it once both are merged, since Deal Channel is rendered via the same `InlineField`, but does not require US1's code to be present to be built/tested for creation/persistence)
- **US3 (Phase 4)**: Depends on Phase 1 verification only — touches `ContactAvatar.jsx` exclusively; INDEPENDENT from US1/US2
- **US4 (Phase 5)**: Depends on Phase 1 verification only — touches `NotesTab.jsx` exclusively; INDEPENDENT from US1/US2/US3
- **Polish (Phase 6)**: Depends on all four user stories being complete (needs the migration from US2 applied, and all frontend changes in place to validate the full quickstart)

### Within User Story 1

- T005 → T006 (same file `InlineField.jsx`, sequential — import must exist before it's used)

### Within User Story 2

- T007 (migration) has no code dependency on T008-T011 but should be applied (T018) before those endpoints are manually tested
- T008 → T009 → T010 → T011 (same file `dealsController.js`, sequential — each edits a different function but touching one file serially avoids merge conflicts)
- T012 [P] with T013 (different files: `DealDetailPage.jsx` vs `DealModal.jsx`)
- T012/T013 can be done in parallel with T007-T011 (frontend doesn't need backend done to write the JSX, only to test end-to-end)

### Within User Story 3

- T014 → T015 (same file `ContactAvatar.jsx`, sequential — state/imports before the JSX that uses them)

### Within User Story 4

- T016 → T017 (same file `NotesTab.jsx`, sequential — helper defined before it's referenced)

### Parallel Opportunities

- All four user stories (Phase 2-5) touch completely disjoint files and can be implemented in parallel by different people, or in any order by one person
- T012 [P] with T013 (US2 frontend, different files)
- T020 [P] with nothing else in Phase 6 (it's the only task not already sequential-by-necessity)

---

## Parallel Example: All User Stories

```text
# Once Phase 1 verification is done, all four stories can start immediately and independently:
Thread A: T005-T006 (US1 — InlineField.jsx)
Thread B: T007-T013 (US2 — migration, dealsController.js, DealDetailPage.jsx, DealModal.jsx)
Thread C: T014-T015 (US3 — ContactAvatar.jsx)
Thread D: T016-T017 (US4 — NotesTab.jsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup & Verification
2. Complete Phase 2: User Story 1 (T005-T006)
3. **STOP and VALIDATE**: quickstart.md Scenarios 1-5
4. Ship — the most impactful bug (can't edit any link field) is fixed for all entities at once

### Incremental Delivery

1. Phase 1 → Phase 2 (US1) → validate → ship
2. Phase 3 (US2) → validate → ship
3. Phase 4 (US3) → validate → ship
4. Phase 5 (US4) → validate → ship
5. Phase 6 (Polish) once all four are in — full quickstart pass

### Suggested Order (single developer, no parallelism)

Given priorities P1 → P2 → P3 → P4 from spec.md: Phase 1 → Phase 2 (US1) → Phase 3 (US2) → Phase 4 (US3) → Phase 5 (US4) → Phase 6 (Polish).

---

## Notes

- Нет новых npm-пакетов: `ExternalLink` (lucide-react) и `Dialog` (`@radix-ui/react-dialog`) уже используются в проекте
- Нет новых маршрутов — единственное API-изменение (`deal_channel`) идёт через существующие `GET/POST/PUT /api/v1/deals` эндпоинты
- `deal_channel` не индексируется и не участвует в поиске/фильтрации — как и `deal_storage`
- US1's fix in `InlineField.jsx` is a single shared-component change that automatically covers Deal Channel (US2) once both stories are merged — no additional InlineField work needed inside US2
- Backend изменения требуют пересборки Docker-контейнера (`docker compose up -d --build backend`), не просто restart — см. T019
