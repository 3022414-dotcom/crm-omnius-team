# Tasks: F-12 Data Model Patch

**Input**: Design documents from `specs/012-data-model-patch/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tests**: Ручное тестирование по quickstart.md (тесты не запрашивались)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Проверить что инфраструктура готова к работе

- [X] T001 Verify Docker containers running — `docker ps` must show `omnius_crm_db` and `omnius_crm_backend` both Up

---

## Phase 2: Foundational — DB Migration

**Purpose**: Единственная аддитивная миграция, которая блокирует все остальные шаги

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create migration file `server/migrations/1783641600000_f12_data_model_patch.js` with the following sections (in order):
  1. CREATE TYPE for all 10 new ENUMs: `location_enum`, `industry_enum`, `account_type_enum`, `account_size_enum`, `contact_source_enum`, `preferred_communication_enum`, `language_enum`, `deal_type_enum`, `deal_source_enum`, `currency_enum`
  2. Deal stage migration via temp column: CREATE TYPE `deal_stage_v2` (8 values: lead/qualifying/discovery/proposal/closing/contract/won/lost) → ADD COLUMN `stage_v2 deal_stage_v2` → UPDATE with CASE mapping (qualified→qualifying, negotiation→closing, others cast directly) → ALTER stage_v2 SET NOT NULL DEFAULT 'lead' → DROP COLUMN stage → RENAME stage_v2 TO stage → DROP TYPE deal_stage → RENAME TYPE deal_stage_v2 TO deal_stage
  3. accounts.industry migration: ADD COLUMN `industry_new industry_enum` (NULL for all rows) → DROP COLUMN industry → RENAME industry_new TO industry
  4. ADD COLUMNs for accounts: `type account_type_enum`, `location location_enum`, `size account_size_enum`, `is_target BOOLEAN NOT NULL DEFAULT FALSE`, `account_storage VARCHAR(500)`, `account_manager_id UUID REFERENCES users ON DELETE SET NULL`
  5. ADD COLUMNs for contacts: `telegram VARCHAR(255)`, `linkedin VARCHAR(500)`, `facebook VARCHAR(500)`, `email_corp VARCHAR(255)`, `email_personal VARCHAR(255)`, `location location_enum`, `language language_enum`, `preferred_communication preferred_communication_enum`, `birthday DATE`, `comments TEXT`, `source contact_source_enum`; then `UPDATE contacts SET email_corp = email`
  6. ADD COLUMNs for deals: `location location_enum`, `deal_type deal_type_enum`, `source deal_source_enum`, `project_domain industry_enum`, `description TEXT`, `our_services TEXT[]`, `deal_storage VARCHAR(500)`, `expected_start_date DATE`, `currency currency_enum NOT NULL DEFAULT 'RUB'`, `lost_reason TEXT`
  7. ADD COLUMNs for deal_contacts: `role VARCHAR(255)`, `comment TEXT`
  8. CREATE INDEX `idx_accounts_account_manager_id` ON accounts(account_manager_id)
  9. Implement `exports.down` that reverses all changes in reverse order
- [X] T003 Run migration and verify with two checks:
  1. Schema check: `docker exec omnius_crm_db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\d accounts"` — output must include type, location, industry (udt_name=account_type_enum), size, is_target, account_storage, account_manager_id
  2. Stage migration check: `docker exec omnius_crm_db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT DISTINCT stage FROM deals;"` — must return only values from the new 8-value set (lead/qualifying/discovery/proposal/closing/contract/won/lost); must NOT contain 'qualified' or 'negotiation'. If old values appear — migration failed, do NOT proceed to T004.

**Checkpoint**: Migration applied — backend controllers and frontend can now be updated

---

## Phase 3: User Story 1 — Enriched Account Card (Priority: P1) 🎯 MVP

**Goal**: Менеджер создаёт/редактирует аккаунт со всеми полями из ТЗ v2.0 (тип, локация, отрасль, размер, is_target, account_storage, account_manager); карточка отображает все новые поля.

**Independent Test**: Создать аккаунт с type="Client", location="Russia", industry="FinTech", size="51-200", is_target=true, account_storage="https://drive.google.com/test", account_manager=любой пользователь → открыть карточку → все поля отображены.

### Implementation for User Story 1

