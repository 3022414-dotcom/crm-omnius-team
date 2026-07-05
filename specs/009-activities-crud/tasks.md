# Tasks: Активности (Activities)

**Branch**: `009-activities-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Design documents from `specs/009-activities-crud/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Ручное тестирование по quickstart.md (MVP-подход, без unit-тестов)

**Organization**: Задачи сгруппированы по user story. Каждая story независимо тестируема.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Параллельно с другими (разные файлы, нет зависимостей)
- **[Story]**: Привязка к user story из spec.md

---

## Phase 1: Setup (Создание файлов)

**Purpose**: Создать скелеты новых файлов

- [X] T001 Create server/controllers/activitiesController.js with: `const pool = require('../db/pool')`; constants `const VALID_TYPES = ['call','email','meeting','task']`, `const VALID_ENTITY_TYPES = ['account','contact','deal']`, `const ENTITY_TABLES = {account:'accounts',contact:'contacts',deal:'deals'}`; `module.exports = {}`
- [X] T002 Create server/routes/activities.js with: `const express = require('express')`, `const { requireRole } = require('../middleware/auth')`, `const router = express.Router()`, `module.exports = router`

**Checkpoint**: Два файла существуют; `node -e "require('./server/controllers/activitiesController')"` без ошибок

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Таблица `activities` создана в F-01; RBAC middleware существует (F-03); pg pool существует (F-01); нет новых зависимостей

*(Нет задач — setup достаточен)*

---

## Phase 3: User Story 1 — Создание активности (Priority: P1) 🎯 MVP

**Goal**: Admin/bdm создаёт активность через POST /api/v1/activities

**Independent Test**: `POST /api/v1/activities` с `{type:"call",entity_type:"account",entity_id:UUID}` → 201 с `{id,type,entity_type,entity_id,description,due_date,completed:false,overdue,owner:{id,name},created_at,updated_at}`; отсутствующий type → 400; невалидный type → 400; несуществующий entity_id → 404; viewer → 403

### Implementation for User Story 1

- [X] T003 [US1] Implement `createActivity` in server/controllers/activitiesController.js: (1) деструктурировать `const { type, entity_type, entity_id, description, due_date } = req.body`; (2) если `!type || !VALID_TYPES.includes(type)` → `return res.status(400).json({error:'Bad Request', message:'type обязателен: call/email/meeting/task'})`; (3) если `!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)` → 400 `'entity_type обязателен: account/contact/deal'`; (4) если `!entity_id` → 400 `'entity_id обязателен'`; (5) `const { rows: entityRows } = await pool.query('SELECT id FROM '+ENTITY_TABLES[entity_type]+' WHERE id=$1', [entity_id])` — если `!entityRows[0]` → 404; (6) `const { rows: [act] } = await pool.query('INSERT INTO activities (type,entity_type,entity_id,description,due_date,completed,owner_id) VALUES ($1,$2,$3,$4,$5,false,$6) RETURNING *', [type,entity_type,entity_id,description||null,due_date||null,req.user.id])`; (7) `const overdue = act.due_date !== null && new Date(act.due_date) < new Date() && !act.completed`; (8) `return res.status(201).json({id:act.id,type:act.type,entity_type:act.entity_type,entity_id:act.entity_id,description:act.description,due_date:act.due_date,completed:act.completed,overdue,owner:{id:req.user.id,name:req.user.name},created_at:act.created_at,updated_at:act.updated_at})`; добавить в module.exports
- [X] T004 [US1] Add POST route to server/routes/activities.js: import `const { createActivity } = require('../controllers/activitiesController')`; add `router.post('/', requireRole(['admin','bdm']), createActivity)`
- [X] T005 [US1] Mount activitiesRouter in server/app.js: add `const activitiesRouter = require('./routes/activities')`; add `app.use('/api/v1/activities', activitiesRouter)` — добавить после строки с attachmentsRouter

**Checkpoint**: `POST /api/v1/activities` → 201 с корректным owner.name и overdue; 400/404/403 при ошибках

---

## Phase 4: User Story 2 — Просмотр активностей сущности (Priority: P2)

**Goal**: Любой авторизованный пользователь просматривает список активностей с фильтрацией через GET /{accounts|contacts|deals}/:id/activities

**Independent Test**: `GET /api/v1/accounts/:id/activities` → plain array sorted created_at DESC, каждый с `overdue`; `?completed=false` → только невыполненные; `?type=call` → только звонки; `?due_date_from=2026-07-01` → включает записи с due_date=null; несуществующий entity → 404; нет активностей → `[]`

### Implementation for User Story 2

