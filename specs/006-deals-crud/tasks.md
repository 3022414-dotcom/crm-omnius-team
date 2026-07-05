# Tasks: Сделки (Deals)

**Input**: Design documents from `specs/006-deals-crud/`

**Feature**: F-06 Deals CRUD | **Branch**: `006-deals-crud`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Не включены (ручное тестирование по quickstart.md — MVP-подход)

**Organization**: Задачи сгруппированы по 5 user stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно запускать параллельно (разные файлы, нет зависимостей)
- **[Story]**: К какой user story относится задача (US1–US5)
- Все пути от корня репозитория

---

## Phase 1: Setup

**Purpose**: Нет новых зависимостей и новых таблиц — deals/deal_contacts уже созданы F-01. Фаза пропускается.

*Нет задач — всё готово.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Скелеты файлов + монтирование в app.js — БЛОКИРУЕТ все user stories

**⚠️ CRITICAL**: Ни одна user story не начинается до завершения этой фазы

- [x] T001 Create `server/controllers/dealsController.js` — скелет: `const pool = require('../db/pool')`, константы `const VALID_STAGES = ['lead','qualified','proposal','negotiation','won','lost']` и `const UPDATABLE_FIELDS = ['title','value','close_date','account_id','stage','owner_id']`; пустой `module.exports = {}`
- [x] T002 Create `server/routes/deals.js` — скелет: `const express = require('express')`, `const { requireRole } = require('../middleware/auth')`, `const router = express.Router()`, пустой router, `module.exports = router`
- [x] T003 Modify `server/app.js` — добавить `const dealsRouter = require('./routes/deals')` в блок импортов и `app.use('/api/v1/deals', dealsRouter)` после строки с contactsRouter

**Checkpoint**: Сервер запускается без ошибок; `/api/v1/deals` возвращает 404 (роуты ещё не добавлены)

---

## Phase 3: User Story 1 — Создание сделки (Priority: P1) 🎯 MVP

**Goal**: Пользователи с ролью admin/bdm создают сделку с обязательным title; stage='lead' устанавливается автоматически

**Independent Test**: `POST /api/v1/deals {title:"Тест"}` → 201, stage='lead', owner_id=текущий пользователь; без title → 400; viewer → 403

### Implementation for User Story 1

- [x] T004 [US1] Add `createDeal` to `server/controllers/dealsController.js` — (1) валидация: `const title = req.body.title?.trim(); if (!title) return res.status(400).json({error:'Bad Request',message:'title обязателен'});`; (2) inline account_id check: `const account_id = req.body.account_id || null; if (account_id) { const {rows} = await pool.query('SELECT id FROM accounts WHERE id=$1',[account_id]); if (!rows[0]) return res.status(400).json({error:'Bad Request',message:'Аккаунт не найден'}); }`; (3) INSERT: `const {rows:[deal]} = await pool.query('INSERT INTO deals (title,value,stage,close_date,account_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [title, req.body.value||null, 'lead', req.body.close_date||null, account_id, req.user.id]); return res.status(201).json(deal);`; добавить в module.exports
- [x] T005 [US1] Add route in `server/routes/deals.js` — `const { createDeal } = require('../controllers/dealsController'); router.post('/', requireRole(['admin','bdm']), createDeal)`

**Checkpoint**: US1 полностью работает — POST создаёт сделку, 400/403 валидация работает

---

## Phase 4: User Story 2 — Просмотр и поиск сделок (Priority: P2)

**Goal**: Любой авторизованный пользователь получает список сделок с фильтрами и просматривает конкретную сделку с контактами

**Independent Test**: `GET /api/v1/deals` → `{data:[...],total:N,page:1,limit:20}` с contacts_count; `?stage=lead` → только лиды; `GET /api/v1/deals/:id` → объект с массивом contacts или 404

### Implementation for User Story 2