- [X] T004 [US1] Update `server/controllers/accountsController.js`:
  - Add to `ACCOUNT_FIELDS` constant (base DB columns only — used in INSERT/UPDATE RETURNING): `type, location, industry, size, is_target, account_storage, account_manager_id`. ⚠️ Do NOT add `account_manager_name` here — it is a JOIN-derived field, not a DB column.
  - Add to `ACCOUNT_WITH_COUNTS` subquery (used in SELECT list/get queries): `a.type, a.location, a.industry, a.size, a.is_target, a.account_storage, a.account_manager_id`; add LEFT JOIN `users am ON a.account_manager_id = am.id` and include `am.id AS account_manager_uid, am.name AS account_manager_name`
  - Add new fields to `UPDATABLE_FIELDS` array: `'type', 'location', 'industry', 'size', 'is_target', 'account_storage', 'account_manager_id'`
  - Update `createAccount`: destructure new fields from req.body, include in INSERT VALUES
  - Update `updateAccount`: dynamic UPDATE already uses UPDATABLE_FIELDS, just adding the new names is sufficient
- [X] T005 [P] [US1] Update `client/src/components/modals/AccountModal.jsx`:
  - Add `getUsers` import from `../../api/users` and `useQuery` to load users list (`queryKey: ['users']`)
  - Extend zod schema: add `type`, `location`, `industry`, `size` (all z.string().optional()), `is_target` (z.boolean().default(false)), `account_storage` (z.string().optional()), `account_manager_id` (z.string().optional())
  - Update `reset()` defaultValues to include new fields (empty strings / false for is_target)
  - Add form fields: Type `<select>` (Prospect/Client/Partner/Vendor), Location `<select>` (Russia/Belorussia/Kazakhstan/Armenia), Industry `<select>` (8 values from industry_enum), Size `<select>` (1-50/51-200/201-1000/1000+), Target `<input type="checkbox">` for is_target, Account Storage `<input type="text">`, Account Manager `<select>` populated from users query
- [X] T006 [US1] Update `client/src/pages/accounts/AccountDetail.jsx`:
  - Display new fields in the account info section: Type, Location, Industry, Size, Target (checkbox badge), Account Storage (clickable link if set), Account Manager (name from account.account_manager_name or account.account_manager?.name)
  - Show only non-null fields; use appropriate labels matching ТЗ v2.0

**Checkpoint**: User Story 1 complete — account form has 7 new fields, detail page shows them all

---

## Phase 4: User Story 2 — Enriched Contact Card (Priority: P2)

**Goal**: Менеджер дополняет контакт соцсетями, двумя email-адресами, предпочтительным каналом связи, локацией, языком, датой рождения, источником и комментарием; карточка отображает все непустые поля.

**Independent Test**: Создать контакт с telegram="@handle", email_corp="work@example.com", email_personal="personal@example.com", preferred_communication="Telegram", location="Russia", source="Referral" → открыть карточку → все поля отображены.

### Implementation for User Story 2

- [X] T007 [US2] Update `server/controllers/contactsController.js`:
  - Update `CONTACT_FIELDS` constant: add `telegram, linkedin, facebook, email_corp, email_personal, location, language, preferred_communication, birthday, comments, source` to the SELECT list for getContactById (which uses explicit JOIN); update listContacts JOIN query similarly
  - Update `createContact`: destructure all new fields from req.body; add to INSERT columns and VALUES
  - Update `updateContact` (or equivalent): accept all new fields in PATCH body and include in UPDATE SET
- [X] T008 [P] [US2] Update `client/src/components/modals/ContactModal.jsx`:
  - Extend zod schema with 11 new fields: `telegram`, `linkedin`, `facebook`, `email_corp`, `email_personal` (all z.string().optional()), `location` (z.string().optional()), `language` (z.string().optional()), `preferred_communication` (z.string().optional()), `birthday` (z.string().optional()), `comments` (z.string().optional()), `source` (z.string().optional())
  - Update `reset()` defaultValues to include all new fields
  - Add form sections for: Social (Telegram, LinkedIn, Facebook inputs), Email corp + Email personal inputs, Location select, Language select, Preferred Communication select, Birthday date input, Comments textarea, Source select
- [X] T009 [US2] Update `ContactDetail` function in `client/src/pages/contacts/ContactsPage.jsx`:
  - Display all non-empty new contact fields: Telegram (link to t.me/handle if set), LinkedIn (link), Facebook (link), Email corp, Email personal, Location, Language, Preferred Communication, Birthday (formatted date), Comments, Source