- [X] T006 [US2] Implement `listActivitiesForEntity(entityType)` factory in server/controllers/activitiesController.js: возвращает `async (req, res) => { ... }`; внутри: (1) `const entityId = req.params.id`; `const { rows: entityRows } = await pool.query('SELECT id FROM '+ENTITY_TABLES[entityType]+' WHERE id=$1', [entityId])` — если `!entityRows[0]` → 404; (2) `const { completed, type, due_date_from, due_date_to } = req.query`; (3) динамически собрать WHERE: `const conditions = ['a.entity_type=$1','a.entity_id=$2']`; `const params = [entityType, entityId]`; `let idx = 3`; если `completed !== undefined` → `conditions.push('a.completed=$'+idx++)`, `params.push(completed === 'true')`; если `type` → `conditions.push('a.type=$'+idx++)`, `params.push(type)`; если `due_date_from` → `conditions.push('(a.due_date IS NULL OR a.due_date >= $'+idx+')')`, `params.push(due_date_from)`, `idx++`; если `due_date_to` → `conditions.push('(a.due_date IS NULL OR a.due_date <= $'+idx+')')`, `params.push(due_date_to)`, `idx++`; (4) выполнить: `const { rows } = await pool.query('SELECT a.id, a.type, a.entity_type, a.entity_id, a.description, a.due_date, a.completed, CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() AND a.completed = false THEN true ELSE false END AS overdue, u.id AS owner_uid, u.name AS owner_name, a.created_at, a.updated_at FROM activities a JOIN users u ON a.owner_id = u.id WHERE '+conditions.join(' AND ')+' ORDER BY a.created_at DESC', params)`; (5) `return res.json(rows.map(r => ({id:r.id,type:r.type,entity_type:r.entity_type,entity_id:r.entity_id,description:r.description,due_date:r.due_date,completed:r.completed,overdue:r.overdue,owner:{id:r.owner_uid,name:r.owner_name},created_at:r.created_at,updated_at:r.updated_at})))`; добавить в module.exports
- [X] T007 [P] [US2] Add GET /:id/activities to server/routes/accounts.js: добавить import `const { listActivitiesForEntity } = require('../controllers/activitiesController')`; вставить `router.get('/:id/activities', listActivitiesForEntity('account'))` ПЕРЕД существующей строкой `router.get('/:id', getAccountById)`
- [X] T008 [P] [US2] Add GET /:id/activities to server/routes/contacts.js: добавить import `const { listActivitiesForEntity } = require('../controllers/activitiesController')`; вставить `router.get('/:id/activities', listActivitiesForEntity('contact'))` ПЕРЕД существующей строкой `router.get('/:id', getContactById)`
- [X] T009 [P] [US2] Add GET /:id/activities to server/routes/deals.js: добавить import `const { listActivitiesForEntity } = require('../controllers/activitiesController')`; вставить `router.get('/:id/activities', listActivitiesForEntity('deal'))` ПЕРЕД существующей строкой `router.get('/:id', getDealById)`

**Checkpoint**: GET /{accounts|contacts|deals}/:id/activities возвращает plain array с overdue; фильтры работают; null-due_date записи включаются при date-фильтрах; [] при отсутствии активностей

---

## Phase 5: User Story 3 — Обновление активности (Priority: P3)

**Goal**: Admin/bdm обновляет активность через PUT /api/v1/activities/:id

**Independent Test**: `PUT /api/v1/activities/:id` с `{completed:true}` → 200, completed=true, overdue=false; `{completed:false}` с past due_date → overdue=true; `{type:"fax"}` → 400; несуществующая → 404; viewer → 403

### Implementation for User Story 3

- [X] T010 [US3] Implement `updateActivity` in server/controllers/activitiesController.js: (1) `const { rows: [existing] } = await pool.query('SELECT id FROM activities WHERE id=$1', [req.params.id])` — если `!existing` → 404; (2) `const { type, description, due_date, completed } = req.body`; (3) если `type !== undefined && !VALID_TYPES.includes(type)` → 400 `'Невалидный type'`; (4) динамически собрать SET: `const sets = []`; `const params = []`; `let idx = 1`; для каждого из `[['type',type],['description',description],['due_date',due_date],['completed',completed]]` — если `value !== undefined`: `sets.push(col+'=$'+idx++)`, `params.push(value)`; (5) если `sets.length === 0` → 400 `'Нет полей для обновления'`; (6) `params.push(req.params.id)`; `await pool.query('UPDATE activities SET '+sets.join(',')+' WHERE id=$'+idx, params)`; (7) `const { rows: [act] } = await pool.query('SELECT a.id, a.type, a.entity_type, a.entity_id, a.description, a.due_date, a.completed, CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() AND a.completed = false THEN true ELSE false END AS overdue, u.id AS owner_uid, u.name AS owner_name, a.created_at, a.updated_at FROM activities a JOIN users u ON a.owner_id = u.id WHERE a.id=$1', [req.params.id])`; (8) `return res.json({id:act.id,type:act.type,entity_type:act.entity_type,entity_id:act.entity_id,description:act.description,due_date:act.due_date,completed:act.completed,overdue:act.overdue,owner:{id:act.owner_uid,name:act.owner_name},created_at:act.created_at,updated_at:act.updated_at})`; добавить в module.exports
- [X] T011 [US3] Add PUT /:id route to server/routes/activities.js: import `updateActivity` from activitiesController (добавить к существующему import); `router.put('/:id', requireRole(['admin','bdm']), updateActivity)`

