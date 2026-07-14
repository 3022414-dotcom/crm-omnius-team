# Feature Specification: Entity Field Fixes — Deal, Contact, Account

**Feature Branch**: `015-entity-fields-fix`

**Created**: 2026-07-13

**Status**: Draft

**Input**: F-15 — Привести поля карточек сущностей (Deal, Contact, Account) в соответствие с ТЗ: исправить набор значений Our Services в Deal, добавить поля Deal Owner / Created By / Created Date, форматировать Amount с разделителем тысяч, выровнять порядок полей Deal по ТЗ, добавить поле Created By в карточки Account и Contact.

**Dependencies**: F-06 (Deals), F-04 (Accounts), F-05 (Contacts), F-12 (Data Model Patch)

---

## Clarifications

### Session 2026-07-13

- Q: Эндпоинт `GET /api/v1/users` для выпадающего списка Deal Owner — какой уровень доступа? → A: Открыть всем аутентифицированным пользователям (убрать ограничение `requireRole(['admin'])`).


---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Корректные поля и порядок в карточке сделки (Priority: P1)

Пользователь открывает карточку сделки и видит поля в правильном порядке с корректными значениями: Our Services предлагает нужные опции, Amount отформатирован с пробелами, Deal Owner и Created By показывают имена из списка пользователей, Created Date заполнена автоматически.

**Why this priority**: Карточка сделки — главная рабочая сущность в CRM. Некорректные опции Our Services делают поле бесполезным; отсутствие Deal Owner / Created By нарушает трассируемость.

**Independent Test**: Открыть любую карточку сделки → убедиться, что поля идут в указанном порядке, Our Services содержит именно `Workshop, Webinar, Consulting, POC, Development, Accelerator, Performance`, Amount показывает число с пробелами-разделителями тысяч, Deal Owner и Created By содержат имя пользователя из системы.

**Acceptance Scenarios**:

1. **Given** открыта карточка существующей сделки, **When** пользователь смотрит на левую панель полей, **Then** поля идут строго в порядке: Deal Name → Stage → Account → Location → Deal Type → Source → Project Domain → Description → Our Services → Amount → Currency → Deal Storage → Deal Owner → Created By → Created Date → Expected Start Date → Close Date → Lost Reason (только при stage = lost).

2. **Given** пользователь кликает на поле Our Services, **When** открывается редактор мультивыбора, **Then** доступны ровно 7 значений: Workshop, Webinar, Consulting, POC, Development, Accelerator, Performance — и никакие другие.

3. **Given** у сделки значение Amount = 5000000, **When** пользователь видит поле в режиме просмотра, **Then** отображается `5 000 000` (пробел как разделитель тысяч).

4. **Given** открыта карточка сделки, **When** пользователь смотрит на поле Deal Owner, **Then** отображается имя ответственного пользователя; при редактировании показывается выпадающий список всех пользователей системы.

5. **Given** открыта карточка сделки, **When** пользователь смотрит на поле Created By, **Then** отображается имя пользователя, создавшего сделку (read-only).

6. **Given** открыта карточка сделки, **When** пользователь смотрит на поле Created Date, **Then** отображается дата создания сделки в формате даты (read-only, заполняется автоматически).

---

### User Story 2 — Поле Created By в карточках Account и Contact (Priority: P2)

Пользователь открывает карточку аккаунта или контакта и видит поле Created By с именем пользователя, который создал эту запись.

**Why this priority**: Трассируемость создания записей важна для командной работы, но менее критична, чем корректность полей в Deal.

**Independent Test**: Открыть карточку Account → убедиться, что поле Created By присутствует и показывает имя пользователя. Повторить для Contact.

**Acceptance Scenarios**:

1. **Given** открыта карточка аккаунта, **When** пользователь смотрит на список полей, **Then** присутствует поле Created By с именем пользователя, создавшего аккаунт (read-only).

2. **Given** открыта карточка контакта, **When** пользователь смотрит на список полей, **Then** присутствует поле Created By с именем пользователя, создавшего контакт (read-only).

3. **Given** новая запись (account или contact) только что создана, **When** сразу открывается карточка, **Then** Created By содержит имя вошедшего пользователя, создавшего запись.

---

### Edge Cases