- [x] T006 [P] [US2] Add `listDeals` to `server/controllers/dealsController.js` — парсинг: `const page=Math.max(1,parseInt(req.query.page)||1), limit=Math.min(100,parseInt(req.query.limit)||20), offset=(page-1)*limit`; параметры: `stage,account_id,owner_id,search,date_from,date_to` из query (null если не переданы); SQL с LEFT JOIN accounts+users и субзапросом contacts_count (паттерн D-01 из research.md): `SELECT d.id,d.title,d.value,d.stage,d.close_date,d.account_id,d.owner_id,d.created_at,d.updated_at, a.name AS account_name, u.name AS owner_name, (SELECT COUNT(*) FROM deal_contacts dc WHERE dc.deal_id=d.id) AS contacts_count FROM deals d LEFT JOIN accounts a ON d.account_id=a.id LEFT JOIN users u ON d.owner_id=u.id WHERE ($1::text IS NULL OR d.stage=$1) AND ($2::uuid IS NULL OR d.account_id=$2) AND ($3::uuid IS NULL OR d.owner_id=$3) AND ($4::text IS NULL OR d.title ILIKE '%'||$4||'%') AND ($5::date IS NULL OR d.close_date>=$5::date) AND ($6::date IS NULL OR d.close_date<=$6::date) ORDER BY d.created_at DESC LIMIT $7 OFFSET $8`; COUNT-запрос для total (те же WHERE-условия без LIMIT/OFFSET); преобразовать каждый объект: `account: row.account_id ? {id:row.account_id,name:row.account_name} : null, owner: {id:row.owner_id,name:row.owner_name}, contacts_count: parseInt(row.contacts_count)`; вернуть `{data,total,page,limit}`; добавить в module.exports
- [x] T007 [P] [US2] Add `getDealById` to `server/controllers/dealsController.js` — запрос 1: SELECT deal с LEFT JOIN accounts+users по id (404 если не найдена, D-02 из research.md); запрос 2: `SELECT c.id,c.first_name,c.last_name,c.photo_path FROM contacts c JOIN deal_contacts dc ON c.id=dc.contact_id WHERE dc.deal_id=$1`; собрать ответ: `{...deal fields, account: deal.account_id ? {id,name} : null, owner: {id,name}, contacts: [...] }`; добавить в module.exports
- [x] T008 [US2] Add routes in `server/routes/deals.js` — `const { createDeal, listDeals, getDealById } = require('../controllers/dealsController'); router.get('/', listDeals); router.get('/:id', getDealById)` (без requireRole — все авторизованные)

**Checkpoint**: US2 полностью работает — список с фильтрами, поиск, просмотр по ID

---

## Phase 5: User Story 3 — Редактирование и смена этапа (Priority: P3)

**Goal**: Пользователи admin/bdm обновляют поля сделки частично; валидация stage и title; owner_id может быть изменён

**Independent Test**: `PUT /api/v1/deals/:id {stage:"qualified"}` → 200, stage изменился; невалидный stage → 400; пустой title → 400; viewer → 403

### Implementation for User Story 3

