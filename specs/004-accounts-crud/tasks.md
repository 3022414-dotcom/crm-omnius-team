# Tasks: Аккаунты (Accounts)

**Input**: Design documents from `specs/004-accounts-crud/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/accounts-api.md ✅

**Tests**: Ручная проверка по quickstart.md (автоматизированные тесты не запрошены в spec)

**Organization**: Задачи сгруппированы по User Story для независимой реализации и тестирования каждой истории.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно выполнять параллельно (разные файлы, нет незавершённых зависимостей)
- **[Story]**: User Story из spec.md (US1–US4)

---

## Phase 1: Setup

**Purpose**: Создать файловую структуру F-04 и подключить роутер — без этого ни одна User Story не может быть проверена.

- [ ] T001 Создать server/controllers/accountsController.js: `const pool = require('../db/pool');` вверху; в конце `module.exports = {};` (будет заполняться по мере добавления функций)
- [ ] T002 [P] Создать server/routes/accounts.js: `const express = require('express');`, `const { requireRole } = require('../middleware/auth');`, `const router = express.Router();`, в конце `module.exports = router;` (роуты добавятся в фазах US)
- [ ] T003 Обновить server/app.js: добавить `const accountsRouter = require('./routes/accounts');` после строки с usersRouter; добавить `app.use('/api/v1/accounts', accountsRouter);` сразу после строки `app.use('/api/v1/users', usersRouter)`

**Checkpoint**: `node server/index.js` (или аналог) стартует без ошибок. GET /api/v1/accounts возвращает 401 (без auth) или пустой ответ (нет роутов ещё).

---

## Phase 2: Foundational

Нет отдельных фундаментальных задач — `requireRole` уже реализован в F-03, `pool` готов из F-01, `express.json()` добавлен в F-03. Переходим сразу к User Stories.

---

## Phase 3: US1 — Создание нового аккаунта (Priority: P1) 🎯 MVP

**Goal**: `POST /api/v1/accounts` создаёт аккаунт; admin и bdm могут создавать; viewer получает 403.

**Independent Test**: `POST /api/v1/accounts` с `{"name":"Тест"}` → 201 + объект с id/name/owner_id; POST без name → 400; viewer → 403 (§1 из quickstart.md)

### Implementation

- [ ] T004 [US1] Добавить функцию `createAccount(req, res)` в server/controllers/accountsController.js со следующей логикой:
  1. Валидация: если `!req.body.name || !req.body.name.trim()` → `res.status(400).json({ error: 'Bad Request', message: 'Поле name обязательно' })`
  2. Деструктурировать из `req.body`: `const { name, industry, website, phone, address, notes } = req.body`
  3. Выполнить: `INSERT INTO accounts (name, industry, website, phone, address, notes, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, industry, website, phone, address, notes, owner_id, created_at, updated_at`; параметры: `[name.trim(), industry||null, website||null, phone||null, address||null, notes||null, req.user.id]`
  4. Вернуть `res.status(201).json(rows[0])`
  5. Обновить `module.exports = { createAccount }` внизу файла

- [ ] T005 [US1] Добавить маршрут в server/routes/accounts.js:
  `router.post('/', requireRole(['admin', 'bdm']), createAccount);`
  Добавить импорт: `const { createAccount } = require('../controllers/accountsController');`

**Checkpoint**: POST /api/v1/accounts `{"name":"Рога и Копыта"}` → 201; POST `{}` → 400; viewer → 403. US1 выполнена.

---

## Phase 4: US2 — Просмотр и поиск аккаунтов (Priority: P2)

**Goal**: `GET /api/v1/accounts` возвращает постраничный список с `contactsCount`/`dealsCount`; `GET /api/v1/accounts/:id` возвращает конкретный аккаунт; доступно всем ролям.

**Independent Test**: GET /api/v1/accounts → `{ data, total, page:1, limit:20 }`, каждый элемент содержит `contactsCount` и `dealsCount`; GET /:id → объект или 404 (§2 из quickstart.md)

### Implementation

- [ ] T006 [P] [US2] Добавить функцию `listAccounts(req, res)` в server/controllers/accountsController.js:
  1. Парсить query: `let page = parseInt(req.query.page) || 1; if (page < 1) page = 1;`; `let limit = parseInt(req.query.limit) || 20; if (limit > 100) limit = 100; if (limit < 1) limit = 1;`; `const search = (req.query.search || '').trim();`; `const offset = (page - 1) * limit;`
  2. SQL данных: `SELECT a.id, a.name, a.industry, a.website, a.phone, a.address, a.notes, a.owner_id, a.created_at, a.updated_at, (SELECT COUNT(*)::int FROM contacts WHERE account_id = a.id) AS "contactsCount", (SELECT COUNT(*)::int FROM deals WHERE account_id = a.id) AS "dealsCount" FROM accounts a WHERE ($1 = '' OR a.name ILIKE '%' || $1 || '%') ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`; параметры: `[search, limit, offset]`
  3. SQL для total: `SELECT COUNT(*)::int AS total FROM accounts WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')`; параметры: `[search]`
  4. Вернуть: `res.json({ data: rows, total: countRows[0].total, page, limit })`
  5. Обновить `module.exports = { createAccount, listAccounts }` внизу файла

- [ ] T007 [P] [US2] Добавить функцию `getAccountById(req, res)` в server/controllers/accountsController.js:
  1. SQL: `SELECT a.id, a.name, a.industry, a.website, a.phone, a.address, a.notes, a.owner_id, a.created_at, a.updated_at, (SELECT COUNT(*)::int FROM contacts WHERE account_id = a.id) AS "contactsCount", (SELECT COUNT(*)::int FROM deals WHERE account_id = a.id) AS "dealsCount" FROM accounts a WHERE a.id = $1`; параметры: `[req.params.id]`
  2. Если `!rows[0]` → `res.status(404).json({ error: 'Not Found' })`
  3. Иначе → `res.json(rows[0])`
  4. Обновить `module.exports = { createAccount, listAccounts, getAccountById }` внизу файла

- [ ] T008 [US2] Добавить маршруты в server/routes/accounts.js (T008 после T006 и T007):
  ```js
  router.get('/', listAccounts);
  router.get('/:id', getAccountById);
  ```
  Обновить деструктурирующий import контроллера: `const { createAccount, listAccounts, getAccountById } = require('../controllers/accountsController');`

**Checkpoint**: GET /api/v1/accounts → envelope с `{ data, total, page, limit }` и полями `contactsCount`/`dealsCount`; GET /:id → 200 или 404; viewer может читать. US2 выполнена.

---

## Phase 5: US3 — Редактирование аккаунта (Priority: P3)

**Goal**: `PUT /api/v1/accounts/:id` обновляет только переданные поля; admin и bdm могут редактировать; viewer → 403.

**Independent Test**: PUT `{"phone":"+7 999"}` на существующий аккаунт → 200, только phone изменился; остальные поля сохранены; PUT `{"name":""}` → 400 (§3 из quickstart.md)

### Implementation

- [ ] T009 [US3] Добавить функцию `updateAccount(req, res)` в server/controllers/accountsController.js:
  1. Константа допустимых полей: `const UPDATABLE_FIELDS = ['name', 'industry', 'website', 'phone', 'address', 'notes'];`
  2. Валидация name если передан: `if ('name' in req.body && (!req.body.name || !req.body.name.trim())) return res.status(400).json({ error: 'Bad Request', message: 'Поле name не может быть пустым' });`
  3. Собрать SET-clause: `const updates = []; const values = []; let idx = 1; for (const field of UPDATABLE_FIELDS) { if (field in req.body) { updates.push(\`${field} = $${idx++}\`); values.push(field === 'name' ? req.body[field].trim() : req.body[field]); } }`
  4. Если `updates.length === 0`: выполнить `SELECT a.id, a.name, ... FROM accounts a WHERE a.id = $1` (без счётчиков — возврат без изменений), если `!rows[0]` → 404, иначе → 200 с объектом
  5. Если есть обновления: `updates.push(\`updated_at = NOW()\`); values.push(req.params.id);` → `UPDATE accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, industry, website, phone, address, notes, owner_id, created_at, updated_at`; если `!rows[0]` → 404; иначе → 200
  6. Обновить `module.exports = { createAccount, listAccounts, getAccountById, updateAccount }` внизу файла

- [ ] T010 [US3] Добавить маршрут в server/routes/accounts.js:
  `router.put('/:id', requireRole(['admin', 'bdm']), updateAccount);`
  Обновить import: добавить `updateAccount` в деструктуризацию

**Checkpoint**: PUT с одним полем → только это поле изменено; PUT `{}` → 200 без изменений; PUT несуществующего → 404; viewer → 403. US3 выполнена.

---

## Phase 6: US4 — Удаление аккаунта (Priority: P4)

**Goal**: `DELETE /api/v1/accounts/:id` удаляет аккаунт и связанные данные в транзакции; только admin; контакты остаются с `account_id = null`.

**Independent Test**: DELETE → 204; GET того же id → 404; bdm/viewer → 403 (§4 из quickstart.md)

### Implementation

- [ ] T011 [US4] Добавить функцию `deleteAccount(req, res)` в server/controllers/accountsController.js — реализовать в транзакции:
  1. `const client = await pool.connect();` затем `try { await client.query('BEGIN');`
  2. Проверить существование: `SELECT id FROM accounts WHERE id = $1`; если `!rows[0]` → `await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Not Found' });`
  3. Удалить полиморфные объекты связанных сделок (activities, attachments, notes) WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)`:
     ```sql
     DELETE FROM activities WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)
     DELETE FROM attachments WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)
     DELETE FROM notes WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $1)
     ```
  4. Удалить полиморфные объекты самого аккаунта:
     ```sql
     DELETE FROM activities WHERE entity_type = 'account' AND entity_id = $1
     DELETE FROM attachments WHERE entity_type = 'account' AND entity_id = $1
     DELETE FROM notes WHERE entity_type = 'account' AND entity_id = $1
     ```
  5. `DELETE FROM deals WHERE account_id = $1`
  6. `DELETE FROM accounts WHERE id = $1` (DB автоматически SET NULL на contacts.account_id)
  7. `await client.query('COMMIT'); client.release(); res.status(204).send();`
  8. В `catch (err)`: `await client.query('ROLLBACK'); client.release(); throw err;`
  9. Обновить `module.exports = { createAccount, listAccounts, getAccountById, updateAccount, deleteAccount }` внизу файла

- [ ] T012 [US4] Добавить маршрут в server/routes/accounts.js:
  `router.delete('/:id', requireRole(['admin']), deleteAccount);`
  Обновить import: добавить `deleteAccount` в деструктуризацию

**Checkpoint**: DELETE → 204; GET → 404; связанные контакты остаются; bdm → 403. US4 выполнена.

---

## Phase 7: Polish & Validation

**Purpose**: Финальная проверка и квикстарт.

- [ ] T013 [P] Убедиться, что в server/routes/accounts.js маршруты зарегистрированы в правильном порядке: `GET /` → `GET /:id` → `POST /` → `PUT /:id` → `DELETE /:id` (UUID-идентификаторы не конфликтуют со статическими сегментами, но порядок важен для читаемости и будущих расширений)
- [ ] T014 [P] Пройти все сценарии из specs/004-accounts-crud/quickstart.md (§1–§6) и убедиться в корректности всех ответов

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Нет зависимостей — начать сразу; T001 и T002 параллельны; T003 зависит от T002
- **Phase 3 (US1)**: Зависит от Phase 1 (T003 завершён); T004 и T005 последовательны (сначала контроллер, потом роут)
- **Phase 4 (US2)**: Зависит от Phase 1; T006 и T007 параллельны; T008 зависит от обоих
- **Phase 5 (US3)**: Зависит от Phase 1; T009 и T010 последовательны
- **Phase 6 (US4)**: Зависит от Phase 1; T011 и T012 последовательны
- **Phase 7 (Polish)**: Зависит от всех предыдущих фаз

### User Story Dependencies

- **US1 (P1)**: После Phase 1 — независима от US2/US3/US4
- **US2 (P2)**: После Phase 1 — независима; T006 и T007 параллельны внутри
- **US3 (P3)**: После Phase 1 — независима
- **US4 (P4)**: После Phase 1 — независима

### Within Each Phase

- T001 и T002 — параллельны (разные новые файлы)
- T003 — после T002 (routes file должен существовать до mount)
- T006 и T007 — параллельны (разные функции в контроллере)
- T008 — после T006 и T007 (функции должны быть определены и экспортированы)
- T013 и T014 — параллельны (разные задачи проверки)

---

## Parallel Examples

```bash
# Phase 1: T001 и T002 параллельны
Task: "Create server/controllers/accountsController.js skeleton"
Task: "Create server/routes/accounts.js skeleton"

