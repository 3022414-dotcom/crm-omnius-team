# omnius.team CRM — All Features MVP

Все 11 фич MVP с Acceptance Criteria (Given/When/Then), Tech Notes и Edge Cases.

Порядок разработки: F-01 → F-02 → F-03 → F-04 → F-05 → F-06 → F-07 → F-08 → F-09 → F-10 → F-11

---

## F-01: Схема БД и миграции

**Цель**: Создать полную схему PostgreSQL через node-pg-migrate. База для всех остальных фич.

### Acceptance Criteria

**AC-01.1: Создание схемы через миграции**
- Given: чистая БД PostgreSQL
- When: запускается `npm run migrate`
- Then: создаются все 9 таблиц (users, accounts, contacts, deals, deal_contacts, notes, attachments, activities, session), все индексы и триггеры

**AC-01.2: Идемпотентность**
- Given: миграции уже применены
- When: запускается `npm run migrate` повторно
- Then: команда завершается без ошибок, таблицы не дублируются

**AC-01.3: Seed начальных данных**
- Given: схема создана
- When: запускается `npm run seed`
- Then: в таблицу users добавлены 4 участника команды с корректными ролями

### Tech Notes
- Миграционные файлы: `server/migrations/YYYYMMDDHHMMSS_initial_schema.js`
- node-pg-migrate: файлы с функциями `up` и `down`
- Триггер `set_updated_at` создаётся один раз, применяется ко всем таблицам с `updated_at`
- UUID через `gen_random_uuid()` (встроен в PostgreSQL 13+)
- Расширение `pgcrypto` не нужно
- Сессионная таблица создаётся connect-pg-simple или вручную в миграции

### Edge Cases
- Миграция падает при отсутствии DATABASE_URL → понятное сообщение об ошибке
- Если БД содержит таблицы от предыдущего запуска — `down` миграция должна всё чисто удалить

### Таблицы и поля

Полная схема описана в `.specify/memory/constitution.md` (раздел III "Схема таблиц MVP").

---

## F-02: Google SSO авторизация

**Цель**: Вход только через Google OAuth 2.0. Доступ только для pre-approved пользователей из таблицы users.

### Acceptance Criteria

**AC-02.1: Успешный вход**
- Given: пользователь существует в таблице users (email совпадает)
- When: пользователь нажимает "Войти через Google" и проходит OAuth
- Then: сессия создаётся, пользователь перенаправляется на главную страницу CRM

**AC-02.2: Отказ в доступе**
- Given: Google-аккаунт не добавлен Admin в таблицу users
- When: пользователь проходит OAuth с незарегистрированным аккаунтом
- Then: вход отклонён, отображается понятное сообщение "Доступ запрещён. Обратитесь к администратору."

**AC-02.3: Выход**
- Given: пользователь авторизован
- When: пользователь нажимает "Выйти"
- Then: сессия уничтожается, пользователь перенаправляется на страницу входа

**AC-02.4: Защита маршрутов**
- Given: пользователь не авторизован
- When: пользователь обращается к любому защищённому маршруту `/api/v1/*`
- Then: возвращается 401 Unauthorized

**AC-02.5: Сохранение сессии**
- Given: пользователь авторизован
- When: сервер перезапускается
- Then: сессия сохраняется (хранится в PostgreSQL), пользователь остаётся авторизованным

### Tech Notes
- Passport.js + passport-google-oauth20
- Стратегия: GoogleStrategy с callback `/auth/google/callback`
- При OAuth callback: матчинг по email (нижний регистр), обновление google_id если пусто
- Сессии: express-session + connect-pg-simple
- SESSION_SECRET минимум 32 символа из env
- Cookie: httpOnly, secure в prod, sameSite: 'lax'
- Middleware `ensureAuthenticated` — проверка `req.isAuthenticated()`
- Middleware `ensureRole(roles[])` — проверка `req.user.role`

### Edge Cases
- Google возвращает email без подтверждения → проверять `profile._json.email_verified`
- Пользователь заблокирован (удалён из users) → активные сессии должны инвалидироваться
- Попытка OAuth без настроенных Google credentials → понятная ошибка при старте сервера

