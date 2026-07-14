# Tasks: Entity Field Fixes — Deal, Contact, Account

**Input**: Design documents from `specs/015-entity-fields-fix/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Scope**: 9 файлов (1 новый, 8 изменённых). Нет новых npm-пакетов, нет новых маршрутов.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup & Verification

**Purpose**: Убедиться, что текущее состояние кода совпадает с ожидаемым перед внесением изменений.

- [X] T001 Read `server/migrations/` and confirm NO `created_by_id` column exists yet in deals/accounts/contacts tables (check both migration files to understand current schema)
- [X] T002 Read `server/routes/users.js` and confirm `router.get('/', requireRole(['admin']), listUsers)` — ограничение admin присутствует (будет снято в Phase 2)
- [X] T003 Read `server/controllers/dealsController.js` function `createDeal` and confirm `created_by_id` is absent from the INSERT query (only `owner_id: req.user.id` is present)

**Checkpoint**: Текущее состояние кода подтверждено — можно приступать к изменениям.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Фундаментальные изменения, которые должны быть выполнены до любых user story. Миграция необходима перед изменениями контроллеров; изменение роутинга users — перед фронтендом.

**⚠️ CRITICAL**: Задачи US1 и US2 не начинаются до завершения этой фазы.

- [X] T004 [P] Create migration file `server/migrations/1783814400000_f15_entity_fields_fix.js` with the following content:
  ```js
  exports.up = (pgm) => {
    pgm.addColumn('deals',    { created_by_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' } });
    pgm.addColumn('accounts', { created_by_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' } });
    pgm.addColumn('contacts', { created_by_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' } });
    pgm.createIndex('deals',    'created_by_id', { ifNotExists: true });
    pgm.createIndex('accounts', 'created_by_id', { ifNotExists: true });
    pgm.createIndex('contacts', 'created_by_id', { ifNotExists: true });
  };
  exports.down = (pgm) => {
    pgm.dropIndex('deals',    'created_by_id', { ifExists: true });
    pgm.dropIndex('accounts', 'created_by_id', { ifExists: true });
    pgm.dropIndex('contacts', 'created_by_id', { ifExists: true });
    pgm.dropColumn('deals',    'created_by_id');
    pgm.dropColumn('accounts', 'created_by_id');
    pgm.dropColumn('contacts', 'created_by_id');
  };
  ```

- [X] T005 [P] In `server/routes/users.js`, remove `requireRole(['admin'])` from `router.get('/')`. Change:
  ```js
  router.get('/', requireRole(['admin']), listUsers);
  ```
  to:
  ```js
  router.get('/', listUsers);
  ```
  (The route is already protected by global `requireAuth` middleware on the Express app.)

**Checkpoint**: Миграция создана (будет применена вручную), доступ к GET /api/v1/users открыт для всех authenticated.

---

## Phase 3: User Story 1 — Корректные поля и порядок в карточке сделки (Priority: P1) 🎯 MVP

**Goal**: Поля в карточке Deal соответствуют ТЗ: 7 значений Our Services, форматирование Amount, Deal Owner dropdown, поля Created By и Created Date (read-only), правильный порядок 18 полей.

**Independent Test**: Открыть карточку сделки → проверить порядок полей, выбрать Our Services (7 вариантов), убедиться что Amount показывает `5 000 000` для значения 5000000, найти поля Deal Owner / Created By / Created Date.

### Implementation for User Story 1 — Backend

- [X] T006 [US1] In `server/controllers/dealsController.js`, update function `createDeal`:
  1. In the INSERT query, add `created_by_id` to the column list after `owner_id`
  2. Add `req.user.id` as the corresponding value in the VALUES array
  The INSERT currently has 16 columns ending with `owner_id`. Add `created_by_id` as column 17 with value `req.user.id` at position 17.

- [X] T007 [US1] In `server/controllers/dealsController.js`, update function `getDealById`:
  1. In the SELECT query, add to the column list: `cb.id AS created_by_uid, cb.name AS created_by_name`
  2. Add after the existing `LEFT JOIN users u ON d.owner_id = u.id`: `LEFT JOIN users cb ON d.created_by_id = cb.id`
  3. In the `return res.json({...})` block, add after the `owner` field:
     ```js
     created_by: row.created_by_uid ? { id: row.created_by_uid, name: row.created_by_name } : null,
     ```

- [X] T008 [US1] In `server/controllers/dealsController.js`, update function `updateDeal`:
  Apply the same SELECT query changes as T007 to the re-fetch query at the bottom of `updateDeal` (the query that runs after `UPDATE deals SET ...` to return the updated row). Add the same `cb.id AS created_by_uid, cb.name AS created_by_name` SELECT and `LEFT JOIN users cb ON d.created_by_id = cb.id`, and add `created_by` to the `return res.json({...})` block.

### Implementation for User Story 1 — Frontend

- [X] T009 [P] [US1] In `client/src/lib/date.js`, update function `formatAmount`:
  Change `style: 'currency', currency: 'RUB'` to `style: 'decimal'`. Result:
  ```js
  export function formatAmount(amount) {
    if (amount == null) return '—'
    return new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 }).format(amount)
  }
  ```
  This changes display from `5 000 000 ₽` to `5 000 000` (no currency symbol, space as thousands separator).

- [X] T010 [US1] Rewrite `client/src/pages/deals/DealDetailPage.jsx` — apply all Deal field changes:

  **Step 1** — Replace the `OUR_SERVICES` constant:
  ```js
  const OUR_SERVICES = ['Workshop', 'Webinar', 'Consulting', 'POC', 'Development', 'Accelerator', 'Performance']
  ```

  **Step 2** — Add imports at the top of the file:
  ```js
  import { getUsers } from '../../api/users'
  import { formatDate, formatAmount } from '../../lib/date'
  ```

  **Step 3** — Inside `DealDetailPage()`, add users query (after `allAccounts` query):
  ```js
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: canWrite,
  })
  const allUsers = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
  const userLabel = (u) => u.name || u.email || u.id
  ```

  **Step 4** — Replace the `leftPanel` content with the correct field order (18 fields):
  ```jsx
  const leftPanel = (
    <div className="p-4 space-y-0">
      <InlineField label="Deal Name" value={deal.title} type="text" required readOnly={!canWrite} onSave={field('title')} />
      <InlineField label="Stage" value={deal.stage} type="select" options={STAGES} readOnly={!canWrite} onSave={field('stage')} />
      <InlineField
        label="Account"
        value={deal.account_id ?? ''}
        displayValue={deal.account?.name ?? deal.account_name ?? ''}
        type="select"
        optionObjects={[{ value: '', label: '—' }, ...allAccounts.map((a) => ({ value: a.id, label: a.name }))]}
        readOnly={!canWrite}
        onSave={(val) => save({ account_id: val || null })}
      />
      <InlineField label="Location" value={deal.location} type="select" options={LOCATIONS} readOnly={!canWrite} onSave={field('location')} />
      <InlineField label="Deal Type" value={deal.deal_type} type="select" options={DEAL_TYPES} readOnly={!canWrite} onSave={field('deal_type')} />
      <InlineField label="Source" value={deal.source} type="select" options={SOURCES} readOnly={!canWrite} onSave={field('source')} />
      <InlineField label="Project Domain" value={deal.project_domain} type="select" options={PROJECT_DOMAINS} readOnly={!canWrite} onSave={field('project_domain')} />
      <InlineField label="Description" value={deal.description} type="textarea" readOnly={!canWrite} onSave={field('description')} />
      <InlineMultiSelect label="Our Services" value={deal.our_services ?? []} options={OUR_SERVICES} readOnly={!canWrite} onSave={field('our_services')} />
      <InlineField
        label="Amount"
        value={deal.value != null ? formatAmount(deal.value) : null}
        type="text"
        readOnly={!canWrite}
        onSave={(val) => save({ value: val ? Number(String(val).replace(/[\s ]/g, '')) : null })}
      />
      <InlineField label="Currency" value={deal.currency} type="select" options={CURRENCIES} readOnly={!canWrite} onSave={field('currency')} />
      <InlineField label="Storage URL" value={deal.deal_storage} type="url" readOnly={!canWrite} onSave={field('deal_storage')} />
      <InlineField
        label="Deal Owner"
        value={deal.owner_id ?? ''}
        displayValue={deal.owner?.name ?? '—'}
        type="select"
        optionObjects={[{ value: '', label: '—' }, ...allUsers.map((u) => ({ value: u.id, label: userLabel(u) }))]}
        readOnly={!canWrite}
        onSave={(val) => save({ owner_id: val || null })}
      />
      <InlineField label="Created By" value={deal.created_by?.name ?? '—'} type="text" readOnly={true} />
      <InlineField label="Created Date" value={deal.created_at ? formatDate(deal.created_at) : '—'} type="text" readOnly={true} />
      <InlineField label="Expected Start Date" value={deal.expected_start_date} type="date" readOnly={!canWrite} onSave={field('expected_start_date')} />
      <InlineField label="Close Date" value={deal.close_date} type="date" readOnly={!canWrite} onSave={field('close_date')} />
      {deal.stage === 'lost' && (
        <InlineField label="Lost Reason" value={deal.lost_reason} type="textarea" readOnly={!canWrite} onSave={field('lost_reason')} />
      )}
    </div>
  )
  ```

**Checkpoint**: User Story 1 complete. Run quickstart.md Scenarios 1–6 to verify.

---

## Phase 4: User Story 2 — Поле Created By в карточках Account и Contact (Priority: P2)

**Goal**: Карточки Account и Contact показывают поле Created By с именем пользователя, создавшего запись.

**Independent Test**: Создать новый Account → открыть карточку → поле Created By содержит имя текущего пользователя. Повторить для Contact.

### Implementation for User Story 2 — Backend

- [X] T011 [P] [US2] In `server/controllers/accountsController.js`, update function `createAccount`:
  Add `created_by_id` to the INSERT query column list and value `req.user.id` in the VALUES array. The INSERT currently ends with `owner_id` as the 13th column. Add `created_by_id` as column 14 with `req.user.id` as the 14th value.
  Update `ACCOUNT_FIELDS` constant to include `created_by_id` at the end.

- [X] T012 [US2] In `server/controllers/accountsController.js`, update function `getAccountById` to add `created_by`:

  ⚠️ **Do NOT modify `ACCOUNT_WITH_COUNTS`** — it is a shared fragment used by both `listAccounts` AND `getAccountById`. Adding `cb.*` aliases there would break `listAccounts` (which has no `cb` JOIN). Instead, extend only `getAccountById`'s own query string.

  Replace the `getAccountById` function with:
  ```js
  async function getAccountById(req, res) {
    const { rows } = await pool.query(
      `SELECT ${ACCOUNT_WITH_COUNTS},
              cb.id AS created_by_uid, cb.name AS created_by_name
       FROM accounts a
       LEFT JOIN users am ON a.account_manager_id = am.id
       LEFT JOIN users cb ON a.created_by_id = cb.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const row = rows[0];
    const { created_by_uid, created_by_name, account_manager_uid, account_manager_name, ...rest } = row;
    res.json({
      ...rest,
      account_manager: row.account_manager_id ? { id: account_manager_uid, name: account_manager_name } : null,
      account_manager_name: account_manager_name ?? null,
      created_by: created_by_uid ? { id: created_by_uid, name: created_by_name } : null,
    });
  }
  ```
  The `, cb.id AS created_by_uid, cb.name AS created_by_name` is appended to `ACCOUNT_WITH_COUNTS` via template literal — only this query gets those columns. `listAccounts` continues to use `ACCOUNT_WITH_COUNTS` unchanged.

- [X] T013 [P] [US2] In `server/controllers/contactsController.js`, update function `createContact`:
  Add `created_by_id` to the INSERT query column list and `req.user.id` to the VALUES array (as the 19th column after `owner_id`).
  Update `CONTACT_FIELDS` constant to include `created_by_id` at the end.

- [X] T014 [US2] In `server/controllers/contactsController.js`, update function `getContactById`:
  1. In the SELECT query, add: `cb.id AS created_by_uid, cb.name AS created_by_name`
  2. Add after `LEFT JOIN accounts a ON c.account_id = a.id`: `LEFT JOIN users cb ON c.created_by_id = cb.id`
  3. Change `res.json(rows[0])` to explicitly map the response:
  ```js
  const row = rows[0];
  const { created_by_uid, created_by_name, ...rest } = row;
  res.json({
    ...rest,
    created_by: created_by_uid ? { id: created_by_uid, name: created_by_name } : null,
  });
  ```

### Implementation for User Story 2 — Frontend

- [X] T015 [P] [US2] In `client/src/pages/accounts/AccountDetailPage.jsx`, add Created By field after the Account Manager InlineField:
  ```jsx
  <InlineField
    label="Created By"
    value={account.created_by?.name ?? '—'}
    type="text"
    readOnly={true}
  />
  ```
  Place it immediately after the closing `/>` of the Account Manager InlineField (before `<InlineField label="Notes" ...`).

- [X] T016 [P] [US2] In `client/src/pages/contacts/ContactDetailPage.jsx`, add Created By field at the end of leftPanel, after the Comments field:
  ```jsx
  <InlineField
    label="Created By"
    value={contact.created_by?.name ?? '—'}
    type="text"
    readOnly={true}
  />
  ```
  Place it after `<InlineField label="Comments" .../>` and before the closing `</div>` of the leftPanel.

**Checkpoint**: User Story 2 complete. Run quickstart.md Scenarios 7–8 to verify.

---

## Phase 5: Polish & Validation

**Purpose**: Применить миграцию, проверить все сценарии.

- [X] T017 Apply migration by running `npm run migrate up` in the `server/` directory (or however migrations are run in this project). Confirm output: "Migrations complete!" with no errors. Check that `created_by_id` columns appear in deals/accounts/contacts.

- [ ] T018 [P] Run all 8 quickstart.md scenarios and confirm each passes:
  - Scenario 1: Our Services — 7 значений
  - Scenario 2: Amount форматирование (`5 000 000`)
  - Scenario 3: Deal Owner — dropdown с пользователями (включая bdm-роль)
  - Scenario 4: Created By в сделке (новые — имя, старые — «—»)
  - Scenario 5: Created Date в сделке (read-only дата)
  - Scenario 6: Порядок 18 полей в Deal
  - Scenario 7: Created By в Account
  - Scenario 8: Created By в Contact

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 verification — **BLOCKS US1 and US2**
- **US1 (Phase 3)**: Depends on Phase 2 (migration + users route)
- **US2 (Phase 4)**: Depends on Phase 2 (migration); INDEPENDENT from US1
- **Polish (Phase 5)**: Depends on Phases 3 AND 4

### Within User Story 1

- T006 → T007 → T008 (same file, sequential — but each modifies a different function)
- T009 [P] with T006/T007/T008 (different file: date.js)
- T010 depends on T009 (uses formatDate, formatAmount from date.js)

### Within User Story 2

- T011 → T012 (same file: accountsController.js, sequential)
- T013 → T014 (same file: contactsController.js, sequential)
- T011/T012 [P] with T013/T014 (different files)
- T015 [P] with T016 (different files)
- T015/T016 can start after T012/T014 (need created_by in API response)

### Parallel Opportunities

- T004 [P] with T005 (migration vs route — different files)
- T009 [P] with backend tasks T006–T008 (different files)
- T011/T012 [P] with T013/T014 (different controller files)
- T015 [P] with T016 (different page files)
- US1 (Phase 3) can run in parallel with US2 (Phase 4) — independent user stories

---

## Parallel Example: User Story 2 Backend

```
# US2 backend — run in parallel (different files):
Thread A: T011 + T012 (accountsController.js — createAccount, getAccountById)
Thread B: T013 + T014 (contactsController.js — createContact, getContactById)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Verification
2. Complete Phase 2: Migration (T004) + Users route (T005)
3. Complete Phase 3: Deal field fixes (T006–T010)
4. **STOP and VALIDATE**: Quickstart.md Scenarios 1–6
5. Ship US1 — Deal карточка полностью соответствует ТЗ

### Full Delivery (US1 + US2)

1. After US1 validated → Phase 4: Account/Contact Created By (T011–T016)
2. Run Scenarios 7–8
3. Run Phase 5 Polish (T017–T018)
4. All 8 сценариев зелёные → фича complete

---

## Notes

- Нет новых npm-пакетов: `Intl.NumberFormat` — браузерный built-in
- Нет новых маршрутов
- `created_by_id` устанавливается server-side (`req.user.id`), никогда из тела запроса
- Старые записи (NULL created_by_id) отображают «—» — обрабатывается через optional chaining `deal.created_by?.name ?? '—'`
- formatAmount используется в AccountDetailPage и ContactDetailPage (таблицы сделок) — они тоже обновятся после T009 (нет ₽, только число)
- Миграция (T004) создаётся в Phase 2, применяется в T017 (Polish) — при разработке можно применить раньше
