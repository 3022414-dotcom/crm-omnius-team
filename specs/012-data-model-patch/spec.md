# Feature Specification: F-12 Data Model Patch

**Feature Branch**: `012-data-model-patch`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Привести схему БД и UI в соответствие с ТЗ v2.0 — добавить поля для Account, Contact, Deal через аддитивные миграции; обновить стейджи сделок; обновить формы и детальные страницы.

## Context

В ходе реализации F-01 (схема БД) конституция упростила схему относительно оригинального ТЗ v2.0. F-11 (фронтенд) построен на этой упрощённой схеме. Теперь нужно привести систему в соответствие с ТЗ, не ломая уже работающий функционал.

**Принцип**: все миграции только аддитивные — новые колонки, новые ENUM-типы. Никаких DROP COLUMN, никаких изменений NOT NULL на существующих данных без дефолтов.

## Clarifications

### Session 2026-07-10

- Q: Входит ли добавление полей `role` и `comment` в таблицу `deal_contacts` в скоуп F-12? → A: Да, входит в F-12 (ТЗ 5.3: "Contacts — related table — с полями Role и Comment").
- Q: Что сделать с существующими free-text значениями `industry` у аккаунтов при миграции в ENUM? → A: Обнулить всё (SET NULL) — простая миграция без маппинга.
- Q: Нужно ли обновить Kanban-карточку в F-12 для отображения Deal Owner и Expected Start Date? → A: Да, обновить карточку в F-12 — показывать Deal Name, Account, Amount, Deal Owner, Expected Start Date (полный состав по ТЗ).

## User Scenarios & Testing

### User Story 1 — Enriched Account Card (Priority: P1)

Менеджер (admin/bdm) создаёт или редактирует аккаунт и может указать: тип компании, местоположение, размер команды, является ли компания целевой, ссылку на папку с материалами (account storage), и ответственного менеджера. В карточке аккаунта все эти поля видны.

**Why this priority**: Тип и размер компании — ключевые квалификационные поля для сейлз-процесса. Их отсутствие делает аккаунт неполным.

**Independent Test**: Создать аккаунт с типом "Prospect", размером "51-200", is_target = true, account_manager = один из пользователей → открыть карточку → все поля отображены.

**Acceptance Scenarios**:

1. **Given** открыта форма создания/редактирования аккаунта, **When** пользователь выбирает Type = "Client", Location = "Russia", Size = "51-200", ставит галочку Target, вводит Account Storage URL и выбирает Account Manager, **Then** данные сохраняются и отображаются в карточке аккаунта.
2. **Given** аккаунт существует в БД, **When** менеджер открывает карточку аккаунта, **Then** все новые поля (type, location, size, is_target, account_storage, account_manager) видны.
3. **Given** аккаунт создан до F-12, **When** его открывают после миграции, **Then** аккаунт открывается корректно — новые поля пустые, старые данные не потеряны.

---

### User Story 2 — Enriched Contact Card (Priority: P2)

Менеджер может дополнить контакт ссылками в соцсетях (Telegram, LinkedIn, Facebook), двумя email-адресами (рабочий и личный), предпочтительным каналом связи, местоположением, языком, датой рождения, источником лида и комментарием.

**Why this priority**: Контактные данные в соцсетях и предпочтительный канал связи — основа работы BDM с базой контактов.

**Independent Test**: Создать контакт с Telegram "@handle", email_corp, email_personal, preferred_communication = "Telegram", source = "Referral" → открыть карточку → все поля отображены.

**Acceptance Scenarios**:

1. **Given** форма создания/редактирования контакта, **When** пользователь вводит telegram, linkedin, facebook, email_corp, email_personal, выбирает preferred_communication, location, language, source, вводит birthday и comments, **Then** данные сохраняются.
2. **Given** контакт существует до F-12, **When** его открывают после миграции, **Then** контакт открывается, старые поля (first_name, last_name, phone, email) сохранены, новые поля пустые.
3. **Given** поле email заполнено у существующего контакта, **When** миграция выполняется, **Then** значение переносится в email_corp, поле email остаётся как алиас для обратной совместимости API.