---

## F-03: Роли и права доступа

**Цель**: Ролевая модель (RBAC). Три роли: admin, bdm, viewer.

### Acceptance Criteria

**AC-03.1: Admin — полный доступ**
- Given: пользователь с ролью admin
- When: обращается к любому API-эндпоинту (GET/POST/PUT/DELETE)
- Then: запрос выполняется

**AC-03.2: BDM — чтение + создание/редактирование**
- Given: пользователь с ролью bdm
- When: обращается к GET, POST, PUT эндпоинтам accounts/contacts/deals/notes/attachments/activities
- Then: запрос выполняется

**AC-03.3: BDM — запрет на удаление**
- Given: пользователь с ролью bdm
- When: обращается к DELETE эндпоинту
- Then: возвращается 403 Forbidden

**AC-03.4: Viewer — только чтение**
- Given: пользователь с ролью viewer
- When: обращается к GET эндпоинтам
- Then: запрос выполняется

**AC-03.5: Viewer — запрет на запись**
- Given: пользователь с ролью viewer
- When: обращается к POST/PUT/DELETE эндпоинту
- Then: возвращается 403 Forbidden

### Tech Notes
- Middleware `requireRole(allowedRoles)` применяется на уровне роутов
- Роль хранится в `req.user.role` (из сессии)
- Матрица доступа:

| Действие | admin | bdm | viewer |
|----------|-------|-----|--------|
| GET (все ресурсы) | ✓ | ✓ | ✓ |
| POST (создание) | ✓ | ✓ | ✗ |
| PUT (редактирование) | ✓ | ✓ | ✗ |
| DELETE (удаление) | ✓ | ✗ | ✗ |
| Управление users | ✓ | ✗ | ✗ |

### Edge Cases
- Попытка изменить свою роль → запрещено для всех (включая admin)
- Удаление последнего admin → запрещено системой

---

## F-04: Аккаунты (Accounts)

**Цель**: CRUD для компаний/организаций — клиентов и потенциальных клиентов.

### Acceptance Criteria

**AC-04.1: Создание аккаунта**
- Given: авторизованный пользователь с ролью admin или bdm
- When: отправляет POST /api/v1/accounts с name (обязательное), остальные поля опциональны
- Then: аккаунт создан, возвращается 201 с объектом аккаунта

**AC-04.2: Просмотр списка**
- Given: авторизованный пользователь
- When: GET /api/v1/accounts
- Then: возвращается массив аккаунтов с пагинацией (page, limit)

**AC-04.3: Поиск**
- Given: авторизованный пользователь
- When: GET /api/v1/accounts?search=текст
- Then: возвращаются аккаунты, в названии которых содержится текст (case-insensitive)

**AC-04.4: Редактирование**
- Given: авторизованный пользователь с ролью admin или bdm
- When: PUT /api/v1/accounts/:id
- Then: аккаунт обновлён, возвращается обновлённый объект

**AC-04.5: Удаление**
- Given: пользователь с ролью admin
- When: DELETE /api/v1/accounts/:id
- Then: аккаунт удалён (каскадно: контакты переходят в NULL account_id, сделки, заметки, вложения, активности удаляются)

### Tech Notes
- Поля: id, name*, industry, website, phone, address, notes, owner_id, created_at, updated_at
- Пагинация: параметры page (default: 1), limit (default: 20, max: 100)
- owner_id устанавливается автоматически = req.user.id при создании
- При удалении: contacts.account_id → SET NULL, остальное → CASCADE DELETE

### Edge Cases
- Создание с дублирующимся name → разрешено (нет уникальности по названию)
- Удаление аккаунта с активными сделками → UI предупреждает, данные каскадно удаляются

---

## F-05: Контакты (Contacts)

**Цель**: CRUD для контактных лиц, привязанных к аккаунтам. Включает загрузку фото.

### Acceptance Criteria

**AC-05.1: Создание контакта**
- Given: авторизованный пользователь с ролью admin или bdm
- When: POST /api/v1/contacts с first_name и last_name (обязательные)
- Then: контакт создан, возвращается 201 с объектом