**Checkpoint**: User Story 2 complete — contact form has 11 new fields, detail shows non-empty ones

---

## Phase 5: User Story 3 — Enriched Deal Card + Stage Alignment (Priority: P3)

**Goal**: Менеджер работает с 8 стейджами, указывает тип/источник/домен/услуги/валюту; при проигрыше обязательно заполняет lost_reason; Kanban показывает 8 колонок с полной карточкой; deal_contacts имеет поля role и comment.

**Independent Test**: Создать сделку со stage="discovery", deal_type="New Client", currency="EUR", our_services=["Consulting","POC"] → сделка появляется в колонке Discovery на Kanban; попытка сохранить stage="lost" без lost_reason → ошибка валидации.

### Implementation for User Story 3

- [X] T010 [US3] Update `server/controllers/dealsController.js`:
  - Update `VALID_STAGES` constant to 8 values: `['lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost']`
  - Update `createDeal`: add 10 new fields to destructuring and INSERT; add lost_reason validation: `if (stage === 'lost' && !lost_reason?.trim()) return res.status(400).json({ error: 'lost_reason обязателен при stage = lost' })`
  - Update `updateDeal`: same lost_reason validation when stage is being set to 'lost'; add new fields to UPDATABLE_FIELDS equivalent
  - Update `getDealById` SELECT: add all 10 new deal fields (location, deal_type, source, project_domain, description, our_services, deal_storage, expected_start_date, currency, lost_reason)
  - Update `listDeals` SELECT: add expected_start_date, currency to the list response
  - Update `getKanbanDeals` SELECT: add `d.expected_start_date` to query and to the board push object
  - Add `updateDealContact` function: `async function updateDealContact(req, res) { const { id: dealId, contactId } = req.params; const { role, comment } = req.body; await pool.query('UPDATE deal_contacts SET role=$1, comment=$2 WHERE deal_id=$3 AND contact_id=$4', [role||null, comment||null, dealId, contactId]); res.json({ deal_id: dealId, contact_id: contactId, role: role||null, comment: comment||null }); }` + export it
- [X] T011 [US3] Update `server/routes/deals.js`: add `const { ..., updateDealContact } = require('../controllers/dealsController')` and route `router.patch('/:id/contacts/:contactId', requireRole(['admin', 'bdm']), updateDealContact)`
- [X] T012 [P] [US3] Update `client/src/components/modals/DealModal.jsx`:
  - Update `z.enum` for stage to 8 values: `['lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost']`
  - Add `superRefine` or `.refine()` to schema: when stage='lost', lost_reason must be non-empty
  - Extend schema with 10 new fields: `location`, `deal_type`, `source`, `project_domain`, `description`, `our_services` (z.array(z.string()).default([])), `deal_storage`, `expected_start_date`, `currency` (default 'RUB'), `lost_reason`
  - Update defaultValues and reset() to include new fields
  - Update stage `<select>` options to 8 values with Russian labels: Lead/Qualifying/Discovery/Proposal/Closing/Contract/Won/Lost
  - Add form fields: Location select, Deal Type select, Source select, Project Domain select, Description textarea, Our Services checkboxes (Workshop/Webinar/Consulting/POC/Development/Accelerator/Performance), Deal Storage text input, Expected Start Date date input, Currency select (RUB/EUR/USD), Lost Reason textarea (render only when watch('stage')==='lost')
  - Use `useWatch` or `watch` from react-hook-form to conditionally show Lost Reason field
- [X] T013 [P] [US3] Update `client/src/pages/kanban/KanbanPage.jsx`:
  - Update `STAGES` constant to 8 objects: `{ id: 'lead', label: 'Лид' }, { id: 'qualifying', label: 'Квалификация' }, { id: 'discovery', label: 'Дискавери' }, { id: 'proposal', label: 'Предложение' }, { id: 'closing', label: 'Закрытие' }, { id: 'contract', label: 'Контракт' }, { id: 'won', label: 'Выигран' }, { id: 'lost', label: 'Проигран' }`
  - Update `DealCard` component: add `{deal.owner?.name && <p className="text-xs text-muted-foreground truncate">{deal.owner.name}</p>}` and `{deal.expected_start_date && <p className="text-xs text-muted-foreground">{new Date(deal.expected_start_date).toLocaleDateString('ru-RU')}</p>}`
  - Update `DragOverlay` div: add owner name and expected_start_date display to match DealCard