- Если `created_by_id` для старой записи (до миграции) равен NULL → поле Created By отображает прочерк «—».
- Если пользователь-создатель был удалён из системы → поле Created By отображает прочерк «—» (не падает).
- Deal Owner при редактировании: список содержит всех пользователей системы (admin, bdm, viewer).
- Amount = 0 → отображается как `0` без разделителей.
- Amount = NULL → поле пустое.
- Our Services = пустой массив → поле пустое (не ошибка).

---

## Requirements *(mandatory)*

### Functional Requirements

**Deal-specific:**

- **FR-001**: В карточке Deal поле Our Services ДОЛЖНО быть мультивыбором со значениями: Workshop, Webinar, Consulting, POC, Development, Accelerator, Performance. Текущие значения (AI Consulting, AI Outsource и т.д.) ДОЛЖНЫ быть заменены.

- **FR-002**: В карточке Deal ДОЛЖНО присутствовать поле Deal Owner — выпадающий список пользователей системы (все роли: admin, bdm, viewer), редактируемый пользователями с правом записи. Список загружается через `GET /api/v1/users`, доступный всем аутентифицированным пользователям.

- **FR-003**: В карточках Deal, Account и Contact ДОЛЖНО присутствовать поле Created By — имя пользователя, создавшего запись (read-only). Значение устанавливается автоматически в момент создания записи.

- **FR-004**: В карточке Deal ДОЛЖНО присутствовать поле Created Date — дата создания сделки (read-only), заполняется автоматически.

- **FR-005**: В карточке Deal поле Amount ДОЛЖНО отображаться с пробелом в качестве разделителя тысяч (например, `5 000 000`). В режиме редактирования допустим ввод без разделителей.

- **FR-006**: Поля в левой панели карточки Deal ДОЛЖНЫ отображаться строго в следующем порядке (сверху вниз): Deal Name, Stage, Account, Location, Deal Type, Source, Project Domain, Description, Our Services, Amount, Currency, Deal Storage, Deal Owner, Created By, Created Date, Expected Start Date, Close Date, Lost Reason.

**Account and Contact:**

- **FR-007**: В карточке Account ДОЛЖНО присутствовать поле Created By (read-only) — имя пользователя, создавшего аккаунт.

- **FR-008**: В карточке Contact ДОЛЖНО присутствовать поле Created By (read-only) — имя пользователя, создавшего контакт.

### Key Entities

- **Deal**: расширяется полями `created_by_id` (FK → users, read-only, устанавливается при создании) и возможностью редактировать `owner_id` через UI.
- **Account**: расширяется полем `created_by_id` (FK → users, read-only, устанавливается при создании).
- **Contact**: расширяется полем `created_by_id` (FK → users, read-only, устанавливается при создании).
- **User**: существующая сущность; список пользователей нужен для полей Deal Owner и Created By.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Открытие карточки Deal показывает все 17 полей в указанном порядке — проверяется визуально для 100% тест-сценариев.
- **SC-002**: Поле Our Services содержит ровно 7 опций (Workshop, Webinar, Consulting, POC, Development, Accelerator, Performance) — несоответствие недопустимо.
- **SC-003**: Amount = 1234567 отображается как `1 234 567` — проверяется вручную.
- **SC-004**: Поле Created By присутствует и показывает корректное имя во всех трёх сущностях (Deal, Account, Contact) — проверяется для свежесозданных и существующих записей.
- **SC-005**: Deal Owner в режиме редактирования показывает список всех пользователей системы.

---

## Assumptions

- Поле `created_by_id` не существует в текущей схеме БД — требуется миграция для добавления колонки в таблицы deals, accounts, contacts и установки значения по умолчанию (NULL для существующих записей).
- Список пользователей для Deal Owner доступен через `GET /api/v1/users`, доступный всем аутентифицированным пользователям (ограничение только для admin снимается).
- Разделитель тысяч в Amount — пробел (не точка, не запятая), в соответствии с российским форматом чисел.
- Close Date отображается после поля Expected Start Date (позиция 17 из 18).
- Lost Reason отображается только при `stage = 'lost'` (поведение сохраняется).
- Existing records с NULL в `created_by_id` отображают прочерк «—» без ошибки.
- Изменения только на фронтенде (форматирование Amount, порядок полей, значения Our Services) и минимальная миграция для добавления `created_by_id`.
- Backend API для Deal, Account, Contact расширяется полем `created_by` (объект пользователя) в ответах GET.