**AC-05.2: Просмотр контактов аккаунта**
- Given: авторизованный пользователь
- When: GET /api/v1/accounts/:id/contacts
- Then: возвращаются все контакты аккаунта

**AC-05.3: Поиск контактов**
- Given: авторизованный пользователь
- When: GET /api/v1/contacts?search=текст
- Then: поиск по first_name, last_name, email (case-insensitive)

**AC-05.4: Загрузка фото**
- Given: авторизованный пользователь с ролью admin или bdm
- When: POST /api/v1/contacts/:id/photo с файлом изображения (multipart/form-data)
- Then: файл сохраняется в uploads/contacts/{id}/, photo_path обновляется в БД, возвращается URL фото

**AC-05.5: Удаление фото**
- Given: контакт имеет фото
- When: DELETE /api/v1/contacts/:id/photo
- Then: файл удаляется с диска, photo_path = NULL в БД

**AC-05.6: Редактирование и удаление**
- Given: авторизованный пользователь с нужной ролью
- When: PUT /api/v1/contacts/:id или DELETE /api/v1/contacts/:id
- Then: операция выполняется успешно

### Tech Notes
- Поля: id, first_name*, last_name*, email, phone, position, photo_path (nullable VARCHAR(500)), account_id (FK → accounts, nullable), owner_id, created_at, updated_at
- **photo_path** — это ОТДЕЛЬНЫЙ механизм, НЕ через таблицу attachments
- Путь к фото: `uploads/contacts/{contact_id}/avatar_{uuid}.ext`
- Только один файл фото на контакт (при повторной загрузке — заменяет старый)
- Допустимые форматы фото: jpeg, jpg, png, webp
- Максимальный размер: 5 MB
- multer хранит в памяти (memoryStorage), затем записывается вручную через fs
- При удалении контакта: файл фото удаляется с диска

### Edge Cases
- Загрузка не-изображения → 400 Bad Request
- Файл > 5 MB → 413 Payload Too Large
- Контакт без аккаунта → разрешено (account_id = NULL)
- При удалении контакта с фото → файл удаляется автоматически

---

## F-06: Сделки (Deals)

**Цель**: CRUD для сделок. Воронка продаж с этапами.

### Acceptance Criteria

**AC-06.1: Создание сделки**
- Given: авторизованный пользователь с ролью admin или bdm
- When: POST /api/v1/deals с title (обязательный)
- Then: сделка создана со stage = 'lead', возвращается 201

**AC-06.2: Смена этапа**
- Given: сделка существует
- When: PUT /api/v1/deals/:id с полем stage
- Then: stage обновляется, если значение валидно (lead/qualified/proposal/negotiation/won/lost)

**AC-06.3: Привязка контактов к сделке**
- Given: сделка и контакт существуют
- When: POST /api/v1/deals/:id/contacts с {contact_id}
- Then: связь создаётся в deal_contacts

**AC-06.4: Просмотр списка с фильтрами**
- Given: авторизованный пользователь
- When: GET /api/v1/deals?stage=lead&account_id=UUID
- Then: возвращается отфильтрованный список с пагинацией

**AC-06.5: Удаление сделки**
- Given: пользователь с ролью admin
- When: DELETE /api/v1/deals/:id
- Then: сделка удалена, связанные заметки/вложения/активности/deal_contacts удаляются каскадно

### Tech Notes
- Поля: id, title*, value (DECIMAL(15,2)), stage (ENUM), close_date (DATE), account_id (FK → accounts), owner_id (FK → users), created_at, updated_at
- Этапы: lead → qualified → proposal → negotiation → won/lost
- deal_contacts: составной PK (deal_id, contact_id)
- Фильтры: stage, account_id, owner_id, date range по close_date

### Edge Cases
- Попытка установить невалидный stage → 400 Bad Request
- Привязка одного контакта дважды → игнорируется (ON CONFLICT DO NOTHING)
- Сделка без аккаунта → разрешено

---