- [x] T009 [US3] Add `updateDeal` to `server/controllers/dealsController.js` — (1) ранние валидации: `if ('stage' in body && !VALID_STAGES.includes(body.stage)) return res.status(400).json({error:'Bad Request',message:'Невалидный stage'});`; `if ('title' in body && !body.title?.trim()) return res.status(400).json({error:'Bad Request',message:'title не может быть пустым'});`; (2) inline account_id check: `if ('account_id' in body && body.account_id) { const {rows} = await pool.query('SELECT id FROM accounts WHERE id=$1',[body.account_id]); if (!rows[0]) return res.status(400).json({error:'Bad Request',message:'Аккаунт не найден'}); }`; (3) inline owner_id check: `if ('owner_id' in body && body.owner_id) { const {rows} = await pool.query('SELECT id FROM users WHERE id=$1',[body.owner_id]); if (!rows[0]) return res.status(400).json({error:'Bad Request',message:'Пользователь не найден'}); }`; (4) динамический SET-clause: итерация по UPDATABLE_FIELDS, только присутствующие в body, строить setClauses/values (аналогично updateContact из F-05); (5) если setClauses пустой (body {}): перейти к шагу 6 без UPDATE; иначе `UPDATE deals SET <clauses>, updated_at=NOW() WHERE id=$N` — если rowCount=0 → 404; (6) **ВОЗВРАЩАТЬ ВЛОЖЕННЫЙ ОБЪЕКТ**: после UPDATE (или вместо него при пустом body) выполнить SELECT с JOIN: `const {rows:[row]} = await pool.query('SELECT d.id,d.title,d.value,d.stage,d.close_date,d.account_id,d.owner_id,d.created_at,d.updated_at, a.name AS account_name, u.name AS owner_name FROM deals d LEFT JOIN accounts a ON d.account_id=a.id LEFT JOIN users u ON d.owner_id=u.id WHERE d.id=$1',[id]); if (!row) return res.status(404).json({error:'Not Found'}); return res.json({...row, account: row.account_id ? {id:row.account_id,name:row.account_name} : null, owner: {id:row.owner_id,name:row.owner_name}});`; добавить в module.exports
- [x] T010 [US3] Add route in `server/routes/deals.js` — `const { ..., updateDeal } = require('../controllers/dealsController'); router.put('/:id', requireRole(['admin','bdm']), updateDeal)`

**Checkpoint**: US3 полностью работает — partial update, валидации stage/title/account_id/owner_id, RBAC

---

## Phase 6: User Story 4 — Управление контактами сделки (Priority: P4)

**Goal**: admin/bdm привязывают и отвязывают контакты; идемпотентность в обе стороны

**Independent Test**: `POST /api/v1/deals/:id/contacts {contact_id}` → 201 (новая связь) / 200 (уже есть); `DELETE /api/v1/deals/:id/contacts/:contact_id` → 204; неверный contact_id → 400; viewer → 403

### Implementation for User Story 4

- [x] T011 [P] [US4] Add `linkContact` to `server/controllers/dealsController.js` — (1) проверить deal (404): `SELECT id FROM deals WHERE id=$1`; (2) проверить contact (400): `SELECT id FROM contacts WHERE id=$1`; (3) INSERT ON CONFLICT DO NOTHING RETURNING deal_id (паттерн D-05 из research.md): `const {rows} = await pool.query('INSERT INTO deal_contacts(deal_id,contact_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING deal_id',[dealId,contactId]); return res.status(rows.length ? 201 : 200).json({});`; добавить в module.exports
- [x] T012 [P] [US4] Add `unlinkContact` to `server/controllers/dealsController.js` — (1) проверить deal (404); (2) `DELETE FROM deal_contacts WHERE deal_id=$1 AND contact_id=$2` (идемпотентно, D-06); return res.status(204).send(); добавить в module.exports
- [x] T013 [US4] Add routes in `server/routes/deals.js` — `const { ..., linkContact, unlinkContact } = require('../controllers/dealsController'); router.post('/:id/contacts', requireRole(['admin','bdm']), linkContact); router.delete('/:id/contacts/:contact_id', requireRole(['admin','bdm']), unlinkContact)`

**Checkpoint**: US4 полностью работает — привязка/отвязка контактов, идемпотентность, RBAC

---

## Phase 7: User Story 5 — Удаление сделки (Priority: P5)

**Goal**: admin удаляет сделку с каскадом; bdm/viewer → 403

**Independent Test**: `DELETE /api/v1/deals/:id` → 204; GET → 404; bdm → 403; несуществующий ID → 404

### Implementation for User Story 5

