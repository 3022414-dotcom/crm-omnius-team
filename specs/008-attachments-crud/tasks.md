# Tasks: Вложения (Attachments)

**Branch**: `008-attachments-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Design documents from `specs/008-attachments-crud/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Ручное тестирование по quickstart.md (MVP-подход, без unit-тестов)

**Organization**: Задачи сгруппированы по user story. Каждая story независимо тестируема.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Параллельно с другими (разные файлы, нет зависимостей)
- **[Story]**: Привязка к user story из spec.md

---

## Phase 1: Setup (Создание файлов и multer-конфига)

**Purpose**: Создать скелеты новых файлов и настроить multer diskStorage

- [X] T001 Create server/controllers/attachmentsController.js with: `const pool = require('../db/pool')`, `const fs = require('fs')`, `const path = require('path')`, `const multer = require('multer')`, `const { randomUUID } = require('crypto')`; константы `VALID_ENTITY_TYPES=['account','contact','deal']`, `ENTITY_TABLES={account:'accounts',contact:'contacts',deal:'deals'}`, `ENTITY_DIRS={account:'accounts',contact:'contacts',deal:'deals'}`; multer diskStorage с `destination` (fs.mkdirSync рекурсивно в `uploads/{ENTITY_DIRS[entity_type]}/{entity_id}/`) и `filename` (`{uuid}_{file.originalname}`); `const upload = multer({ storage, limits:{ fileSize: 50*1024*1024 } })`; `module.exports = { upload }`
- [X] T002 Create server/routes/attachments.js with: `const express = require('express')`, `const { requireRole } = require('../middleware/auth')`, `const router = express.Router()`, `module.exports = router`

**Checkpoint**: Два файла существуют; `node -e "require('./server/controllers/attachmentsController')"` без ошибок

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Таблица `attachments` создана в F-01, multer уже установлен (F-05), новых миграций и зависимостей не требуется

*(Нет задач — setup достаточен)*

---

## Phase 3: User Story 1 — Загрузка вложения (Priority: P1) 🎯 MVP

**Goal**: Admin/bdm загружает файл к аккаунту, контакту или сделке через POST /api/v1/attachments

**Independent Test**: `POST /api/v1/attachments` multipart `file=@test.pdf entity_type=account entity_id=UUID` → 201 с `{id,file_name,file_size,mime_type,entity_type,entity_id,uploaded_by:{id,name},created_at}` (без `file_path`); файл > 50 MB → 413; невалидный entity_type → 400; несуществующий entity_id → 404; viewer → 403

### Implementation for User Story 1

- [X] T003 [US1] Implement `createAttachment` in server/controllers/attachmentsController.js: проверить `req.file` (400 если нет); взять `entity_type` и `entity_id` из `req.body`; если entity_type не в VALID_ENTITY_TYPES → `fs.unlinkSync(req.file.path)` + 400; если entity_id пустой → `fs.unlinkSync(req.file.path)` + 400; `SELECT id FROM ${ENTITY_TABLES[entity_type]} WHERE id=$1` (если нет → fs.unlinkSync + 404); сформировать `relPath = path.relative(path.join(__dirname,'../../'), req.file.path)`; `INSERT INTO attachments (entity_type,entity_id,file_name,file_path,file_size,mime_type,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`; вернуть 201 с явным маппингом: `{id,file_name:att.file_name,file_size:att.file_size,mime_type:att.mime_type,entity_type:att.entity_type,entity_id:att.entity_id,uploaded_by:{id:req.user.id,name:req.user.name},created_at:att.created_at}` (без file_path); добавить в module.exports
- [X] T004 [US1] Add POST route to server/routes/attachments.js with multer wrapper: `router.post('/', requireRole(['admin','bdm']), (req,res,next) => { upload.single('file')(req,res,(err)=>{ if(err && err.code==='LIMIT_FILE_SIZE') return res.status(413).json({error:'Payload Too Large',message:'Файл не должен превышать 50 MB'}); if(err) return next(err); createAttachment(req,res,next); }); })`; import `createAttachment` from attachmentsController
- [X] T005 [US1] Mount attachmentsRouter in server/app.js: `const attachmentsRouter = require('./routes/attachments')`; `app.use('/api/v1/attachments', attachmentsRouter)` — добавить после notesRouter

**Checkpoint**: `POST /api/v1/attachments` работает — 201 с метаданными, 400/404/403/413 при ошибках; файл появляется в `uploads/accounts/{id}/`

---

## Phase 4: User Story 2 — Просмотр вложений сущности (Priority: P2)

**Goal**: Любой авторизованный пользователь просматривает список вложений через GET /api/v1/{accounts|contacts|deals}/:id/attachments

