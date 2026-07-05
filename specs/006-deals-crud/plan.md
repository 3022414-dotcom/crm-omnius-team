# Implementation Plan: Сделки (Deals)

**Branch**: `006-deals-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-deals-crud/spec.md`

## Summary

CRUD для сделок (deals) с воронкой продаж (6 этапов), фильтрами, M:N-связью с контактами. Реализуется по паттерну F-04/F-05: controller + routes файлы, подключение в app.js. Таблицы `deals` и `deal_contacts` уже существуют (F-01 миграция). Новые файлы: `server/controllers/dealsController.js`, `server/routes/deals.js`. Модификация: `server/app.js`.

## Technical Context

**Language/Version**: Node.js LTS (текущий в проекте)

**Primary Dependencies**: Express, pg (pool), express-async-errors (уже установлены)

**Storage**: PostgreSQL 15+ (Docker). Таблицы `deals` и `deal_contacts` созданы F-01. Новых миграций не требуется.

**Testing**: Ручное тестирование по quickstart.md (MVP-подход, без автотестов)

**Target Platform**: Docker (Linux server)

**Project Type**: REST API (web-service)

**Performance Goals**: Нет специфических требований (команда 4 человека)

**Constraints**: YAGNI — только то, что нужно для F-06. Нет новых зависимостей.

**Scale/Scope**: 4 пользователя, ~100 сделок в MVP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота | ✅ PASS | Controller + routes, без лишних абстракций |
| Spec-First | ✅ PASS | Spec написан через speckit, plan следует за clarify |
| Последовательность фич | ✅ PASS | F-05 завершён, F-06 следующая |
| YAGNI | ✅ PASS | Только поля из spec, без over-engineering |
| Stack compliance | ✅ PASS | Node.js + Express + pg, no new deps |
| UUID PK | ✅ PASS | Все таблицы используют UUID (F-01) |
| TIMESTAMPTZ | ✅ PASS | created_at/updated_at через существующий триггер |
| REST /api/v1/ | ✅ PASS | /api/v1/deals |
| Roles/RBAC | ✅ PASS | requireRole(['admin','bdm']) / requireRole(['admin']) |

**Constitution Check: PASS** — можно приступать к Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/006-deals-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── deals-api.md     # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── app.js                        # MODIFY: mount dealsRouter
├── controllers/
│   ├── accountsController.js     # EXISTS (F-04)
│   ├── contactsController.js     # EXISTS (F-05)
│   └── dealsController.js        # CREATE (F-06)
├── routes/
│   ├── accounts.js               # EXISTS (F-04)
│   ├── contacts.js               # EXISTS (F-05)
│   └── deals.js                  # CREATE (F-06)
└── middleware/
    └── auth.js                   # EXISTS — requireRole, ensureAuthenticated
```

**Structure Decision**: Single-project, backend-only. Следуем паттерну F-04/F-05: один контроллер + один файл роутов. Никаких сервисных слоёв (YAGNI).

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*