---

### User Story 3 — Enriched Deal Card + Stage Alignment (Priority: P3)

Менеджер работает со сделками по стейджам из ТЗ (8 стейджей вместо 6), может указать: местоположение, тип сделки, источник, домен проекта, описание, услуги, ссылку на папку с материалами, ожидаемую дату начала, валюту и (при проигрыше) причину проигрыша.

**Why this priority**: Правильные стейджи и поля — необходимы для корректного сейлз-процесса и Kanban-доски.

**Independent Test**: Создать сделку со стейджем "Discovery", deal_type = "New Client", currency = "RUB", our_services = ["Consulting", "Workshop"] → сделка появляется в колонке Discovery на Kanban.

**Acceptance Scenarios**:

1. **Given** форма создания сделки, **When** пользователь видит список стейджей, **Then** доступны все 8: Lead → Qualifying → Discovery → Proposal → Closing → Contract → Won → Lost.
2. **Given** существующая сделка со стейджем "negotiation" (старый), **When** миграция выполняется, **Then** её стейдж автоматически меняется на "closing" (новый эквивалент).
3. **Given** сделка переведена в стейдж "Lost", **When** сохраняется, **Then** поле lost_reason обязательно для заполнения.
4. **Given** форма сделки, **When** пользователь выбирает our_services из списка, **Then** можно выбрать несколько услуг.
5. **Given** сделки с разными стейджами существуют в БД, **When** открывается Kanban, **Then** все 8 колонок отображаются, сделки распределены по правильным колонкам.
6. **Given** сделка имеет заполненные поля expected_start_date и owner, **When** карточка отображается на Kanban, **Then** видны: название, аккаунт, сумма, ответственный (Deal Owner) и ожидаемая дата начала.

---

### Edge Cases

- Существующие сделки со стейджем `negotiation` → мигрируют в `closing`; со стейджем `qualified` → в `qualifying`.
- Существующие аккаунты с заполненным полем `industry` — после миграции значение будет NULL. Admin вручную переставляет отрасли после апдейта.
- Контакт без email (поле было NULL) → email_corp тоже NULL после миграции.
- Аккаунт с account_manager_id = NULL открывается без ошибки.
- Потеря сессии во время заполнения длинной формы — данные сохраняются после повторного логина.
- Валидация: lost_reason обязательна только при stage = "lost".
- our_services — пустой массив допустим (сделка без указания услуг).

## Requirements

### Functional Requirements

**Account:**
- **FR-001**: System MUST add `type` field to accounts (ENUM: Prospect / Client / Partner / Vendor), nullable.
- **FR-002**: System MUST add `location` field to accounts (ENUM: Russia / Belorussia / Kazakhstan / Armenia), nullable.
- **FR-003**: System MUST convert `industry` field on accounts from free-text VARCHAR to ENUM (FinTech / MedTech / Agro / Oil and Gas / Commerce / HoReCa / Customer services / Production), nullable. Migration sets all existing values to NULL (no mapping).
- **FR-004**: System MUST add `size` field to accounts (ENUM: 1-50 / 51-200 / 201-1000 / 1000+), nullable.
- **FR-005**: System MUST add `is_target` boolean field to accounts (default FALSE).
- **FR-006**: System MUST add `account_storage` field to accounts (VARCHAR, URL), nullable.
- **FR-007**: System MUST add `account_manager_id` FK → users to accounts, nullable (отдельный от owner_id).
- **FR-008**: Account form MUST expose all new fields for edit (admin/bdm).
- **FR-009**: Account detail page MUST display all new fields.