**Independent Test**: `GET /api/v1/accounts/:id/attachments` → plain array sorted DESC, каждый с `uploaded_by:{id,name}`, без `file_path`; несуществующий entity → 404; нет вложений → `[]`

### Implementation for User Story 2

- [X] T006 [US2] Implement `listAttachmentsForEntity(entityType)` factory in server/controllers/attachmentsController.js: возвращает `async (req,res) => {...}`; внутри — `SELECT id FROM ${ENTITY_TABLES[entityType]} WHERE id=$1` (404 если нет); запрос `SELECT a.id,a.file_name,a.file_size,a.mime_type,a.entity_type,a.entity_id,a.created_at, u.id AS uploader_id,u.name AS uploader_name FROM attachments a JOIN users u ON a.uploaded_by=u.id WHERE a.entity_type=$1 AND a.entity_id=$2 ORDER BY a.created_at DESC`; вернуть `res.json(rows.map(r=>({id:r.id,file_name:r.file_name,file_size:r.file_size,mime_type:r.mime_type,entity_type:r.entity_type,entity_id:r.entity_id,uploaded_by:{id:r.uploader_id,name:r.uploader_name},created_at:r.created_at})))`; добавить в module.exports
- [X] T007 [P] [US2] Add GET /:id/attachments to server/routes/accounts.js: import `listAttachmentsForEntity` from attachmentsController; вставить `router.get('/:id/attachments', listAttachmentsForEntity('account'))` ПЕРЕД существующей строкой `router.get('/:id', getAccountById)`
- [X] T008 [P] [US2] Add GET /:id/attachments to server/routes/contacts.js: import `listAttachmentsForEntity` from attachmentsController; вставить `router.get('/:id/attachments', listAttachmentsForEntity('contact'))` ПЕРЕД существующей строкой `router.get('/:id', getContactById)`
- [X] T009 [P] [US2] Add GET /:id/attachments to server/routes/deals.js: import `listAttachmentsForEntity` from attachmentsController; вставить `router.get('/:id/attachments', listAttachmentsForEntity('deal'))` ПЕРЕД существующей строкой `router.get('/:id', getDealById)`

**Checkpoint**: GET /:entity/:id/attachments работает для accounts, contacts, deals — plain array без file_path или 404

---

## Phase 5: User Story 3 — Скачивание файла (Priority: P3)

**Goal**: Любой авторизованный пользователь скачивает файл через GET /api/v1/attachments/:id/download

**Independent Test**: `GET /api/v1/attachments/:id/download` → файл с `Content-Disposition: attachment; filename="..."` и корректным `Content-Type`; несуществующая запись → 404; файл отсутствует на диске → 404

### Implementation for User Story 3

- [X] T010 [US3] Implement `downloadAttachment` in server/controllers/attachmentsController.js: `SELECT * FROM attachments WHERE id=$1` (404 если нет); `const filePath = path.join(__dirname,'../../', att.file_path)`; `if (!fs.existsSync(filePath)) return res.status(404).json({error:'Not Found'})`; `res.setHeader('Content-Type', att.mime_type || 'application/octet-stream')`; `res.download(filePath, att.file_name, (err)=>{ if(err && !res.headersSent) res.status(500).json({error:'Internal Server Error'}) })`; добавить в module.exports
- [X] T011 [US3] Add GET /:id/download route to server/routes/attachments.js: import `downloadAttachment` from attachmentsController; `router.get('/:id/download', downloadAttachment)`

**Checkpoint**: `GET /api/v1/attachments/:id/download` возвращает файл с Content-Disposition; 404 на отсутствующую запись

---

## Phase 6: User Story 4 — Удаление вложения (Priority: P4)

**Goal**: Admin удаляет вложение через DELETE /api/v1/attachments/:id — файл удаляется с диска, запись из БД

**Independent Test**: `DELETE /api/v1/attachments/:id` → 204 (admin); bdm → 403; несуществующее → 404; файл физически отсутствует на диске после успешного удаления

### Implementation for User Story 4

- [X] T012 [US4] Implement `deleteAttachment` in server/controllers/attachmentsController.js: `SELECT * FROM attachments WHERE id=$1` (404 если нет); `DELETE FROM attachments WHERE id=$1`; `const filePath = path.join(__dirname,'../../', att.file_path)`; `try { fs.unlinkSync(filePath); } catch(e) {}`; вернуть `res.status(204).send()`; добавить в module.exports
- [X] T013 [US4] Add DELETE /:id route to server/routes/attachments.js: import `deleteAttachment` from attachmentsController; `router.delete('/:id', requireRole(['admin']), deleteAttachment)`

**Checkpoint**: `DELETE /api/v1/attachments/:id` → 204 (admin), 403 (bdm/viewer), 404 (не найдено)

---

## Phase 7: Каскадное удаление — модификация существующих контроллеров