## F-07: Заметки (Notes)

**Цель**: Текстовые заметки к аккаунтам, контактам и сделкам. Полиморфная ассоциация.

### Acceptance Criteria

**AC-07.1: Создание заметки**
- Given: авторизованный пользователь с ролью admin или bdm
- When: POST /api/v1/notes с {entity_type, entity_id, content}
- Then: заметка создана, author_id = req.user.id, возвращается 201

**AC-07.2: Просмотр заметок сущности**
- Given: авторизованный пользователь
- When: GET /api/v1/accounts/:id/notes (или contacts или deals)
- Then: возвращаются заметки сущности, отсортированные по created_at DESC

**AC-07.3: Редактирование заметки**
- Given: авторизованный пользователь (автор или admin)
- When: PUT /api/v1/notes/:id с {content}
- Then: заметка обновлена

**AC-07.4: Удаление заметки**
- Given: пользователь с ролью admin (или автор — если admin)
- When: DELETE /api/v1/notes/:id
- Then: заметка удалена

### Tech Notes
- Поля: id, entity_type (ENUM: account/contact/deal), entity_id (UUID), content (TEXT*), author_id (FK → users), created_at, updated_at
- Индекс: (entity_type, entity_id)
- entity_id не имеет FK-constraint (полиморфная ассоциация) — ссылочную целостность обеспечивает CASCADE DELETE через ON DELETE CASCADE на entity

### Edge Cases
- Заметка к несуществующей сущности → 404
- Пустой content → 400 Bad Request
- При удалении родительской сущности → заметки удаляются каскадно

---

## F-08: Вложения (Attachments)

**Цель**: Загрузка и хранение файлов к аккаунтам, контактам и сделкам.

> **Важно**: Фото контакта — это ОТДЕЛЬНЫЙ механизм (F-05, поле photo_path). Файлы в F-08 НЕ включают фото контакта.

### Acceptance Criteria

**AC-08.1: Загрузка вложения**
- Given: авторизованный пользователь с ролью admin или bdm
- When: POST /api/v1/attachments с файлом (multipart/form-data) и {entity_type, entity_id}
- Then: файл сохранён, запись в attachments создана, возвращается 201 с метаданными файла

**AC-08.2: Просмотр вложений сущности**
- Given: авторизованный пользователь
- When: GET /api/v1/accounts/:id/attachments (или contacts или deals)
- Then: список вложений с метаданными (без содержимого файла)

**AC-08.3: Скачивание файла**
- Given: авторизованный пользователь
- When: GET /api/v1/attachments/:id/download
- Then: файл отправляется с корректными заголовками Content-Disposition

**AC-08.4: Удаление вложения**
- Given: пользователь с ролью admin
- When: DELETE /api/v1/attachments/:id
- Then: файл удалён с диска, запись удалена из БД

### Tech Notes
- Поля: id, entity_type (ENUM: account/contact/deal), entity_id (UUID), file_name (VARCHAR*), file_path (VARCHAR*), file_size (INTEGER), mime_type (VARCHAR), uploaded_by (FK → users), created_at
- Путь к файлу: `uploads/{entity_type}s/{entity_id}/{uuid}_{original_name}`
- Максимальный размер: 50 MB
- multer diskStorage
- При удалении вложения: файл удаляется с диска (fs.unlink)

### Edge Cases
- Файл > 50 MB → 413
- Диск переполнен → 500 с понятным сообщением
- При удалении сущности → вложения удаляются (файлы + записи в БД)
- Запрос несуществующего файла → 404

---

## F-09: Активности (Activities)

**Цель**: Задачи и история взаимодействий (звонки, встречи, письма, задачи) к сущностям CRM.

### Acceptance Criteria

**AC-09.1: Создание активности**
- Given: авторизованный пользователь с ролью admin или bdm
- When: POST /api/v1/activities с {type, entity_type, entity_id, description}
- Then: активность создана с completed = false, возвращается 201

**AC-09.2: Отметка выполнения**
- Given: активность существует
- When: PUT /api/v1/activities/:id с {completed: true}
- Then: completed = true, updated_at обновлён

