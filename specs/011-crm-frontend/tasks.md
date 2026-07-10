# Tasks: Фронтенд CRM

**Branch**: `011-crm-frontend` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Ручное тестирование по quickstart.md (автотесты вне scope MVP)

---

## Phase 1: Setup — Инициализация проекта

**Goal**: Создать `client/` с настроенным Vite + React + Tailwind + shadcn/ui, готовый к разработке компонентов.

**Checkpoint**: `cd client && npm run dev` → Vite запускается на :5173 без ошибок; `/api/accounts` проксируется на :3000.

- [X] T001 Scaffold frontend-проект: `npm create vite@latest client -- --template react` в корне репо; установить все зависимости из плана: `npm install react-router-dom @tanstack/react-query zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-hook-form zod lucide-react sonner class-variance-authority clsx tailwind-merge` в `client/`
- [X] T002 Настроить Tailwind CSS: установить `tailwindcss postcss autoprefixer` в `client/`; создать `client/tailwind.config.js` (darkMode:'class', content:['./src/**/*.{js,jsx}'], extend colors: primary:'#e0503f', primary-dark:'#c44434'); создать `client/postcss.config.js`; добавить `@tailwind base/components/utilities` + CSS-переменные shadcn/ui в `client/src/index.css`
- [X] T003 Настроить Vite proxy в `client/vite.config.js`: `server.proxy` — `/api` → `http://localhost:3000`, `/auth` → `http://localhost:3000`, `/uploads` → `http://localhost:3000`; `plugins: [react()]`
- [X] T004 Инициализировать shadcn/ui: создать `client/components.json` (style:'default', tailwind baseColor:'slate', cssVariables:true); добавить компоненты через `npx shadcn@latest add button dialog alert-dialog input label select table tabs badge dropdown-menu sheet skeleton` в `client/`
- [X] T005 [P] Создать `client/src/lib/utils.js` — `cn()` helper через `clsx` + `tailwind-merge`; создать `client/.env.example` с `VITE_API_URL=http://localhost:3000`; создать `client/.gitignore` (node_modules, dist, .env)

---

## Phase 2: Foundational — Базовая инфраструктура

**Goal**: API-клиент, auth-стор, тема — всё, от чего зависят все User Story.

**Checkpoint**: `import { apiFetch } from './api/client'` компилируется; Zustand store работает в React DevTools; toggling theme переключает класс `dark` на `<html>`.

- [X] T006 Создать `client/src/api/client.js` — базовая обёртка fetch: `baseURL = import.meta.env.VITE_API_URL || ''`; `credentials:'include'`; JSON-хедеры; при 401 — `window.location.href = '/login'`; экспортировать `apiFetch(path, options)`
- [X] T007 [P] Создать `client/src/stores/authStore.js` — Zustand store: `{ user: null, setUser }` где `user: { id, email, name, role } | null`
- [X] T008 [P] Создать `client/src/api/users.js` — `getMe()` → `GET /api/v1/users/me`; `getUsers()` → `GET /api/v1/users`
- [X] T009 [P] Создать `client/src/hooks/useTheme.js` — при монтировании: читать `localStorage.theme`, fallback `matchMedia('(prefers-color-scheme: dark)')`, применить/убрать класс `dark` на `document.documentElement`; `toggleTheme()` обновляет localStorage и класс; экспортировать `{ theme, toggleTheme }`
- [X] T010 [P] Создать `client/src/components/layout/ThemeToggle.jsx` — кнопка (shadcn Button variant ghost): иконка Sun при dark-теме, Moon при light; onClick → toggleTheme()
- [X] T011 [P] Создать `client/src/components/modals/ConfirmDialog.jsx` — shadcn AlertDialog: props `{ open, title, description, onConfirm, onCancel, loading }`; кнопка подтверждения — variant destructive
- [X] T012 [Backend] Изменить `server/routes/auth.js`: после успешного `req.logIn` заменить `res.redirect('/')` на `res.redirect(process.env.FRONTEND_URL || '/')`; добавить `FRONTEND_URL=http://localhost:5173` в `.env` и `.env.example`
- [X] T013 [Backend] Добавить функцию `listActivities` в `server/controllers/activitiesController.js`: если `req.user.role === 'admin'` — фильтр `($1::uuid IS NULL OR a.owner_id = $1)` где `$1 = req.query.owner_id || null`; иначе — `a.owner_id = req.user.id`; query-фильтры: `completed`, `type`; ORDER BY `due_date ASC NULLS LAST, created_at DESC`; JOIN users; добавить в `module.exports`
- [X] T014 [Backend] Добавить маршрут `GET /` в `server/routes/activities.js`: `router.get('/', listActivities)` — СТРОГО перед любым `router.get('/:id', ...)` если таковой появится; импортировать `listActivities`
- [X] T015 [Backend] Добавить в `server/app.js` production-статику: после всех `/api/v1/` маршрутов добавить блок `if (process.env.NODE_ENV === 'production') { app.use(express.static(path.join(__dirname,'..','client','dist'))); app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'..','client','dist','index.html'))); }`