- [x] T014 [US5] Add `deleteDeal` to `server/controllers/dealsController.js` — (1) `SELECT id FROM deals WHERE id=$1` → 404 если нет; (2) явное удаление полиморфных таблиц (паттерн D-07 из research.md): `await pool.query("DELETE FROM activities  WHERE entity_type='deal' AND entity_id=$1",[id])`, `await pool.query("DELETE FROM attachments WHERE entity_type='deal' AND entity_id=$1",[id])`, `await pool.query("DELETE FROM notes       WHERE entity_type='deal' AND entity_id=$1",[id])`; (3) `await pool.query('DELETE FROM deals WHERE id=$1',[id])` — DB CASCADE удаляет deal_contacts; (4) `return res.status(204).send()`; добавить в module.exports
- [x] T015 [US5] Add route in `server/routes/deals.js` — `const { ..., deleteDeal } = require('../controllers/dealsController'); router.delete('/:id', requireRole(['admin']), deleteDeal)`

**Checkpoint**: US5 полностью работает — удаление с каскадом, RBAC (только admin)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Финальные проверки

- [ ] T016 Manual quickstart.md validation — прогнать сценарии §1–§6 из `specs/006-deals-crud/quickstart.md` через curl; отметить результаты

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: Нет зависимостей — запускать немедленно; **БЛОКИРУЕТ** все US
- **Phase 3 (US1)**: Зависит от Phase 2
- **Phase 4 (US2)**: Зависит от Phase 2; T008 зависит от T006 и T007
- **Phase 5 (US3)**: Зависит от Phase 2
- **Phase 6 (US4)**: Зависит от Phase 2; T013 зависит от T011 и T012
- **Phase 7 (US5)**: Зависит от Phase 2
- **Phase 8 (Polish)**: Зависит от всех завершённых US

### User Story Dependencies

- **US1 (P1)**: Стартует после Phase 2 — нет зависимостей от других US
- **US2 (P2)**: Стартует после Phase 2 — независима
- **US3 (P3)**: Стартует после Phase 2 — независима
- **US4 (P4)**: Стартует после Phase 2 — зависит от наличия данных (нужна существующая сделка и контакт — только для тестирования)
- **US5 (P5)**: Стартует после Phase 2 — независима

### Within Each User Story

- Controller function → route registration (строгий порядок)
- T006, T007 — одного файла касаются, писать последовательно
- T011, T012 — одного файла касаются, писать последовательно

### Parallel Opportunities

После Phase 2: US1, US2 (T006+T007), US3, US5 могут разрабатываться параллельно (разные функции контроллера, независимы по данным).

---

## Parallel Example: US4 — Управление контактами

```bash
# T011 и T012 касаются одного файла — писать последовательно:
T011: "Add linkContact() to dealsController.js"
T012: "Add unlinkContact() to dealsController.js"
# Затем:
T013: "Add routes (зависит от T011 и T012)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T003)
2. Complete Phase 3: US1 (T004–T005)
3. **STOP и VALIDATE**: `POST /api/v1/deals` работает, 400/403 валидация работает
4. Proceed to US2

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Phase 3 (US1) → создание сделок (MVP!)
3. Phase 4 (US2) → просмотр, фильтры, поиск
4. Phase 5 (US3) → редактирование и смена этапа
5. Phase 6 (US4) → привязка/отвязка контактов
6. Phase 7 (US5) → удаление
7. Phase 8 → quickstart-валидация

---

## Notes

- Нет новых таблиц и миграций — deals/deal_contacts созданы F-01
- Нет новых зависимостей — только pool, express, requireRole (все уже в проекте)
- UPDATABLE_FIELDS включает owner_id (отличие от F-04/F-05 — разрешено clarification Q2)
- Cascade delete: deal_contacts через DB CASCADE, notes/attachments/activities — app-level (D-07)
- contacts_count в listDeals — скалярный субзапрос, не отдельный запрос (D-01)
- ON CONFLICT DO NOTHING RETURNING — различает 201 (новая) и 200 (дубликат) без лишнего SELECT (D-05)
- Все controller-функции — async; express-async-errors уже установлен (F-03)
