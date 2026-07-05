# Feature Specification: Активности (Activities)

**Feature Branch**: `009-activities-crud`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "F-09 Активности (Activities) — задачи и история взаимодействий к аккаунтам, контактам и сделкам. Полиморфная ассоциация. Типы: call/email/meeting/task. Поля: type, entity_type, entity_id, description, due_date, completed. Фильтрация по status (completed/pending), type, due_date range. Поле overdue (due_date в прошлом + completed=false) вычисляется в API-ответе."

## Clarifications

### Session 2026-07-05

- Q: Может ли admin/bdm выставить completed: false на уже выполненной активности (отменить выполнение)? → A: Да — двусторонний toggle: completed можно установить как true, так и false в любой момент
- Q: При фильтрации по due_date_from/to — активности без due_date (null) показываются или скрываются? → A: Показываются — активности без due_date всегда включаются в результат, даже когда применён date-фильтр

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Создание активности (Priority: P1)

Пользователь с ролью admin или bdm фиксирует взаимодействие или создаёт задачу к существующему аккаунту, контакту или сделке. Указывает тип (звонок, письмо, встреча, задача), описание и при необходимости — срок выполнения. Активность создаётся со статусом «не выполнена».

**Why this priority**: Создание активностей — базовая операция, без которой просмотр, обновление и удаление невозможны. P1 — ядро фичи.

**Independent Test**: `POST /api/v1/activities` с {type:"call", entity_type:"account", entity_id:UUID} → 201 с объектом {id, type, entity_type, entity_id, description, due_date, completed:false, overdue:false, owner:{id,name}, created_at, updated_at}; невалидный type → 400; несуществующий entity_id → 404; viewer → 403.

**Acceptance Scenarios**:

1. **Given** пользователь с ролью admin или bdm авторизован, **When** он создаёт активность с валидными type, entity_type и entity_id, **Then** возвращается 201 с полным объектом активности; completed=false; owner = текущий пользователь
2. **Given** пользователь создаёт активность без due_date, **When** запрос выполнен, **Then** due_date=null, overdue=false
3. **Given** пользователь указывает type не из списка call/email/meeting/task, **When** запрос отправлен, **Then** возвращается 400 Bad Request
4. **Given** пользователь не указывает type, **When** запрос отправлен, **Then** возвращается 400 Bad Request
5. **Given** пользователь указывает entity_type не из списка account/contact/deal, **When** запрос отправлен, **Then** возвращается 400 Bad Request
6. **Given** пользователь указывает несуществующий entity_id, **When** запрос отправлен, **Then** возвращается 404 Not Found
7. **Given** пользователь с ролью viewer, **When** он пытается создать активность, **Then** возвращается 403 Forbidden

---

### User Story 2 — Просмотр активностей сущности (Priority: P2)

Любой авторизованный пользователь просматривает список активностей, привязанных к конкретному аккаунту, контакту или сделке. Может фильтровать по статусу выполнения, типу и диапазону сроков. Каждая активность содержит вычисляемое поле overdue.

**Why this priority**: Просмотр истории взаимодействий и открытых задач — основная ценность фичи для команды.

**Independent Test**: `GET /api/v1/accounts/:id/activities` → plain array sorted created_at DESC, каждый с overdue; `?completed=false` → только невыполненные; `?type=call` → только звонки; несуществующий entity → 404; нет активностей → [].

**Acceptance Scenarios**:

1. **Given** авторизованный пользователь (любая роль), **When** он запрашивает активности существующего аккаунта, **Then** возвращается массив, sorted by created_at DESC, каждый объект содержит: id, type, entity_type, entity_id, description, due_date, completed, overdue, owner {id, name}, created_at, updated_at
2. **Given** активность имеет due_date в прошлом и completed=false, **When** пользователь запрашивает список, **Then** эта активность имеет overdue=true
3. **Given** активность выполнена (completed=true), **When** пользователь запрашивает список, **Then** overdue=false независимо от due_date
4. **Given** авторизованный пользователь, **When** запрашивает `?completed=false`, **Then** возвращаются только невыполненные активности
5. **Given** авторизованный пользователь, **When** запрашивает `?type=meeting`, **Then** возвращаются только встречи
6. **Given** авторизованный пользователь, **When** запрашивает `?due_date_from=2026-07-01&due_date_to=2026-07-31`, **Then** возвращаются активности с due_date в указанном диапазоне, а также активности без due_date (due_date=null)
7. **Given** у сущности нет активностей, **When** запрашивается список, **Then** возвращается пустой массив []
8. **Given** несуществующая сущность, **When** запрашиваются её активности, **Then** возвращается 404 Not Found
9. **Given** авторизованный пользователь, **When** запрашивает `/api/v1/contacts/:id/activities` или `/api/v1/deals/:id/activities`, **Then** возвращаются активности контакта/сделки соответственно

---

### User Story 3 — Обновление активности (Priority: P3)

Пользователь с ролью admin или bdm обновляет активность: отмечает задачу выполненной, изменяет описание, тип или срок выполнения.

**Why this priority**: Обновление статуса — инструмент управления задачами. Без него активности превращаются в статичный журнал.

**Independent Test**: `PUT /api/v1/activities/:id` с {completed:true} → 200, completed=true, overdue=false; `{type:"email"}` → 200, type обновлён; несуществующая → 404; viewer → 403.

**Acceptance Scenarios**:

1. **Given** пользователь с ролью admin или bdm, **When** он отправляет PUT с {completed: true}, **Then** возвращается 200 с обновлённым объектом: completed=true, overdue=false
2. **Given** активность с completed=true, **When** пользователь отправляет PUT с {completed: false}, **Then** возвращается 200 с completed=false; overdue вычисляется заново по due_date
3. **Given** пользователь обновляет description и/или due_date, **When** запрос выполнен, **Then** поля обновляются, updated_at актуализируется
4. **Given** пользователь обновляет type валидным значением, **When** запрос выполнен, **Then** type обновляется
5. **Given** пользователь обновляет type невалидным значением, **When** запрос отправлен, **Then** возвращается 400 Bad Request
6. **Given** пользователь пытается обновить несуществующую активность, **When** запрос отправлен, **Then** возвращается 404 Not Found
7. **Given** пользователь с ролью viewer, **When** он пытается обновить активность, **Then** возвращается 403 Forbidden

---

### User Story 4 — Удаление активности (Priority: P4)

Пользователь с ролью admin удаляет активность из системы.

**Why this priority**: Вспомогательная операция для поддержания чистоты данных.

**Independent Test**: `DELETE /api/v1/activities/:id` → 204 (admin); bdm → 403; несуществующая → 404.

**Acceptance Scenarios**:

1. **Given** пользователь с ролью admin, **When** он удаляет существующую активность, **Then** возвращается 204, запись удалена из системы
2. **Given** пользователь с ролью bdm, **When** он пытается удалить активность, **Then** возвращается 403 Forbidden
3. **Given** пользователь с ролью viewer, **When** он пытается удалить активность, **Then** возвращается 403 Forbidden
4. **Given** пользователь пытается удалить несуществующую активность, **When** запрос отправлен, **Then** возвращается 404 Not Found

---

### Edge Cases

