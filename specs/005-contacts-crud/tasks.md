# Tasks: Контакты (Contacts)

**Input**: Design documents from `specs/005-contacts-crud/`

**Feature**: F-05 Contacts CRUD | **Branch**: `005-contacts-crud`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Не включены (ручное тестирование по quickstart.md — MVP-подход)

**Organization**: Задачи сгруппированы по 5 user stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно запускать параллельно (разные файлы, нет зависимостей)
- **[Story]**: К какой user story относится задача (US1–US5)
- Все пути от корня репозитория (`server/`, `uploads/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Новая инфраструктура, нужная всем user stories

- [ ] T001 Create `server/middleware/upload.js` — multer config: `memoryStorage()`, `ALLOWED_MIMETYPES = ['image/jpeg','image/jpg','image/png','image/webp']`, `MAX_SIZE = 5 * 1024 * 1024`, fileFilter по mimetype, экспортировать `{ upload }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Скелеты файлов + монтирование в app.js — БЛОКИРУЕТ все user stories

**⚠️ CRITICAL**: Ни одна user story не начинается до завершения этой фазы

- [ ] T002 Create `server/controllers/contactsController.js` — скелет: импорты `pool`, `path`, `fs`, `{ randomUUID } from 'crypto'`; вспомогательные функции `validateAccountId(accountId)` (SELECT из accounts, throw 400 если не найден) и `savePhoto(contactId, file)` (mkdirSync + writeFile + return path); константы `CONTACT_FIELDS` и `UPDATABLE_FIELDS = ['first_name','last_name','email','phone','position','account_id']`; пустой `module.exports = {}`
- [ ] T003 Create `server/routes/contacts.js` — скелет: `express.Router()`, импорт `requireRole` из `../middleware/auth`; пустой router, `module.exports = router`
- [ ] T004 Modify `server/app.js` — добавить `const contactsRouter = require('./routes/contacts')`, `app.use('/api/v1/contacts', contactsRouter)`, `app.use('/uploads', express.static('uploads'))` (отдача файлов фото как статики)

**Checkpoint**: Сервер запускается без ошибок; `/api/v1/contacts` возвращает пустые ответы (роуты ещё не добавлены)

---

## Phase 3: User Story 1 — Создание контакта (Priority: P1) 🎯 MVP

**Goal**: Пользователи с ролью admin/bdm могут создавать карточку контакта с именем и фамилией

**Independent Test**: `POST /api/v1/contacts {first_name:"Иван",last_name:"Иванов"}` → 201 с объектом; без first_name → 400; viewer → 403

### Implementation for User Story 1

- [ ] T005 [US1] Add `createContact` to `server/controllers/contactsController.js` — валидация first_name/last_name (trim, 400 если пустые), вызов `validateAccountId(account_id)` если передан, INSERT INTO contacts с owner_id=req.user.id, RETURNING CONTACT_FIELDS, ответ 201; добавить в module.exports
- [ ] T006 [US1] Add route in `server/routes/contacts.js` — `router.post('/', requireRole(['admin', 'bdm']), createContact)` с импортом createContact

**Checkpoint**: US1 полностью работает — создание контакта, валидация, RBAC

---

## Phase 4: User Story 2 — Просмотр и поиск контактов (Priority: P2)

**Goal**: Любой авторизованный пользователь видит список контактов с поиском и пагинацией; список контактов аккаунта; карточку конкретного контакта

**Independent Test**: `GET /api/v1/contacts` → `{data:[...],total:N,page:1,limit:20}`; `?search=иванов` → фильтрованный список; `GET /api/v1/accounts/:id/contacts` → envelope; `GET /api/v1/contacts/:id` → объект или 404

### Implementation for User Story 2

- [ ] T007 [P] [US2] Add `listContacts` to `server/controllers/contactsController.js` — парсинг page/limit с bounds-check (page≥1, limit≤100), search ILIKE по first_name/last_name/email через `WHERE ($1='' OR (...))`, COUNT запрос для total, возвращает `{data,total,page,limit}`; добавить в module.exports
- [ ] T008 [P] [US2] Add `getContactById` to `server/controllers/contactsController.js` — `SELECT CONTACT_FIELDS FROM contacts WHERE id=$1`, 404 если не найден; добавить в module.exports
- [ ] T009 [P] [US2] Add `listContactsByAccount` to `server/controllers/contactsController.js` — сначала проверить существование аккаунта (404 если нет), затем SELECT контактов с `WHERE account_id=$1` + pagination, возвращает envelope `{data,total,page,limit}`; добавить в module.exports
- [ ] T010 [US2] Add routes in `server/routes/contacts.js` — `router.get('/', listContacts)` и `router.get('/:id', getContactById)` (без ограничений роли — все авторизованные)
- [ ] T011 [US2] Modify `server/routes/accounts.js` — добавить `const { listContactsByAccount } = require('../controllers/contactsController')`, затем `router.get('/:id/contacts', listContactsByAccount)` **ПЕРЕД** строкой `router.get('/:id', getAccountById)` (важен порядок регистрации!)

**Checkpoint**: US2 полностью работает — глобальный список, поиск, список по аккаунту, просмотр контакта

---

## Phase 5: User Story 3 — Редактирование контакта (Priority: P3)

**Goal**: Пользователи с ролью admin/bdm обновляют отдельные поля контакта — только переданные поля изменяются

**Independent Test**: `PUT /api/v1/contacts/:id {phone:"+7..."}` → 200, только phone изменился; пустой body `{}` → 200 без изменений; пустое first_name → 400

### Implementation for User Story 3

- [ ] T012 [US3] Add `updateContact` to `server/controllers/contactsController.js` — динамический SET-clause (итерация по UPDATABLE_FIELDS, только присутствующие в body поля), валидация: если first_name/last_name переданы — не пустые; если account_id передан и не null — validateAccountId(); пустой body → возвращает текущие данные (200); UPDATE с `updated_at=NOW()`, 404 если не найден; добавить в module.exports
- [ ] T013 [US3] Add route in `server/routes/contacts.js` — `router.put('/:id', requireRole(['admin', 'bdm']), updateContact)`

**Checkpoint**: US3 полностью работает — partial update, валидация, RBAC

---

## Phase 6: User Story 4 — Управление фотографией (Priority: P4)

**Goal**: Пользователи с ролью admin/bdm загружают и удаляют фото контакта; замена старого файла; ограничения на формат и размер

**Independent Test**: `POST /:id/photo` с JPEG → 200 `{photo_url}`, photo_path в БД обновлён; повторная загрузка — старый файл удалён; текстовый файл → 400; >5MB → 413; `DELETE /:id/photo` → 200, photo_path=null

### Implementation for User Story 4

- [ ] T014 [P] [US4] Add `uploadContactPhoto` to `server/controllers/contactsController.js` — проверить req.file (400 если нет), SELECT photo_path; 404 если контакт не найден; unlink старого файла если был (`catch(()=>{})`); вызвать savePhoto(); UPDATE photo_path + updated_at; ответ `{photo_url: '/'+newPath}`; добавить в module.exports
- [ ] T015 [P] [US4] Add `deleteContactPhoto` to `server/controllers/contactsController.js` — SELECT photo_path; 404 если контакт не найден; если photo_path — unlink (`catch(()=>{})`); UPDATE photo_path=null + updated_at; ответ `{}`; добавить в module.exports
- [ ] T016 [US4] Add photo routes in `server/routes/contacts.js` — добавить импорт `{ upload }` из `../middleware/upload` и импорт uploadContactPhoto/deleteContactPhoto; `router.post('/:id/photo', requireRole(['admin','bdm']), (req,res,next) => { upload.single('photo')(req,res,(err) => { if(err instanceof multer.MulterError && err.code==='LIMIT_FILE_SIZE') return res.status(413)...; if(err?.message==='INVALID_FILE_TYPE') return res.status(400)...; if(err) return next(err); uploadContactPhoto(req,res,next); }); })` и `router.delete('/:id/photo', requireRole(['admin','bdm']), deleteContactPhoto)` — добавить импорт multer

**Checkpoint**: US4 полностью работает — загрузка/замена/удаление фото, ограничения формата и размера

---

## Phase 7: User Story 5 — Удаление контакта (Priority: P5)

**Goal**: Пользователи с ролью admin удаляют контакт; каскад: deal_contacts (DB), фото (app-level)

**Independent Test**: `DELETE /api/v1/contacts/:id` → 204; GET → 404; файл фото удалён; bdm → 403

### Implementation for User Story 5

- [ ] T017 [US5] Add `deleteContact` to `server/controllers/contactsController.js` — SELECT photo_path (404 если не найден); DELETE FROM contacts WHERE id=$1 (DB CASCADE удаляет deal_contacts); после успешного DELETE: если photo_path был — unlink (`catch(()=>{})`); ответ 204; добавить в module.exports
- [ ] T018 [US5] Add route in `server/routes/contacts.js` — `router.delete('/:id', requireRole(['admin']), deleteContact)`

**Checkpoint**: US5 полностью работает — удаление с каскадом и очисткой файла

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Доработки, затрагивающие несколько user stories

- [ ] T019 Verify `.gitignore` в корне репозитория содержит `uploads/` — добавить если отсутствует
- [ ] T020 Manual quickstart.md validation — прогнать сценарии §1–§6 из `specs/005-contacts-crud/quickstart.md` через curl; отметить результаты

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Нет зависимостей — можно начать немедленно
- **Phase 2 (Foundational)**: Зависит от Phase 1 — **БЛОКИРУЕТ** все user stories
- **Phase 3 (US1)**: Зависит от Phase 2
- **Phase 4 (US2)**: Зависит от Phase 2; T011 зависит от T009
- **Phase 5 (US3)**: Зависит от Phase 2
- **Phase 6 (US4)**: Зависит от Phase 1 (upload.js) и Phase 2
- **Phase 7 (US5)**: Зависит от Phase 2
- **Phase 8 (Polish)**: Зависит от всех завершённых user stories

### User Story Dependencies

- **US1 (P1)**: Стартует после Phase 2 — нет зависимостей от других US
- **US2 (P2)**: Стартует после Phase 2 — T011 читает из accounts.js, но не зависит от US1 данных
- **US3 (P3)**: Стартует после Phase 2 — независима
- **US4 (P4)**: Стартует после Phase 1+2 — независима
- **US5 (P5)**: Стартует после Phase 2 — независима

### Within Each User Story

- Controller function → route registration (строгий порядок)
- T011: обязательно добавить ДО строки `router.get('/:id', ...)` в accounts.js
- T016: inline multer wrapper должен импортировать `multer` из пакета для проверки `instanceof multer.MulterError`

### Parallel Opportunities

- T007, T008, T009 — можно писать параллельно (одного файла касаются T007/T008/T009, но каждая функция независима → последовательно в одном файле)
- T014, T015 — можно писать параллельно (разные функции одного файла → последовательно)
- После Phase 2: US1, US2, US3, US4, US5 — могут разрабатываться параллельно разными разработчиками (разные ветки функций контроллера)

---

## Parallel Example: US4 — Photo Management

```bash
# Эти задачи затрагивают разные функции, можно разрабатывать параллельно:
Task T014: "Add uploadContactPhoto() to contactsController.js"
Task T015: "Add deleteContactPhoto() to contactsController.js"
# Затем последовательно:
Task T016: "Add photo routes (зависит от T014 и T015)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: US1 (T005–T006)
4. **STOP и VALIDATE**: `POST /api/v1/contacts` работает, 400/403 валидация работает
5. Proceed to US2

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 (US1) → создание контактов (MVP!)
3. Phase 4 (US2) → просмотр и поиск
4. Phase 5 (US3) → редактирование
5. Phase 6 (US4) → фотографии
6. Phase 7 (US5) → удаление
7. Phase 8 → polish и quickstart-валидация

---

## Notes

- [P] tasks = разные файлы или независимые функции в одном файле — пишутся в одном файле последовательно
- [Story] label связывает задачу с конкретной user story для трассировки
- T011 в accounts.js: порядок регистрации роутов критичен — `/:id/contacts` ПЕРЕД `/:id`
- T016: multer inline handler — import multer явно для проверки `err instanceof multer.MulterError`
- Все controller-функции — async; express-async-errors уже установлен (F-03)
- deleteContact: unlink файла ПОСЛЕ DELETE из БД (D-07 из research.md)
- validateAccountId: `if (!accountId) return` — null/undefined допустимы (account_id не обязателен)
