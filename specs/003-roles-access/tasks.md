# Tasks: Роли и права доступа (RBAC)

**Input**: Design documents from `specs/003-roles-access/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/users-api.md ✅

**Tests**: Ручная проверка по quickstart.md (автоматизированные тесты не запрошены в spec)

**Organization**: Задачи сгруппированы по User Story для независимой реализации и тестирования каждой истории.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно выполнять параллельно (разные файлы, нет незавершённых зависимостей)
- **[Story]**: User Story из spec.md (US1–US5)

---

## Phase 1: Setup

**Purpose**: Базовая инфраструктура для парсинга тел запросов — требуется для PATCH endpoint.

- [x] T001 Добавить `express.json()` и `express.urlencoded({ extended: false })` в server/app.js перед middleware `/api/v1`

**Checkpoint**: Body parsing работает — PATCH /api/v1/users/:id/role может читать `req.body.role`

---

## Phase 2: Foundational — requireRole Middleware (US1, US2)

**Purpose**: Централизованный механизм проверки роли — блокирует ВСЕ запросы с недостаточными правами. Это ядро US1 и US2.

**⚠️ CRITICAL**: Ни одна User Story не может быть проверена до завершения этой фазы.

- [x] T002 Добавить функцию `requireRole(allowedRoles)` в server/middleware/auth.js и добавить её в `module.exports` рядом с `ensureAuthenticated`

  Функция возвращает middleware: если `req.user.role` не входит в `allowedRoles` → `res.status(403).json({ error: 'Forbidden', message: 'Недостаточно прав для выполнения операции' })`, иначе `next()`.

**Checkpoint**: `requireRole(['admin'])` применённый к тестовому маршруту возвращает 403 для bdm/viewer и пропускает admin. US1 и US2 логически выполнены.

---

## Phase 3: US5 — Просмотр собственного профиля (Priority: P3)

**Goal**: Любой авторизованный пользователь может получить данные своего профиля через GET /api/v1/users/me

**Independent Test**: `curl -b cookies.txt http://localhost:3000/api/v1/users/me` возвращает 200 с `{ id, name, email, role, created_at }` для любой роли; 401 без авторизации

### Implementation

- [x] T003 [US5] Создать server/controllers/usersController.js с функцией `getMe(req, res)` — возвращает `{ id, name, email, role, created_at }` из `req.user` (поле `google_id` не включать)
- [x] T004 [US5] Создать server/routes/users.js с маршрутом `GET /me` (без `requireRole` — `ensureAuthenticated` из app.js уже применён к `/api/v1`)
- [x] T005 [US5] Подключить users router в server/app.js: `app.use('/api/v1/users', usersRouter)` — добавить после строки `app.use('/api/v1', ensureAuthenticated)`

**Checkpoint**: GET /api/v1/users/me → 200 для admin, bdm, viewer; 401 для неавторизованных. US5 выполнена.

---

## Phase 4: US3 + US1/US2 — Управление пользователями (Admin Only) (Priority: P1, P2, P3)

**Goal**: Admin может просматривать список пользователей и отдельные профили. Этот же набор маршрутов подтверждает US1 (bdm/viewer получает 403) и US2 (admin получает 200).

**Independent Test**: 
- `GET /api/v1/users` → admin: 200 со списком 4 пользователей; bdm/viewer: 403
- `GET /api/v1/users/:id` → admin: 200 или 404; bdm/viewer: 403

### Implementation

- [x] T006 [P] [US3] Добавить функцию `listUsers(req, res)` в server/controllers/usersController.js — `SELECT id, name, email, role, created_at FROM users ORDER BY name`; возвращает массив
- [x] T007 [P] [US3] Добавить функцию `getUserById(req, res)` в server/controllers/usersController.js — `SELECT id, name, email, role, created_at FROM users WHERE id = $1`; возвращает 404 если не найден
- [x] T008 [US3] Добавить в server/routes/users.js маршрут `GET /` с `requireRole(['admin'])` — подключить `listUsers` контроллер (регистрировать ПОСЛЕ маршрута `/me`)
- [x] T009 [US3] Добавить в server/routes/users.js маршрут `GET /:id` с `requireRole(['admin'])` — подключить `getUserById` контроллер

**Checkpoint**: Весь набор маршрутов работает согласно матрице доступа. US1, US2 и US3 выполнены.

---

## Phase 5: US4 — Защита от опасных операций (Priority: P4)

**Goal**: Изменение роли пользователей через PATCH /api/v1/users/:id/role с двумя guards: запрет self-role-change и защита последнего admin.