# Phase 4 (US2): T006 и T007 параллельны
Task: "Add listAccounts function to server/controllers/accountsController.js"
Task: "Add getAccountById function to server/controllers/accountsController.js"

# Phase 7: T013 и T014 параллельны
Task: "Verify route order in server/routes/accounts.js"
Task: "Run quickstart.md validation scenarios"
```

---

## Implementation Strategy

### MVP First (US1, P1)

1. Phase 1: Setup (T001–T003)
2. Phase 3: US1 (T004–T005) ← POST /accounts работает
3. **STOP и VALIDATE**: §1 из quickstart.md — создание аккаунтов и 403 для viewer

### Incremental Delivery

1. T001–T003 → сервер стартует с accounts router
2. T004–T005 → POST /accounts работает (US1)
3. T006–T008 → GET /accounts и GET /:id работают (US2)
4. T009–T010 → PUT /:id работает (US3)
5. T011–T012 → DELETE /:id с транзакцией (US4)
6. T013–T014 → полный quickstart validated

---

## Notes

- `[P]` задачи = разные файлы или независимые функции без незавершённых зависимостей
- Каждый controller task завершается обновлением `module.exports` внизу файла — это критично для работы routes
- Транзакция в deleteAccount через `pool.connect()` (client), а не `pool.query()` — нельзя использовать pool для BEGIN/COMMIT
- `express-async-errors` уже установлен (F-03) — async функции не требуют try/catch, кроме deleteAccount (там ROLLBACK нужен в catch)
- deals.account_id в БД → ON DELETE SET NULL, но спека требует CASCADE DELETE сделок — потому deleteAccount явно делает `DELETE FROM deals` (D-05 research.md)
- Не добавлять поле owner_id из тела запроса ни в createAccount, ни в updateAccount
