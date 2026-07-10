# Implementation Plan: F-12 Data Model Patch

**Branch**: `012-data-model-patch` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Привести схему БД и UI в соответствие с ТЗ v2.0 — новые ENUM-типы, новые колонки для Account/Contact/Deal, миграция стейджей сделок (6→8), расширение deal_contacts; обновить формы и детальные страницы.

## Summary

Одна аддитивная миграция добавляет 9 новых ENUM-типов и расширяет 4 таблицы. Самый рискованный шаг — миграция `deal_stage` (6→8 значений): реализуется через временный VARCHAR-столбец. Все остальные изменения схемы — чистый `ADD COLUMN`. Фронтенд: обновить 3 модала + 3 детальных страницы + Kanban (8 колонок + поля карточки).

## Technical Context

**Language/Version**: Node.js 20 LTS (backend) · React 18 + Vite 5 (frontend)

**Primary Dependencies**: Express · pg · node-pg-migrate · react-hook-form · zod · @tanstack/react-query v5 · @dnd-kit — без новых зависимостей

**Storage**: PostgreSQL 15+ (Docker, контейнер `omnius_crm_db`)

**Testing**: Ручное тестирование через Docker PostgreSQL + проверка UI в браузере

**Target Platform**: VPS / Docker (локальный dev + прод)

**Project Type**: Web application (React SPA + Express REST API)

**Performance Goals**: 4 пользователя, десятки-сотни записей на сущность — без специальных требований

**Constraints**:
- Все миграции **только аддитивные** — никаких DROP COLUMN на существующих колонках
- `npm run db:migrate` — единственный шаг миграции, без ручных SQL-скриптов
- Ноль потерь данных: существующие аккаунты/контакты/сделки доступны после миграции
- Обратная совместимость API: новые поля nullable, существующие клиенты не ломаются

**Scale/Scope**: 4 пользователя

## Constitution Check

| Gate | Status | Примечание |
|------|--------|------------|
| Spec-First | ✅ PASS | spec.md завершён (40 FR, clarifications resolved) |
| Simplicity | ✅ PASS | Аддитивные миграции, без новых фреймворков |
| YAGNI | ✅ PASS | Только поля из ТЗ v2.0, ничего сверх |
| Stack compliance | ✅ PASS | node-pg-migrate, pg, Express, React+Vite — без новых зависимостей |
| PostgreSQL conventions | ✅ PASS | UUID PK, TIMESTAMPTZ, FK rules, triggers — без изменений |
| Sequential order | ✅ PASS | F-12 следует после F-11 (завершена) |

Нарушений конституции не обнаружено.

## Project Structure

### Documentation (this feature)

```text
specs/012-data-model-patch/
├── plan.md              ← этот файл
├── research.md          ← технические решения F-12
├── data-model.md        ← новые колонки и ENUM-типы
├── contracts/
│   ├── accounts.md      ← обновлённый API-контракт accounts
│   ├── contacts.md      ← обновлённый API-контракт contacts
│   └── deals.md         ← обновлённый API-контракт deals
├── quickstart.md        ← сценарии тестирования миграции
└── tasks.md             ← /speckit-tasks output
```

### Source Code (изменяемые файлы)

```text
server/
  migrations/
    1748044800000_initial_schema.js            (существующий — не трогать)
    1783641600000_f12_data_model_patch.js      (НОВЫЙ — вся миграция F-12)
  controllers/
    accountsController.js   (ОБНОВИТЬ — новые поля в SELECT/INSERT/UPDATE)
    contactsController.js   (ОБНОВИТЬ — новые поля в SELECT/INSERT/UPDATE)
    dealsController.js      (ОБНОВИТЬ — новые поля + lost_reason валидация)

client/src/
  components/modals/
    AccountModal.jsx         (ОБНОВИТЬ — 7 новых/изменённых полей)
    ContactModal.jsx         (ОБНОВИТЬ — 11 новых полей)
    DealModal.jsx            (ОБНОВИТЬ — 10 новых полей + lost_reason условный)
  pages/
    accounts/AccountDetail.jsx   (ОБНОВИТЬ — отображение новых полей)
    contacts/ContactDetail.jsx   (ОБНОВИТЬ — отображение новых полей)
    deals/DealsPage.jsx          (ОБНОВИТЬ — DealDetail: новые поля + deal_contacts role/comment)
    kanban/KanbanPage.jsx        (ОБНОВИТЬ — 8 колонок, карточка: owner + expected_start_date)
```

## Implementation Phases

### Phase 1 — DB Migration (блокирует всё остальное)

Один файл миграции: `server/migrations/1783641600000_f12_data_model_patch.js`

Порядок операций внутри миграции:

1. **Создать новые ENUM-типы** (9 штук)
2. **Мигрировать deal_stage** через временный VARCHAR-столбец (самый рискованный шаг)
3. **Изменить industry у accounts** с VARCHAR на industry_enum (SET NULL)
4. **ADD COLUMN для accounts** (type, location, size, is_target, account_storage, account_manager_id)
5. **ADD COLUMN для contacts** (telegram, linkedin, facebook, email_corp + migrate from email, email_personal, location, language, preferred_communication, birthday, comments, source)
6. **ADD COLUMN для deals** (location, deal_type, source, project_domain, description, our_services, deal_storage, expected_start_date, currency, lost_reason)
7. **ADD COLUMN для deal_contacts** (role, comment)

### Phase 2 — Backend Controllers

Обновить ACCOUNT_FIELDS, CONTACT_FIELDS (или аналогичные константы) и запросы SELECT/INSERT/UPDATE в каждом контроллере. Добавить валидацию lost_reason в dealsController.

### Phase 3 — Frontend Modals

Обновить 3 модальных окна: добавить поля формы, zod-схемы, react-hook-form register. Порядок: AccountModal → ContactModal → DealModal (DealModal самый сложный из-за our_services multiselect и lost_reason условной обязательности).

### Phase 4 — Frontend Detail Pages

Обновить 3 детальных страницы: отображать все новые поля. Обновить deal_contacts UI для role+comment. Порядок: AccountDetail → ContactDetail → DealsPage (DealDetail).

### Phase 5 — Kanban

Обновить KanbanPage: STAGES массив (8 вместо 6), DealCard (добавить owner + expected_start_date).