**AC-09.3: Просмотр активностей сущности**
- Given: авторизованный пользователь
- When: GET /api/v1/accounts/:id/activities (или contacts или deals)
- Then: список активностей с фильтром по статусу (completed/pending)

**AC-09.4: Удаление активности**
- Given: пользователь с ролью admin
- When: DELETE /api/v1/activities/:id
- Then: активность удалена

### Tech Notes
- Поля: id, type (ENUM: call/email/meeting/task), entity_type (ENUM: account/contact/deal), entity_id (UUID), description (TEXT), due_date (TIMESTAMPTZ), completed (BOOLEAN DEFAULT FALSE), owner_id (FK → users), created_at, updated_at
- Фильтры: type, completed, due_date range

### Edge Cases
- Просроченные активности (due_date в прошлом, completed = false) → помечаются как overdue в ответе API
- При удалении родительской сущности → активности удаляются каскадно

---

## F-10: Kanban-доска

**Цель**: Визуализация сделок по этапам воронки в формате Kanban.

### Acceptance Criteria

**AC-10.1: Получение данных Kanban**
- Given: авторизованный пользователь
- When: GET /api/v1/deals/kanban
- Then: возвращается объект с ключами по этапам (lead, qualified, proposal, negotiation, won, lost), каждый содержит массив сделок

**AC-10.2: Перемещение карточки**
- Given: авторизованный пользователь с ролью admin или bdm
- When: PUT /api/v1/deals/:id/stage с {stage: "proposal"}
- Then: stage сделки обновляется, возвращается обновлённая сделка

**AC-10.3: Фильтрация Kanban**
- Given: авторизованный пользователь
- When: GET /api/v1/deals/kanban?owner_id=UUID
- Then: возвращаются только сделки указанного владельца

### Tech Notes
- Kanban — это представление данных deals, не отдельная таблица
- API возвращает сделки, сгруппированные по stage
- В карточке: id, title, value, account (name), owner (name), close_date, contacts count
- Порядок этапов: lead → qualified → proposal → negotiation → won → lost

### Edge Cases
- Пустая колонка → возвращается пустой массив (не ошибка)
- Сделка в стадии won/lost остаётся на доске (архивирование — в бэклоге)

---

## F-11: UI/UX общий

**Цель**: Общая оболочка интерфейса: навигация, авторизация, адаптивность.

> Фронтенд-фреймворк (Next.js или React+Vite) выбирается до начала F-11. Зависит от F-04 — F-10 (все API готовы).

### Acceptance Criteria

**AC-11.1: Страница входа**
- Given: неавторизованный пользователь
- When: открывает любой URL CRM
- Then: перенаправляется на страницу входа с кнопкой "Войти через Google"

**AC-11.2: Навигация**
- Given: авторизованный пользователь
- When: смотрит на боковую панель
- Then: видит разделы: Аккаунты, Контакты, Сделки, Kanban, Активности

**AC-11.3: Адаптивность**
- Given: пользователь открывает CRM на планшете или мобильном
- When: ширина экрана < 768px
- Then: навигация сворачивается в бургер-меню, контент адаптируется

**AC-11.4: Уведомления об ошибках**
- Given: операция завершилась с ошибкой (403, 404, 500)
- Then: пользователь видит понятное сообщение об ошибке (не сырой JSON)

**AC-11.5: Подтверждение деструктивных операций**
- Given: пользователь нажимает "Удалить" на любой сущности
- When: сущность имеет связанные данные
- Then: отображается диалог подтверждения с перечислением того, что будет удалено

### Tech Notes
- Компонентная библиотека: на усмотрение, предпочтение простым решениям
- Состояние: React Context или Zustand (не Redux)
- Запросы: fetch или axios, без GraphQL
- Типизация: TypeScript (если Next.js)

### Edge Cases
- Потеря сессии во время работы → автоматический редирект на страницу входа
- Медленное соединение → скелетон-лоадеры

---

*Документ актуален для MVP. Фичи бэклога (архивирование, экспорт, уведомления и т.д.) не включены.*