**Independent Test**:
- PATCH своей роли → 403 "Нельзя изменить собственную роль"
- PATCH роли единственного admin → 403 "Невозможно изменить роль единственного администратора"
- PATCH роли другого пользователя admin'ом → 200 с обновлённым профилем

### Implementation

- [x] T010 [US4] Добавить функцию `updateUserRole(req, res)` в server/controllers/usersController.js со следующей логикой:
  1. Валидация: `role` из `req.body` должен быть одним из `['admin', 'bdm', 'viewer']` → иначе 400 `{ error: 'Bad Request', message: 'Недопустимое значение роли. Допустимые значения: admin, bdm, viewer' }`
  2. Self-role guard: если `req.user.id === req.params.id` → 403 `{ error: 'Forbidden', message: 'Нельзя изменить собственную роль' }`
  3. Last-admin guard: если целевой пользователь — admin, выполнить `SELECT COUNT(*) FROM users WHERE role = 'admin'`; если count = 1 → 403 `{ error: 'Forbidden', message: 'Невозможно изменить роль единственного администратора' }`
  4. Обновление: `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, created_at`; если не найден → 404; иначе → 200 с обновлённым объектом

- [x] T011 [US4] Добавить в server/routes/users.js маршрут `PATCH /:id/role` с `requireRole(['admin'])` — подключить `updateUserRole` контроллер

**Checkpoint**: Все 4 сценария из quickstart.md §3-5 работают корректно. US4 выполнена.

---

## Phase 6: Polish & Validation

**Purpose**: Финальная проверка и документация.

- [x] T012 [P] Убедиться, что в server/routes/users.js маршрут `GET /me` зарегистрирован РАНЬШЕ `GET /:id` (иначе Express перехватит 'me' как :id параметр)
- [ ] T013 [P] Пройти все 7 сценариев из specs/003-roles-access/quickstart.md и убедиться в корректности ответов

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Нет зависимостей — начать сразу
- **Phase 2 (Foundational)**: Зависит от Phase 1; блокирует все User Stories
- **Phase 3 (US5)**: Зависит от Phase 2; независима от Phase 4/5
- **Phase 4 (US3)**: Зависит от Phase 2 и Phase 3 (router уже создан в T004); T006 и T007 параллельны
- **Phase 5 (US4)**: Зависит от Phase 4 (router и контроллер уже созданы)
- **Phase 6 (Polish)**: Зависит от всех предыдущих фаз

### User Story Dependencies

- **US5 (P3)**: После Phase 2 — независима
- **US3 (P3)**: После Phase 2 + Phase 3 (использует тот же router)
- **US1+US2 (P1+P2)**: Middleware готов после Phase 2; полностью демонстрируется после Phase 4
- **US4 (P4)**: После Phase 4 (нужен существующий router)

### Within Each Phase

- T006 и T007 (handlers) — параллельны (разные функции в одном файле, если осторожно)
- T008 после T006, T009 после T007 (нужны handler-функции)
- T012 — перепроверка существующего файла, можно параллельно с T013

---

## Parallel Examples

```bash
# Phase 4: T006 и T007 можно выполнять параллельно:
Task: "Add listUsers handler to server/controllers/usersController.js"
Task: "Add getUserById handler to server/controllers/usersController.js"

# Phase 6: T012 и T013 параллельны:
Task: "Verify /me route ordering in server/routes/users.js"
Task: "Run quickstart.md validation scenarios"
```

---

## Implementation Strategy

### MVP First (US1+US2 Core, P1+P2)

1. Phase 1: Setup (T001)
2. Phase 2: requireRole middleware (T002) ← US1/US2 logical completion
3. Phase 3: /me endpoint (T003-T005) ← US5
4. Phase 4: Admin routes (T006-T009) ← US3 + US1/US2 demonstrated
5. **STOP and VALIDATE**: Все 4 роли, матрица доступа, GET /me

### Incremental Delivery

1. T001-T002 → RBAC middleware ready
2. T003-T005 → /me works for all roles
3. T006-T009 → admin user management + 403 blocking visible
4. T010-T011 → full protection logic
5. T012-T013 → validated and complete

---

## Notes

- `[P]` задачи = разные файлы или независимые функции, нет незавершённых зависимостей
- Маршрут `/me` ОБЯЗАТЕЛЬНО до `/:id` в router (D-05 из research.md)
- `google_id` никогда не возвращается в API-ответах (D-06 из research.md)
- `requireRole` не делает DB-запросов — роль уже в `req.user` из deserializeUser F-02
- Единственный DB-запрос в этой фиче (помимо SELECT для listUsers/getUserById) — COUNT admins в updateUserRole