- Создание без type → 400 Bad Request (обязательное поле)
- type не из списка call/email/meeting/task → 400 Bad Request
- entity_type не из списка account/contact/deal → 400 Bad Request
- Несуществующий entity_id → 404 Not Found
- Активность с due_date в прошлом + completed=false → overdue=true в API-ответе
- Выполненная активность (completed=true) → overdue=false всегда, даже если due_date в прошлом
- Активность без due_date → overdue=false всегда
- Фильтр due_date_from без due_date_to → нижняя граница без верхней (допустимо)
- Фильтрация по due_date при наличии активностей без due_date → активности с due_date=null включаются в результат вместе с теми, что попали в диапазон
- Фильтр `?completed=false` → невыполненные (completed=false); `?completed=true` → выполненные; без параметра → все
- При удалении родительской сущности → активности удаляются каскадно (уже реализовано в F-04/F-05/F-06)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Система ДОЛЖНА позволять пользователям с ролью admin и bdm создавать активности через POST /api/v1/activities с обязательными полями type (call/email/meeting/task) и entity_type+entity_id; опциональные: description, due_date; completed устанавливается в false при создании; owner = текущий пользователь
- **FR-002**: Система ДОЛЖНА валидировать type: допустимые значения call/email/meeting/task; отсутствует или невалидное → 400 Bad Request
- **FR-003**: Система ДОЛЖНА валидировать entity_type: допустимые значения account/contact/deal; невалидное → 400 Bad Request
- **FR-004**: Система ДОЛЖНА проверять существование сущности (entity_type + entity_id) при создании; если не найдена → 404 Not Found
- **FR-005**: Система ДОЛЖНА возвращать список активностей сущности через GET /api/v1/accounts/:id/activities, GET /api/v1/contacts/:id/activities, GET /api/v1/deals/:id/activities — массив отсортированный по created_at DESC; поддерживать query-фильтры: completed (true/false), type, due_date_from, due_date_to; при применении due_date_from/to активности без due_date (due_date=null) всегда включаются в результат
- **FR-006**: Система ДОЛЖНА возвращать поле overdue (boolean) в каждом объекте активности: true если due_date установлен, due_date < текущее время И completed=false; иначе false
- **FR-007**: Система ДОЛЖНА возвращать 404 при запросе активностей несуществующей сущности; пустой массив [] если сущность существует, но активностей нет
- **FR-008**: Система ДОЛЖНА позволять пользователям с ролью admin и bdm обновлять активность через PUT /api/v1/activities/:id — обновляемые поля: completed (двусторонний toggle: true ↔ false), type, description, due_date; viewer → 403
- **FR-009**: Система ДОЛЖНА позволять только пользователю с ролью admin удалять активность через DELETE /api/v1/activities/:id; bdm и viewer → 403

### Key Entities

- **Активность (Activity)**: Запись о взаимодействии или задаче, привязанная к одной сущности CRM. Поля: id, type (call/email/meeting/task), entity_type (account/contact/deal), entity_id, description (опционально), due_date (опционально), completed (false по умолчанию), owner {id, name}, created_at, updated_at. Вычисляемое поле: overdue.
- **Тип (type)**: Категория активности — call (звонок), email (письмо), meeting (встреча), task (задача).
- **overdue**: Вычисляемый признак — активность просрочена если due_date установлен, срок истёк и задача не выполнена. Не хранится в базе данных, вычисляется при каждом запросе.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% запросов на создание с невалидным type или отсутствующим type возвращают 400
- **SC-002**: 100% активностей с due_date в прошлом и completed=false имеют overdue=true в ответе; 100% выполненных активностей имеют overdue=false
- **SC-003**: 100% попыток удаления от bdm и viewer возвращают 403
- **SC-004**: Фильтры completed, type, due_date_from/to работают корректно — возвращают только соответствующие записи (0 ложных срабатываний)
- **SC-005**: При удалении аккаунта, контакта или сделки — 0 orphaned активностей остаётся в системе

## Assumptions

- Список активностей не пагинируется; ответ — простой массив, sorted by created_at DESC
- description и due_date — опциональные поля; активность можно создать только с type и entity
- owner устанавливается автоматически = текущий пользователь при создании; не меняется при обновлении через PUT
- Нет глобального эндпоинта GET /api/v1/activities — только entity-specific (accounts, contacts, deals)
- Каскадное удаление активностей уже реализовано в F-04/F-05/F-06 — F-09 не добавляет новых cascade-операций
- overdue вычисляется на сервере в момент запроса, не хранится в БД
- bdm может обновлять любую активность (не только свою) — нет record-level access restriction
- Фильтр `?completed=false` возвращает невыполненные (completed=false); `?completed=true` — выполненные; без параметра — все
- Пагинация отсутствует (MVP, 4 пользователя — объём управляемый)
