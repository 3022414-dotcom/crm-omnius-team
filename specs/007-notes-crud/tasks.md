# Tasks: Заметки (Notes)

**Branch**: `007-notes-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Design documents from `specs/007-notes-crud/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Ручное тестирование по quickstart.md (MVP-подход, без unit-тестов)

**Organization**: Задачи сгруппированы по user story. Каждая story независимо тестируема.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Параллельно с другими (разные файлы, нет зависимостей)
- **[Story]**: Привязка к user story из spec.md

---

## Phase 1: Setup (Создание файлов)

**Purpose**: Создать скелеты новых файлов перед реализацией user stories

- [X] T001 Create server/controllers/notesController.js with: `const pool = require('../db')`, `const VALID_ENTITY_TYPES = ['account','contact','deal']`, `const ENTITY_TABLES = { account:'accounts', contact:'contacts', deal:'deals' }`, and `module.exports = {}`
- [X] T002 Create server/routes/notes.js with: `const express = require('express')`, `const router = express.Router()`, `const { requireRole } = require('../middleware/auth')`, and `module.exports = router`

**Checkpoint**: Два новых файла существуют; сервер стартует без ошибок (маршруты ещё не подключены)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Таблица `notes` создана в F-01, новых миграций и зависимостей не требуется — фаза пропускается

*(Нет задач — setup достаточен)*

---

## Phase 3: User Story 1 — Создание заметки (Priority: P1) 🎯 MVP

**Goal**: Admin/bdm создаёт текстовую заметку к аккаунту, контакту или сделке

**Independent Test**: `POST /api/v1/notes {"entity_type":"account","entity_id":"<UUID>","content":"Звонок состоялся"}` → 201 с `{id,content,entity_type,entity_id,author:{id,name},created_at,updated_at}`; пустой content → 400; невалидный entity_type → 400; несуществующий entity_id → 404; viewer → 403

### Implementation for User Story 1

- [X] T003 [US1] Implement `createNote` in server/controllers/notesController.js: validate `entity_type` via `VALID_ENTITY_TYPES` (400 иначе); validate `entity_id` exists via `SELECT id FROM ${ENTITY_TABLES[entity_type]} WHERE id=$1` (404 иначе); trim `content`, проверить непустой (400 иначе); `INSERT INTO notes (entity_type, entity_id, content, author_id) VALUES ($1,$2,$3,$4) RETURNING *`; вернуть 201 с **явным маппингом** (НЕ spread `{...note}`): `res.status(201).json({ id:note.id, content:note.content, entity_type:note.entity_type, entity_id:note.entity_id, author:{id:req.user.id, name:req.user.name}, created_at:note.created_at, updated_at:note.updated_at })`; добавить в module.exports
- [X] T004 [US1] Add POST route to server/routes/notes.js: import `createNote` from notesController; `router.post('/', requireRole(['admin','bdm']), createNote)`
- [X] T005 [US1] Mount notesRouter in server/app.js: `const notesRouter = require('./routes/notes')`; `app.use('/api/v1/notes', notesRouter)` — добавить после строки с dealsRouter

**Checkpoint**: `POST /api/v1/notes` работает — 201 при успехе, 400/404/403 при ошибках

---

## Phase 4: User Story 2 — Просмотр заметок сущности (Priority: P2)

**Goal**: Любой авторизованный пользователь просматривает заметки через GET /api/v1/{accounts|contacts|deals}/:id/notes

**Independent Test**: `GET /api/v1/accounts/:id/notes` → plain array `[...]` sorted DESC, каждая с `author:{id,name}`; несуществующий id → 404; нет заметок → `[]`

### Implementation for User Story 2

- [X] T006 [US2] Implement `listNotesForEntity(entityType)` factory in server/controllers/notesController.js: функция возвращает `async (req, res) => {...}`; внутри — проверить существование сущности `SELECT id FROM ${ENTITY_TABLES[entityType]} WHERE id=$1` (404 если нет); запрос `SELECT n.id,n.content,n.entity_type,n.entity_id,n.author_id,n.created_at,n.updated_at, u.name AS author_name FROM notes n JOIN users u ON n.author_id=u.id WHERE n.entity_type=$1 AND n.entity_id=$2 ORDER BY n.created_at DESC`; вернуть с **явным маппингом** (НЕ spread `{...r}`): `res.json(rows.map(r => ({ id:r.id, content:r.content, entity_type:r.entity_type, entity_id:r.entity_id, author:{id:r.author_id, name:r.author_name}, created_at:r.created_at, updated_at:r.updated_at })))`; добавить в module.exports
- [X] T007 [P] [US2] Add GET /:id/notes to server/routes/accounts.js: import `listNotesForEntity` from notesController; вставить `router.get('/:id/notes', listNotesForEntity('account'))` ПЕРЕД существующей строкой `router.get('/:id', getAccountById)`
- [X] T008 [P] [US2] Add GET /:id/notes to server/routes/contacts.js: import `listNotesForEntity` from notesController; вставить `router.get('/:id/notes', listNotesForEntity('contact'))` ПЕРЕД существующей строкой `router.get('/:id', getContactById)`
- [X] T009 [P] [US2] Add GET /:id/notes to server/routes/deals.js: import `listNotesForEntity` from notesController; вставить `router.get('/:id/notes', listNotesForEntity('deal'))` ПЕРЕД существующей строкой `router.get('/:id', getDealById)`

**Checkpoint**: GET /:entity/:id/notes работает для accounts, contacts и deals — plain array или 404

---

## Phase 5: User Story 3 — Редактирование заметки (Priority: P3)

**Goal**: Автор заметки или admin изменяет content через PUT /api/v1/notes/:id