**Contact:**
- **FR-010**: System MUST add `telegram`, `linkedin`, `facebook` (VARCHAR) to contacts, nullable.
- **FR-011**: System MUST add `email_corp` (VARCHAR) to contacts. Существующее поле `email` остаётся в схеме и API для обратной совместимости; данные из `email` копируются в `email_corp` при миграции.
- **FR-012**: System MUST add `email_personal` (VARCHAR) to contacts, nullable.
- **FR-013**: System MUST add `location` (ENUM: Russia / Belorussia / Kazakhstan / Armenia) to contacts, nullable.
- **FR-014**: System MUST add `language` (ENUM: Russian / English) to contacts, nullable.
- **FR-015**: System MUST add `preferred_communication` (ENUM: Telegram / WhatsApp / Email / LinkedIn) to contacts, nullable.
- **FR-016**: System MUST add `birthday` (DATE) to contacts, nullable.
- **FR-017**: System MUST add `comments` (TEXT) to contacts, nullable.
- **FR-018**: System MUST add `source` to contacts (ENUM: Founder / Marketing / Organic / BizDev / Customer / Referral / Agent / Event / Employee), nullable.
- **FR-019**: Contact form MUST expose all new fields.
- **FR-020**: Contact detail page MUST display all non-empty new fields.

**Deal:**
- **FR-021**: Deal stage ENUM must be updated to 8 values: lead / qualifying / discovery / proposal / closing / contract / won / lost.
- **FR-022**: Existing deals MUST be migrated: `qualified` → `qualifying`, `negotiation` → `closing`; остальные стейджи (lead, proposal, won, lost) сохраняются без изменений.
- **FR-023**: System MUST add `location` (ENUM: Russia / Belorussia / Kazakhstan / Armenia) to deals, nullable.
- **FR-024**: System MUST add `deal_type` (ENUM: New Client / New Project with existing client / Upsale) to deals, nullable.
- **FR-025**: System MUST add `source` to deals (ENUM: Founder / Marketing / Organic / BizDev / Customer / Referral / Agent / Event / Tender Platforms / Employee), nullable. Отличается от Contact source наличием значения "Tender Platforms".
- **FR-026**: System MUST add `project_domain` to deals (ENUM: FinTech / MedTech / Agro / Oil and Gas / Commerce / HoReCa / Customer services / Production), nullable. Тот же набор значений, что и industry у Account.
- **FR-027**: System MUST add `description` (TEXT) to deals, nullable.
- **FR-028**: System MUST add `our_services` (TEXT[]) to deals, nullable (multiselect; допустимые значения: Workshop / Webinar / Consulting / POC / Development / Accelerator / Performance).
- **FR-029**: System MUST add `deal_storage` (VARCHAR, URL) to deals, nullable.
- **FR-030**: System MUST add `expected_start_date` (DATE) to deals, nullable.
- **FR-031**: System MUST add `currency` (ENUM: RUB / EUR / USD, default RUB) to deals.
- **FR-032**: System MUST add `lost_reason` (TEXT) to deals, nullable; required when stage = lost.
- **FR-033**: Deal form MUST expose all new fields.
- **FR-034**: Deal detail page MUST display all non-empty new fields.
- **FR-035**: Kanban MUST display 8 columns matching new stage values.
- **FR-036**: Backend MUST validate `lost_reason` presence when stage = "lost".
- **FR-040**: Kanban card MUST display: Deal Name, Account, Amount, Deal Owner, Expected Start Date — полный состав по ТЗ раздел 9.

**deal_contacts:**
- **FR-037**: System MUST add `role` (VARCHAR, nullable) to `deal_contacts` table — описывает роль контакта в данной сделке (например, "Decision Maker", "Champion", "Blocker").
- **FR-038**: System MUST add `comment` (TEXT, nullable) to `deal_contacts` table — произвольная заметка о роли контакта в сделке.
- **FR-039**: Deal detail page MUST allow setting/editing role and comment when linking a contact to a deal.

