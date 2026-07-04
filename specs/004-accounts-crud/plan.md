# Implementation Plan: Аккаунты (Accounts)

**Branch**: `004-accounts-crud` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-accounts-crud/spec.md`

## Summary

Реализация CRUD-операций для аккаунтов (компаний/организаций). 5 эндпоинтов: создание (admin/bdm), список с поиском и пагинацией (все роли), просмотр одного аккаунта (все роли), частичное обновление (admin/bdm), удаление (admin только) с application-level cascade. Каждый объект аккаунта в GET-ответах включает `contactsCount` и `dealsCount` через SQL-субзапросы. Частичное обновление реализуется через динамический SET-clause.

## Technical Context

**Language/Version**: Node.js LTS 18+

**Primary Dependencies**: Express, pg — оба уже установлены в F-01/F-02/F-03; новых зависимостей не требуется

**Storage**: PostgreSQL 15 — таблица `accounts` создана в F-01 со всеми полями (id, name, industry, website, phone, address, notes, owner_id, created_at, updated_at); индексы idx_accounts_name и idx_accounts_owner_id уже существуют

**Testing**: Ручное тестирование через curl/httpie; автоматизированные тесты не в scope MVP

**Target Platform**: Linux server (Docker, образ node:lts-alpine)

**Project Type**: web-service (backend API only)

**Performance Goals**: Нет специфических целей — внутренний инструмент для 4 человек

**Constraints**: Частичное обновление через динамический SET-clause (только переданные поля); контроллер не делает лишних запросов при валидации; `express-async-errors` уже установлен — async/await без try/catch

**Scale/Scope**: 4 пользователя; ожидаемый объём — десятки-сотни аккаунтов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота прежде всего | ✅ PASS | controller + router + модификация app.js; никаких лишних абстракций |
| YAGNI | ✅ PASS | Только 5 эндпоинтов по spec; поиск только по name; смена owner — не в scope |
| Spec-First | ✅ PASS | Spec + clarification завершены до планирования |
| REST API `/api/v1/` prefix | ✅ PASS | Все эндпоинты: /api/v1/accounts/* |
| HTTP status codes | ✅ PASS | 200/201/204/400/403/404 покрыты по spec |
| UUID PK | ✅ PASS | Существующая таблица accounts — UUID PK от F-01 |
| Нет over-engineering | ✅ PASS | Нет Repository pattern, нет ORM, нет сервисного слоя |
| TIMESTAMPTZ | ✅ PASS | created_at/updated_at в таблице accounts — TIMESTAMPTZ |
| owner_id FK | ✅ PASS | Существующий FK accounts.owner_id → users ON DELETE RESTRICT |

**Re-check post-design**: ✅ PASS — дизайн соответствует всем принципам конституции.

## Project Structure

### Documentation (this feature)

```text
specs/004-accounts-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── accounts-api.md  # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── middleware/
│   └── auth.js              # EXISTING F-03 — requireRole уже реализован, без изменений
├── routes/
│   ├── auth.js              # EXISTING F-02 — без изменений
│   ├── users.js             # EXISTING F-03 — без изменений
│   └── accounts.js          # NEW: /api/v1/accounts routes
├── controllers/
│   ├── usersController.js   # EXISTING F-03 — без изменений
│   └── accountsController.js # NEW: createAccount, listAccounts, getAccountById,
│                            #       updateAccount, deleteAccount
└── app.js                   # MODIFY: mount /api/v1/accounts router
```

**Structure Decision**: F-04 добавляет в существующую структуру server/ из F-01/F-02/F-03. Директория `controllers/` уже создана в F-03. Паттерн (router + controller) аналогичен F-03 users — для согласованности.