---

## Phase 3: User Story 1 — Авторизация и защита маршрутов (Priority: P1)

**Goal**: Неавторизованный пользователь видит страницу входа; авторизованный попадает в CRM и остаётся залогиненным при обновлении страницы.

**Independent Test**: Открыть `http://localhost:5173` без сессии → страница входа; нажать «Войти через Google» → OAuth → редирект обратно на :5173; обновить вкладку → остаться авторизованным; открыть DevTools → cookies → `connect.sid` присутствует.

- [X] T016 [US1] Создать `client/src/pages/Login.jsx`: центрированная карточка (shadcn Card); логотип `https://omnius.team/logo-omnius.png`; заголовок «omnius.team CRM»; кнопка «Войти через Google» (onClick: `window.location.href='/auth/google'`); применить акцентный цвет primary (#e0503f) к кнопке
- [X] T017 [US1] Создать `client/src/App.jsx`: `createBrowserRouter` с маршрутами: `/login` → `<Login>`; `/` → `<ProtectedRoute>` → `<AppShell>` с children-маршрутами (placeholder для US2+); `*` → redirect `/accounts`; при монтировании ProtectedRoute — вызвать `getMe()`, записать в authStore; показать spinner до получения ответа; при 401 → navigate('/login')
- [X] T018 [US1] Создать `client/src/main.jsx`: обернуть `<RouterProvider>` в `<QueryClientProvider client={new QueryClient()}>` + `<Toaster/>` (sonner); подключить `./index.css`

---

## Phase 4: User Story 2 — Оболочка приложения и навигация (Priority: P1)

**Goal**: После входа — постоянная боковая навигация со всеми разделами; мобильный бургер < 768px; переключатель темы; выход из аккаунта.

**Independent Test**: Видна боковая панель с 5 пунктами; активный пункт — левая граница #e0503f; < 768px — панель скрыта, бургер-кнопка открывает/закрывает; переключатель темы работает; кнопка «Выйти» → `window.location.href='/auth/logout'`.

- [X] T019 [US2] Создать `client/src/components/layout/Sidebar.jsx`: логотип сверху (`<img src="https://omnius.team/logo-omnius.png">`); NavLink-список: Аккаунты(/accounts), Контакты(/contacts), Сделки(/deals), Kanban(/kanban), Активности(/activities); активная ссылка — `border-l-4 border-primary text-primary`; снизу — имя пользователя из authStore + кнопка «Выйти» (onClick: `window.location.href='/auth/logout'`)
- [X] T020 [US2] Создать `client/src/components/layout/AppShell.jsx`: flex-layout `h-screen`; `<Sidebar>` фиксированная слева (w-64, hidden md:flex); main area = Header + `<Outlet>`; Header: пустое место + `<ThemeToggle>`; на мобиле — бургер-кнопка открывает shadcn `<Sheet>` с `<Sidebar>` внутри
- [X] T021 [US2] Добавить `/accounts`, `/contacts`, `/deals`, `/kanban`, `/activities` как placeholder-маршруты (временный `<div>TODO</div>`) в `App.jsx` в качестве children AppShell — чтобы навигация работала до реализации страниц

---

## Phase 5: User Story 3 — Аккаунты (Priority: P1)

**Goal**: Список аккаунтов с поиском; детальная страница с вкладками; CRUD-операции по ролям.

**Independent Test**: `/accounts` → таблица с данными; поиск фильтрует; «Создать» → модал → сохранить → аккаунт в списке; клик → детальная; «Редактировать» → модал с данными; admin «Удалить» → диалог → удалён.

- [X] T022 [US3] Создать `client/src/api/accounts.js` — функции: `getAccounts({search,owner_id})` → `GET /api/v1/accounts`; `getAccount(id)`; `createAccount(data)` → POST; `updateAccount(id,data)` → PUT; `deleteAccount(id)` → DELETE; `getAccountContacts(id)`, `getAccountNotes(id)`, `getAccountAttachments(id)`, `getAccountActivities(id)`
- [X] T023 [US3] Создать `client/src/pages/accounts/AccountsList.jsx`: `useQuery(['accounts', search], getAccounts)`; shadcn Table (name, industry, owner, created_at); поиск — input с debounce или Enter; кнопка «Создать» (visible: role !== 'viewer'); кнопки «Ред.»/«Удал.» в строке по ролям
- [X] T024 [US3] Создать `AccountFormModal` (внутри `client/src/pages/accounts/`): shadcn Dialog; react-hook-form; поля: name(required), industry, website, phone, address, owner_id (select из getUsers()); onSubmit → createAccount или updateAccount; sonner toast успех/ошибка; `useMutation` + `queryClient.invalidateQueries(['accounts'])`
- [X] T025 [US3] Создать `client/src/pages/accounts/AccountDetail.jsx`: `useQuery(['account', id], getAccount)`; карточка с полями; кнопки Edit/Delete (по ролям); shadcn Tabs: Контакты / Сделки / Заметки / Вложения / Активности; вкладки Заметки/Вложения/Активности — placeholder до US7; вкладки Контакты/Сделки — реализуются в T055/T056; Delete → ConfirmDialog → `deleteAccount(id)` → navigate('/accounts') + toast
- [X] T055 [US3] Реализовать вкладку «Контакты» в `AccountDetail.jsx`: `useQuery(['account-contacts', id], () => getAccountContacts(id))`; таблица (имя, должность, email); каждая строка — ссылка на `/contacts/:id`; empty state «Нет контактов»; кнопка «Добавить контакт» для admin/bdm не нужна здесь (привязка идёт со страницы контакта через account_id)
- [X] T056 [US3] Реализовать вкладку «Сделки» в `AccountDetail.jsx`: `useQuery(['account-deals', id], () => getDeals({account_id: id}))`; таблица (title, value, stage badge, close_date, owner); каждая строка — ссылка на `/deals/:id`; empty state «Нет сделок»
- [X] T026 [US3] Заменить placeholder маршрутов `/accounts` и `/accounts/:id` в `App.jsx` реальными компонентами `AccountsList` и `AccountDetail`

---

## Phase 6: User Story 4 — Контакты (Priority: P1)

**Goal**: Список контактов с поиском; детальная страница с фото; CRUD по ролям.

**Independent Test**: `/contacts` → таблица; поиск по имени/email; клик → детальная с фото или аватаром-заглушкой; загрузить фото (< 5MB, image/*) → отображается; создать контакт → в списке; admin удалить → подтверждение.

- [X] T027 [US4] Создать `client/src/api/contacts.js` — `getContacts({search})`, `getContact(id)`, `createContact(data)`, `updateContact(id,data)`, `deleteContact(id)`, `uploadContactPhoto(id, file)` → POST multipart, `deleteContactPhoto(id)`, `getContactNotes(id)`, `getContactAttachments(id)`, `getContactActivities(id)`
- [X] T028 [US4] Создать `client/src/pages/contacts/ContactsList.jsx`: таблица (avatar/заглушка, first+last name, position, email, account); поиск; RBAC-кнопки
- [X] T029 [US4] Создать `ContactFormModal` в `client/src/pages/contacts/`: поля first_name(required), last_name(required), email, phone, position, account_id(select), owner_id(select)
- [X] T030 [US4] Создать `client/src/pages/contacts/ContactDetail.jsx`: фото (img из `/uploads/...` или аватар-заглушка); поля контакта; кнопка загрузки фото (input type=file, клиентская проверка: `file.size <= 5*1024*1024 && file.type.startsWith('image/')`, иначе toast ошибка); shadcn Tabs (Заметки/Вложения/Активности — placeholder до US7); Delete → ConfirmDialog
- [X] T031 [US4] Заменить placeholder маршрутов `/contacts` и `/contacts/:id` в `App.jsx` реальными компонентами

---

## Phase 7: User Story 5 — Сделки (Priority: P1)

**Goal**: Список сделок с фильтрами; детальная страница с контактами и сменой стадии; CRUD по ролям.

**Independent Test**: `/deals` → список; фильтр по stage → обновляется; «Создать» → модал → в списке; клик → детальная; сменить stage → сохраняется; привязать контакт → появляется в списке.

- [X] T032 [US5] Создать `client/src/api/deals.js` — `getDeals({stage,account_id,owner_id})`, `getDeal(id)`, `createDeal(data)`, `updateDeal(id,data)`, `deleteDeal(id)`, `updateDealStage(id,stage)` → PATCH, `getKanban({owner_id})`, `linkContact(dealId,contactId)`, `unlinkContact(dealId,contactId)`, `getDealNotes(id)`, `getDealAttachments(id)`, `getDealActivities(id)`
- [X] T033 [US5] Создать `client/src/pages/deals/DealsList.jsx`: таблица (title, value, stage badge, account, owner, close_date); фильтры: stage(select), owner_id(select, admin видит всех); RBAC-кнопки; `useQuery(['deals', filters], getDeals)`
- [X] T034 [US5] Создать `DealFormModal` в `client/src/pages/deals/`: поля title(required), value(number), stage(select, default 'lead'), close_date(date), account_id(select), owner_id(select)
- [X] T035 [US5] Создать `client/src/pages/deals/DealDetail.jsx`: поля сделки; stage — inline select (PATCH /deals/:id/stage при изменении); список связанных контактов + кнопка добавить/убрать (admin/bdm); shadcn Tabs (Заметки/Вложения/Активности — placeholder до US7); Delete → ConfirmDialog
- [X] T036 [US5] Заменить placeholder маршрутов `/deals` и `/deals/:id` в `App.jsx` реальными компонентами

---

## Phase 8: User Story 6 — Kanban-доска (Priority: P2)

**Goal**: 6 колонок по стадиям; drag-and-drop меняет стадию (admin/bdm); фильтр по владельцу; пустые колонки присутствуют.

**Independent Test**: `/kanban` → 6 колонок; перетащить карточку → стадия обновлена в API; обновить страницу → карточка в новой колонке; viewer не может перетаскивать.

- [X] T037 [US6] Создать `client/src/pages/kanban/KanbanBoard.jsx`: `useQuery(['kanban', ownerFilter], getKanban)`; `DndContext onDragEnd` — PATCH /deals/:id/stage, optimistic update через `queryClient.setQueryData`; если admin — select владельца; рендерить 6 `<KanbanColumn>` по порядку `['lead','qualified','proposal','negotiation','won','lost']`
- [X] T038 [US6] Создать `client/src/pages/kanban/KanbanColumn.jsx`: `useDroppable({id: stage})`; заголовок колонки (label + badge с количеством); `<KanbanCard>` для каждой карточки; empty state «Нет сделок» если массив пуст
- [X] T039 [US6] Создать `client/src/pages/kanban/KanbanCard.jsx`: `useDraggable({id: deal.id})`; отображает title, value, account, owner, contacts_count, close_date; `disabled = user.role === 'viewer'` (draggable не активируется); hover-стиль с тенью
- [X] T040 [US6] Заменить placeholder маршрута `/kanban` в `App.jsx` реальным компонентом `KanbanBoard`

---

## Phase 9: User Story 7 — Заметки, Вложения, Активности в контексте сущности (Priority: P2)

**Goal**: Вкладки на детальных страницах Аккаунтов, Контактов, Сделок работают с полным CRUD по ролям.

**Independent Test**: На AccountDetail → вкладка Заметки → создать заметку → в списке; вкладка Вложения → загрузить файл ≤50MB → скачать → admin удалить; вкладка Активности → создать → отметить выполненной → overdue-активность выделена красным.

- [X] T041 [US7] Создать `client/src/api/notes.js` — `createNote({entity_type,entity_id,content})` → POST `/api/v1/notes`; `updateNote(id,{content})` → PUT; `deleteNote(id)` → DELETE
- [X] T042 [US7] Создать `client/src/api/attachments.js` — `uploadAttachment({entityType,entityId,file})` → POST `/api/v1/attachments` multipart; `downloadAttachment(id)` → GET `/api/v1/attachments/:id/download` (open in new tab); `deleteAttachment(id)` → DELETE
- [X] T043 [US7] Создать `client/src/api/activities.js` — `createActivity(data)` → POST `/api/v1/activities`; `updateActivity(id,data)` → PUT; `deleteActivity(id)` → DELETE; `listActivities(filters)` → GET `/api/v1/activities` с query-params
- [X] T044 [US7] Создать `client/src/components/tabs/NotesTab.jsx`: props `{entityType, entityId}`; `useQuery` → getNotes(entityType,entityId); textarea для новой заметки (admin/bdm) — inline-редактирование допустимо (заметки исключены из FR-011, inline — стандартная UX-практика); кнопка «Удалить» только для admin; удаление через ConfirmDialog («Удалить заметку?»); `useMutation` + invalidate + toast
- [X] T045 [US7] Создать `client/src/components/tabs/AttachmentsTab.jsx`: props `{entityType, entityId}`; список файлов (name, size, uploaded_by, download-ссылка); upload input (клиентская валидация: `file.size <= 50*1024*1024`, иначе toast «Файл превышает 50 MB»); кнопка «Удалить» только для admin; удаление через ConfirmDialog («Удалить файл {name}?»); `useMutation` + invalidate + toast
- [X] T046 [US7] Создать `client/src/components/tabs/ActivitiesTab.jsx`: props `{entityType, entityId}`; загрузка — `get{EntityType}Activities(entityId)` из соответствующего api-файла (accounts/contacts/deals), НЕ `listActivities`; список: badge по типу (call/email/meeting/task); просроченные (`overdue=true`) — `text-red-500`; чекбокс «Выполнено» → updateActivity({completed:true}); create — shadcn Dialog-модал: поля type(select), description, due_date; кнопка «Удалить» для admin — ConfirmDialog («Удалить активность?»); `useMutation` + invalidate + toast
- [X] T047 [US7] Заменить placeholder-контент вкладок «Заметки», «Вложения», «Активности» в `AccountDetail.jsx`, `ContactDetail.jsx`, `DealDetail.jsx` реальными компонентами `NotesTab`, `AttachmentsTab`, `ActivitiesTab`

---

## Phase 10: FR-012 — Глобальная страница активностей (Priority: P2)

**Goal**: `/activities` — список всех активностей; admin видит всех с фильтром по пользователю; bdm/viewer — только свои; фильтры по статусу и типу; просроченные выделены.

**Independent Test**: `/activities` → список; admin видит активности всей команды; фильтр по owner → только его; фильтр completed=false → только открытые; overdue выделены красным; complete-toggle работает без перезагрузки.

- [X] T048 [FR012] Создать `client/src/pages/activities/ActivitiesList.jsx`: `useQuery(['activities', filters], listActivities)`; фильтры: completed (toggle All/Открытые/Выполненные), type (select All/call/email/meeting/task); если `user.role === 'admin'` — дополнительный select владельца (getUsers()); список: тип-badge, description, due_date, entity (тип+ссылка на сущность), owner; `overdue=true` → `bg-red-50 dark:bg-red-950`; чекбокс «Выполнено» → updateActivity + invalidate
- [X] T049 [FR012] Заменить placeholder маршрута `/activities` в `App.jsx` реальным компонентом `ActivitiesList`

---

## Phase 11: User Story 8 — UX-полировка (Priority: P3)

**Goal**: Лоадеры, тосты, диалоги подтверждения, обработка ошибок — везде единообразно.

**Independent Test**: Долгая загрузка → скелетон виден; успешное создание → toast «Создано»; удаление без ConfirmDialog невозможно; ошибка 500 → понятное сообщение.

- [X] T050 [US8] Добавить shadcn Skeleton-лоадеры в `AccountsList.jsx`, `ContactsList.jsx`, `DealsList.jsx`, `KanbanBoard.jsx` — при `isLoading = true` показывать скелетон таблицы/колонок вместо пустого экрана
- [X] T051 [US8] Аудит toast-уведомлений: убедиться что каждый `useMutation` в create/update/delete/upload имеет `onSuccess: () => toast.success(...)` и `onError: (e) => toast.error(e.message || 'Ошибка сервера')`; пройти по AccountFormModal, ContactFormModal, DealFormModal, NotesTab, AttachmentsTab, ActivitiesTab
- [X] T052 [US8] Создать `client/src/pages/ErrorPage.jsx` — пользовательская страница ошибок (404: «Страница не найдена», 403: «Нет доступа», 500: «Что-то пошло не так. Попробуйте позже.»); добавить `errorElement: <ErrorPage/>` в router

---

## Phase 12: Polish

- [X] T053 Обновить корневой `package.json` — добавить скрипты: `"dev:client": "cd client && npm run dev"`, `"build:client": "cd client && npm run build"`
- [ ] T054 Smoke test по quickstart.md §1–§9: auth flow, тема, навигация, CRUD аккаунтов, Kanban drag-and-drop, RBAC viewer, глобальные активности, production build

---

## Dependencies

```
T001–T005 (Setup)
    ↓
T006–T015 (Foundational + Backend)
    ↓
T016–T018 (US1: Auth)
    ↓
T019–T021 (US2: Shell)
    ↓
T022–T026  T027–T031  T032–T036   ← параллельно (US3/US4/US5)
    ↓           ↓           ↓
         T037–T040 (US6: Kanban)
         T041–T047 (US7: Entity Tabs)
         T048–T049 (FR-012: Global Activities)
    ↓
T050–T052 (US8: Polish)
    ↓
T053–T054 (Final)
```

**Параллельные возможности**:
- Foundational: T007, T008, T009, T010, T011 — разные файлы, независимы
- После US2: US3 (accounts), US4 (contacts), US5 (deals) — разные директории, можно параллельно
- US6, US7, FR-012 — независимы между собой, можно параллельно после US3–US5

## Notes

- Каждый US3/US4/US5 detail-page содержит вкладки-placeholder'ы — они заменяются в US7 (T047)
- Backend-задачи T012–T015 не блокируют frontend-разработку (можно мокировать API); но необходимы для полного smoke test
- T006 (api/client.js) — единственная точка входа для всех API-вызовов; все api/*.js используют только `apiFetch`
- Kanban optimistic update (T037): `queryClient.setQueryData(['kanban'], oldData => {...})` — обновить массив карточек локально до ответа API; откатить в `onError`
- shadcn компоненты устанавливаются в `client/src/components/ui/` — не трогать сгенерированный код