**Independent Test**: `PUT /api/v1/notes/:id {"content":"Обновлённый текст"}` → 200 с обновлённым объектом (автор); bdm не-автор → 403; admin → 200 на чужой заметке; пустой content → 400; несуществующая → 404

### Implementation for User Story 3

- [X] T010 [US3] Implement `updateNote` in server/controllers/notesController.js: trim `content`, проверить непустой (400); `SELECT * FROM notes WHERE id=$1` (404 если нет); проверить `note.author_id !== req.user.id && req.user.role !== 'admin'` → 403; `UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *`; `SELECT name FROM users WHERE id=$1` с `updated.author_id` для authorName; вернуть 200 с **явным маппингом** (НЕ spread `{...updated}`): `res.json({ id:updated.id, content:updated.content, entity_type:updated.entity_type, entity_id:updated.entity_id, author:{id:updated.author_id, name:authorName}, created_at:updated.created_at, updated_at:updated.updated_at })`; добавить в module.exports
- [X] T011 [US3] Add PUT route to server/routes/notes.js: import `updateNote` from notesController; `router.put('/:id', requireRole(['admin','bdm']), updateNote)`

**Checkpoint**: `PUT /api/v1/notes/:id` работает — 200/400/403/404 проверяются

---

## Phase 6: User Story 4 — Удаление заметки (Priority: P4)

**Goal**: Автор заметки или admin удаляет заметку через DELETE /api/v1/notes/:id

**Independent Test**: `DELETE /api/v1/notes/:id` → 204 (автор или admin); bdm не-автор → 403; несуществующая → 404; после удаления заметка отсутствует в GET списке

### Implementation for User Story 4

- [X] T012 [US4] Implement `deleteNote` in server/controllers/notesController.js: `SELECT * FROM notes WHERE id=$1` (404 если нет); проверить `note.author_id !== req.user.id && req.user.role !== 'admin'` → 403; `DELETE FROM notes WHERE id=$1`; вернуть `res.status(204).send()`; добавить в module.exports
- [X] T013 [US4] Add DELETE route to server/routes/notes.js: import `deleteNote` from notesController; `router.delete('/:id', requireRole(['admin','bdm']), deleteNote)`

**Checkpoint**: `DELETE /api/v1/notes/:id` работает — 204/403/404 проверяются

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Финальная проверка целостности и ручная валидация

- [X] T014 Verify module.exports in server/controllers/notesController.js exports all four: `createNote`, `updateNote`, `deleteNote`, `listNotesForEntity`
- [ ] T015 Run quickstart.md §5 smoke test: POST /api/v1/notes → GET /api/v1/accounts/:id/notes (проверить 1 заметку) → DELETE /api/v1/notes/:id → 204; итоговый список пустой

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Нет зависимостей — старт немедленно
- **Phase 2**: Пропущена (нет задач)
- **US1 (Phase 3)**: Зависит от T001 (notesController.js), T002 (notes.js)
- **US2 (Phase 4)**: Зависит от T001 (для listNotesForEntity); T006 → T007/T008/T009
- **US3 (Phase 5)**: Зависит от US1 (notes.js router существует с POST маршрутом)
- **US4 (Phase 6)**: Зависит от US3 (логически, один файл — notes.js)
- **Polish (Phase 7)**: Зависит от всех user stories

### User Story Dependencies

- **US1 (P1)**: Старт после T001, T002 — создаёт первый рабочий эндпоинт
- **US2 (P2)**: Старт после T001 — T006 последовательно, затем T007/T008/T009 параллельно
- **US3 (P3)**: Старт после US1 (notes.js и notesController.js существуют)
- **US4 (P4)**: Старт после US3 (продолжение того же controller)

### Порядок изменений в notesController.js (один файл — строго последовательно)

```
T001 (create) → T003 (createNote) → T006 (listNotesForEntity) → T010 (updateNote) → T012 (deleteNote)
```

### Параллельные возможности

- T007, T008, T009 — независимые файлы, запускаются одновременно после T006
- T005 (app.js) — можно выполнить параллельно с T007/T008/T009

---

## Parallel Example: User Story 2 (List Notes)

```bash
# После T006 (listNotesForEntity реализована) — T007/T008/T009 одновременно:
Task T007: "Add /:id/notes to accounts.js"   # accounts.js
Task T008: "Add /:id/notes to contacts.js"   # contacts.js
Task T009: "Add /:id/notes to deals.js"      # deals.js
```

---

## Implementation Strategy

### MVP (только US1)

1. T001, T002 — Setup
2. T003, T004, T005 — US1: создание заметки
3. **STOP**: Проверить `POST /api/v1/notes` вручную
4. Продолжить к US2 при готовности

### Full Delivery (все 4 stories)

1. Setup (T001–T002)
2. US1 (T003–T005) → checkpoint
3. US2 (T006–T009) → checkpoint
4. US3 (T010–T011) → checkpoint
5. US4 (T012–T013) → checkpoint
6. Polish (T014–T015)

---

## Notes

- **Критично**: `/:id/notes` ДОЛЖЕН быть зарегистрирован ПЕРЕД `/:id` в каждом роутере (T007–T009) — иначе Express поглощает маршрут
- **module.exports** растёт инкрементально: `{}` → `{createNote}` → `{createNote,listNotesForEntity}` → `{...,updateNote}` → `{...,deleteNote}`
- **Record-level check**: `note.author_id !== req.user.id && req.user.role !== 'admin'` — inline в T010 и T012, без отдельного middleware
- Новых npm-пакетов нет, новых миграций нет
- [P] задачи — разные файлы, без blocking зависимостей