**Checkpoint**: `PUT /api/v1/activities/:id` → 200 с обновлёнными полями; overdue пересчитывается через SQL CASE WHEN; 400/404/403 при ошибках

---

## Phase 6: User Story 4 — Удаление активности (Priority: P4)

**Goal**: Admin удаляет активность через DELETE /api/v1/activities/:id

**Independent Test**: `DELETE /api/v1/activities/:id` → 204 (admin); bdm → 403; несуществующая → 404

### Implementation for User Story 4

- [X] T012 [US4] Implement `deleteActivity` in server/controllers/activitiesController.js: (1) `const { rows: [existing] } = await pool.query('SELECT id FROM activities WHERE id=$1', [req.params.id])` — если `!existing` → 404; (2) `await pool.query('DELETE FROM activities WHERE id=$1', [req.params.id])`; (3) `return res.status(204).send()`; добавить в module.exports
- [X] T013 [US4] Add DELETE /:id route to server/routes/activities.js: import `deleteActivity` from activitiesController (добавить к существующему import); `router.delete('/:id', requireRole(['admin']), deleteActivity)`

**Checkpoint**: `DELETE /api/v1/activities/:id` → 204 (admin), 403 (bdm/viewer), 404 (не найдена)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Финальная проверка и ручная валидация

- [X] T014 Verify module.exports in server/controllers/activitiesController.js exports all four: `createActivity`, `listActivitiesForEntity`, `updateActivity`, `deleteActivity`
- [ ] T015 Run quickstart.md §5 smoke test: POST /api/v1/activities → GET /api/v1/accounts/:id/activities → PUT /api/v1/activities/:id {completed:true} → verify overdue=false → DELETE /api/v1/activities/:id → 204

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Нет зависимостей — старт немедленно
- **Phase 2**: Пропущена — нет задач
- **US1 (Phase 3)**: Зависит от T001, T002 (файлы должны существовать); T003 → T004; T005 независим от T004
- **US2 (Phase 4)**: Зависит от T001; T006 → T007/T008/T009 (параллельно)
- **US3 (Phase 5)**: Зависит от T001, T002; T010 → T011
- **US4 (Phase 6)**: Зависит от T001, T002; T012 → T013
- **Polish (Phase 7)**: Зависит от всех фаз

### Порядок изменений в activitiesController.js (строго последовательно)

```
T001 (skeleton) → T003 (createActivity) → T006 (listActivitiesForEntity)
               → T010 (updateActivity) → T012 (deleteActivity)
```

### Параллельные возможности

- T007, T008, T009 — параллельно после T006 (разные файлы: accounts.js / contacts.js / deals.js)
- T004, T005 — параллельно с T006/T010/T012 (routes/activities.js и app.js — разные файлы)
- T011, T013 — параллельно с T006, T012 (разные файлы)

---

## Parallel Example: Phase 4 (List routes)

```bash
# Все три entity-маршрута добавляются независимо после T006:
Task T007: "Add GET /:id/activities to server/routes/accounts.js"
Task T008: "Add GET /:id/activities to server/routes/contacts.js"
Task T009: "Add GET /:id/activities to server/routes/deals.js"
```

---

## Implementation Strategy

### MVP (только US1)

1. T001, T002 (Setup)
2. T003, T004, T005 (US1: создание)
3. **STOP**: Проверить POST вручную
4. Продолжить к US2–US4

### Full Delivery

1. Setup (T001–T002)
2. US1 (T003–T005) → checkpoint
3. US2 (T006–T009) → checkpoint
4. US3 (T010–T011) → checkpoint
5. US4 (T012–T013) → checkpoint
6. Polish (T014–T015)

---

## Notes

- **Route order critical**: `/:id/activities` ПЕРЕД `/:id` в accounts/contacts/deals (T007-T009) — иначе Express перехватит `:id` как UUID
- **overdue в createActivity (T003)**: вычисляется в JS (`act.due_date !== null && new Date(act.due_date) < new Date() && !act.completed`) — owner.name берётся из `req.user.name` (сессия)
- **overdue в list/update (T006, T010)**: вычисляется в SQL через `CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() AND a.completed = false THEN true ELSE false END`
- **Null-inclusive filter**: `(a.due_date IS NULL OR a.due_date >= $X)` — активности с null due_date всегда в результате при date-фильтрах
- **Dynamic WHERE (T006)**: `idx` начинается с 3 (после entity_type=$1 и entity_id=$2)
- **Dynamic SET (T010)**: `idx` начинается с 1; последний параметр (`id`) добавляется после всех SET-параметров
- **Нет каскадных изменений**: DELETE активностей при удалении сущностей уже реализован в F-04/F-05/F-06
- [P] задачи = разные файлы, без blocking зависимостей
