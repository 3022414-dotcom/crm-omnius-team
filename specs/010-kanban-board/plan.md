# Implementation Plan: Kanban-доска

**Branch**: `010-kanban-board` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-kanban-board/spec.md`

## Summary

Kanban-представление сделок по стадиям воронки продаж. Два новых эндпоинта: GET для получения доски и PATCH для смены стадии. **Нет новых файлов**: оба метода добавляются в существующие `dealsController.js` и `deals.js`. Нет новых таблиц, нет новых зависимостей. `VALID_STAGES` уже определён в dealsController.js.

## Technical Context

**Language/Version**: Node.js LTS

**Primary Dependencies**: Express, pg (pool) — уже установлены; новых зависимостей нет

**Storage**: PostgreSQL 15+ — данные из таблиц `deals`, `accounts`, `users`, `deal_contacts`; миграции не нужны

**Testing**: Ручное тестирование по quickstart.md

**Target Platform**: Docker (Linux server)

**Project Type**: REST API (web-service)

**Performance Goals**: Нет (4 пользователя, внутренний инструмент)

**Constraints**: YAGNI — нет новых файлов, нет новых зависимостей

**Scale/Scope**: 4 пользователя, MVP

## Constitution Check

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота | ✅ PASS | 2 функции в уже существующих файлах |
| Spec-First | ✅ PASS | specify → clarify → plan → tasks → implement |
| Последовательность фич | ✅ PASS | F-09 завершён, F-10 следующая |
| YAGNI | ✅ PASS | Нет новых файлов, таблиц, зависимостей |
| Stack compliance | ✅ PASS | Node.js + Express + pg |
| UUID PK | ✅ PASS | Используем существующую deals.id |
| TIMESTAMPTZ | ✅ PASS | created_at/updated_at из существующих таблиц |
| REST /api/v1/ | ✅ PASS | /api/v1/deals/kanban, /api/v1/deals/:id/stage |
| Roles/RBAC | ✅ PASS | kanban GET = все роли; PATCH stage = admin/bdm |

**Constitution Check: PASS**

## Project Structure

### Documentation (this feature)

```text
specs/010-kanban-board/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── kanban-api.md    # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── controllers/
│   └── dealsController.js    # MODIFY: add getKanbanDeals, updateDealStage
└── routes/
    └── deals.js              # MODIFY: GET /kanban (before /:id), PATCH /:id/stage
```

**Нет новых файлов** — всё добавляется в уже существующие.

**Key decisions:**
- `GET /api/v1/deals/kanban` зарегистрирован ПЕРЕД `GET /:id` в deals.js (иначе Express перехватит "kanban" как UUID)
- `PATCH /api/v1/deals/:id/stage` — отдельный от `PUT /:id` эндпоинт (partial update — только stage)
- `VALID_STAGES` уже определён в dealsController.js — переиспользуется без дублирования
- Группировка по stage — на уровне JS (SQL возвращает плоский список, JS строит объект)
- `contacts_count` — SQL COUNT через LEFT JOIN deal_contacts

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*