**Purpose**: При удалении аккаунта / контакта / сделки — физически удалять файлы вложений + записи из БД

**⚠️ Важно**: Эти задачи модифицируют уже реализованные F-04/F-05/F-06 контроллеры. Добавлять код ПЕРЕД существующим удалением notes/activities.

- [X] T014 [P] Modify `deleteAccount` in server/controllers/accountsController.js: добавить перед строками с DELETE notes/activities: `const { rows: acctAtts } = await pool.query('SELECT file_path FROM attachments WHERE entity_type=$1 AND entity_id=$2', ['account', id]); for (const att of acctAtts) { try { fs.unlinkSync(path.join(__dirname,'../../', att.file_path)); } catch(e) {} } await pool.query('DELETE FROM attachments WHERE entity_type=$1 AND entity_id=$2', ['account', id]);`; добавить в начало файла: `const fs = require('fs')`, `const path = require('path')`
- [X] T015 [P] Modify `deleteContact` in server/controllers/contactsController.js: аналогично T014 с entity_type='contact'; добавить fs и path require; добавить каскадный DELETE attachments + fs.unlinkSync loop ПЕРЕД delete notes/activities
- [X] T016 [P] Modify `deleteDeal` in server/controllers/dealsController.js: аналогично T014 с entity_type='deal'; добавить fs и path require; добавить каскадный DELETE attachments + fs.unlinkSync loop ПЕРЕД delete notes/activities

**Checkpoint**: Удаление аккаунта/контакта/сделки не оставляет orphaned файлов на диске

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Финальная проверка и ручная валидация

- [X] T017 Verify module.exports in server/controllers/attachmentsController.js exports all four: `createAttachment`, `listAttachmentsForEntity`, `downloadAttachment`, `deleteAttachment` (plus `upload` для использования в route)
- [ ] T018 Run quickstart.md §5 smoke test: POST /api/v1/attachments → GET /api/v1/accounts/:id/attachments → GET /api/v1/attachments/:id/download → DELETE /api/v1/attachments/:id → 204

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Нет зависимостей — старт немедленно
- **Phase 2**: Пропущена
- **US1 (Phase 3)**: Зависит от T001, T002
- **US2 (Phase 4)**: Зависит от T001 (для listAttachmentsForEntity); T006 → T007/T008/T009
- **US3 (Phase 5)**: Зависит от T001 (attachmentsController.js существует)
- **US4 (Phase 6)**: Зависит от T002 (notes.js существует)
- **Cascade (Phase 7)**: Независима от Phase 3-6 (разные файлы); может идти параллельно с US2-US4
- **Polish (Phase 8)**: Зависит от всех фаз

### Порядок изменений в attachmentsController.js (строго последовательно)

```
T001 (create + multer) → T003 (createAttachment) → T006 (listAttachmentsForEntity)
                       → T010 (downloadAttachment) → T012 (deleteAttachment)
```

### Параллельные возможности

- T007, T008, T009 — параллельно после T006 (разные файлы)
- T014, T015, T016 — параллельно (разные файлы контроллеров)
- T014-T016 можно выполнять параллельно с T003-T013

---

## Parallel Example: Phase 7 (Cascade Delete)

```bash
# Все три контроллера модифицируются независимо:
Task T014: "Modify accountsController.js deleteAccount"
Task T015: "Modify contactsController.js deleteContact"
Task T016: "Modify dealsController.js deleteDeal"
```

---

## Implementation Strategy

### MVP (только US1)

1. T001, T002 (Setup)
2. T003, T004, T005 (US1: upload)
3. **STOP**: Проверить upload вручную
4. Продолжить к US2-US4 и Phase 7

### Full Delivery

1. Setup (T001–T002)
2. US1 (T003–T005) → checkpoint
3. US2 (T006–T009) → checkpoint
4. US3 (T010–T011) → checkpoint
5. US4 (T012–T013) → checkpoint
6. Cascade (T014–T016) — параллельно → checkpoint
7. Polish (T017–T018)

---

## Notes

- **Multer wrapper в роуте**: 413 перехватывается в router.post(), не в createAttachment
- **Rollback**: fs.unlinkSync(req.file.path) при ошибке валидации entity_type/entity_id
- **file_path в ответе**: НЕ включать — только внутреннее поле (clarification Q1)
- **Route order**: `/:id/attachments` ПЕРЕД `/:id` в accounts/contacts/deals (T007-T009)
- **Phase 7 критична**: без неё удаление сущности оставит orphaned файлы на диске
- **Порядок в deleteAccount/deleteContact/deleteDeal**: attachments файлы → DELETE attachments → DELETE notes → DELETE activities → DELETE entity
- [P] задачи = разные файлы, без blocking зависимостей