- [X] T014 [US3] Update `DealDetail` function in `client/src/pages/deals/DealsPage.jsx`:
  - Add display of all new deal fields (location, deal_type, source, project_domain, description, our_services as comma-joined list, deal_storage as link, expected_start_date formatted, currency alongside value, lost_reason when present)
  - Update the contacts section (deal.contacts array): add Role and Comment columns to the contacts table; add edit button that opens inline edit for role/comment with PATCH call to `/api/v1/deals/${id}/contacts/${contactId}`; import or inline `updateDealContact` API call
  - Add `updateDealContact` to `client/src/api/deals.js`: `export const updateDealContact = (dealId, contactId, data) => apiFetch(\`/api/v1/deals/${dealId}/contacts/${contactId}\`, { method: 'PATCH', body: JSON.stringify(data) })`

**Checkpoint**: User Story 3 complete — 8 Kanban columns, deal form has 10 new fields, lost_reason validated, deal_contacts has role+comment edit

---

## Phase 6: Polish & Validation

**Purpose**: Перезапустить бэкенд и пройти все сценарии quickstart.md

- [X] T015 Restart backend to reload updated controllers: `docker restart omnius_crm_backend` then verify `docker logs omnius_crm_backend --tail=20` shows no errors
- [ ] T016 Run all 10 quickstart.md scenarios manually in browser — mark each as passed (Scenario 1: migration; 2: stage mapping; 3: industry NULL; 4: email_corp; 5: account new fields; 6: deal discovery; 7: lost_reason 400; 8: kanban 8 cols + card; 9: existing account; 10: deal_contacts role+comment)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **User Stories (Phase 3–5)**: All depend on Phase 2 (migration must be applied)
  - US1 (Phase 3) has no dependency on US2/US3 — can start after Phase 2
  - US2 (Phase 4) has no dependency on US1/US3 — can start after Phase 2
  - US3 (Phase 5) has no dependency on US1/US2 — can start after Phase 2
- **Polish (Phase 6)**: Depends on all desired user stories complete

### Within User Story 3

- T010 (dealsController) must complete before T011 (route importing the handler)
- T010 must complete before T014 (DealDetail calls the PATCH endpoint)
- T012 (DealModal) and T013 (KanbanPage) can run in parallel with T010/T011 (different files)

### Parallel Opportunities

| Story | Parallel group | Files |
|-------|---------------|-------|
| US1 | T004 ‖ T005 | accountsController.js ‖ AccountModal.jsx |
| US2 | T007 ‖ T008 | contactsController.js ‖ ContactModal.jsx |
| US3 | T012 ‖ T013 | DealModal.jsx ‖ KanbanPage.jsx |

All three stories (Phase 3, 4, 5) can run in parallel after Phase 2 completes.

---

## Parallel Example: User Story 1

```bash
# After T002+T003 complete, launch in parallel:
Task T004: "Update accountsController.js with 7 new fields"
Task T005: "Update AccountModal.jsx with 7 new form fields"
# Then sequentially:
Task T006: "Update AccountDetail.jsx to display new fields" (depends on T004 for API response shape)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Migration (T002–T003) ← критический путь
3. Complete Phase 3: User Story 1 (T004–T006)
4. **STOP and VALIDATE**: test account create/edit/view with new fields
5. Proceed to US2 and US3

### Incremental Delivery

1. Phase 2 (migration) → foundation ready
2. Phase 3 (US1 accounts) → test accounts; deploy
3. Phase 4 (US2 contacts) → test contacts; deploy
4. Phase 5 (US3 deals) → test deals + kanban; deploy
5. Phase 6 (polish) → full validation pass

---

## Notes

- `[P]` tasks = different files, no code dependencies between them
- Migration (T002) is the longest task — all SQL must be correct before running T003
- `our_services` is stored as `TEXT[]` in PostgreSQL — pg driver returns it as JS array automatically
- For AccountModal (T005): `getUsers()` API call exists at `client/src/api/users.js` — use `useQuery(['users'], getUsers)` to populate account_manager_id select
- For DealModal lost_reason (T012): use `const watchedStage = watch('stage')` + conditional render `{watchedStage === 'lost' && <LostReasonField />}`
- T002 down migration must handle reverse order: drop deal_contacts columns → drop deals columns → drop contacts columns → drop accounts columns → drop accounts.industry ENUM column (restore to VARCHAR) → restore original deal_stage (no data loss guarantee on down)