### Key Entities

- **Account**: компания-клиент/партнёр. Новые атрибуты: type, location, industry (→ ENUM), size, is_target, account_storage, account_manager_id.
- **Contact**: контактное лицо. Новые атрибуты: telegram, linkedin, facebook, email_corp, email_personal, location, language, preferred_communication, birthday, comments, source.
- **Deal**: сделка. Обновлённые стейджи (8 вместо 6). Новые атрибуты: location, deal_type, source, project_domain, description, our_services, deal_storage, expected_start_date, currency, lost_reason.
- **ENUM types** (новые):
  - `location_enum`: Russia / Belorussia / Kazakhstan / Armenia — переиспользуется в accounts, contacts, deals
  - `industry_enum`: FinTech / MedTech / Agro / Oil and Gas / Commerce / HoReCa / Customer services / Production — переиспользуется в accounts (industry) и deals (project_domain)
  - `contact_source_enum`: Founder / Marketing / Organic / BizDev / Customer / Referral / Agent / Event / Employee (9 значений)
  - `deal_source_enum`: Founder / Marketing / Organic / BizDev / Customer / Referral / Agent / Event / Tender Platforms / Employee (10 значений — отличается наличием "Tender Platforms")
  - `preferred_communication_enum`: Telegram / WhatsApp / Email / LinkedIn
  - `language_enum`: Russian / English
  - `deal_type_enum`: New Client / New Project with existing client / Upsale
  - `currency_enum`: RUB / EUR / USD
  - `our_services_enum`: Workshop / Webinar / Consulting / POC / Development / Accelerator / Performance (используется как допустимые значения TEXT[])
- **deal_contacts** (junction table расширяется): добавляются поля `role` (VARCHAR, nullable) и `comment` (TEXT, nullable) — роль и комментарий контакта в конкретной сделке.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Все существующие аккаунты, контакты и сделки доступны после миграции без потери данных.
- **SC-002**: Форма аккаунта содержит 7 новых/изменённых полей (type, location, industry→ENUM, size, is_target, account_storage, account_manager); форма контакта — 11 новых полей; форма сделки — 10 новых полей; deal_contacts — 2 новых поля (role, comment).
- **SC-003**: Kanban отображает ровно 8 колонок; сделки, существовавшие до миграции, видны в правильных колонках.
- **SC-004**: Создание сделки со стейджем "Discovery" или "Contract" проходит без ошибок валидации.
- **SC-005**: Попытка сохранить сделку со стейджем "Lost" без lost_reason возвращает ошибку валидации.
- **SC-006**: Миграция выполняется без downtime — применяется через `npm run db:migrate` без ручных шагов.

## Assumptions

- Смена stage ENUM у deals выполняется через временный VARCHAR-столбец: создаётся новый тип → колонка пересоздаётся через `USING` → старый тип удаляется.
- `industry` у accounts: существующая колонка VARCHAR мигрирует в ENUM. **Все текущие значения обнуляются (SET NULL)** — миграция без маппинга. После миграции Admin вручную заполняет industry у нужных аккаунтов через UI.
- `email` у контакта остаётся в схеме (колонка не удаляется) для обратной совместимости существующего API; данные копируются в `email_corp`; `email_corp` — приоритетное поле.
- Contact source и Deal source — **разные ENUM-типы** (`contact_source_enum` vs `deal_source_enum`), так как у Deal есть дополнительное значение "Tender Platforms".
- `our_services` хранится как `TEXT[]` — нативный PostgreSQL массив; допустимые значения (Workshop/Webinar/...) валидируются только на уровне UI, не на уровне БД.
- Изменения UI (формы, детальные страницы) затрагивают только клиентскую часть (React компоненты); backend обратно совместим — новые поля nullable, API принимает их опционально.
- `location_enum` и `industry_enum` создаются один раз и переиспользуются в нескольких таблицах.
