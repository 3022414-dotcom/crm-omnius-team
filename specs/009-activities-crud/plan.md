# Implementation Plan: Активности (Activities)

**Branch**: `009-activities-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-activities-crud/spec.md`

## Summary

CRUD для активностей (звонки, письма, встречи, задачи) к аккаунтам, контактам и сделкам. Полиморфная ассоциация (entity_type + entity_id). Ключевые особенности: вычисляемое поле `overdue` в SQL, фильтрация по completed/type/due_date (null-inclusive), bidirectional completed toggle. Таблица `activities` уже существует (F-01). Каскадное удаление уже реализовано в F-04/F-05/F-06 — F-09 его не затрагивает. Новые файлы: `activitiesController.js`, `activities.js`. Модификации: `app.js`, `accounts.js`, `contacts.js`, `deals.js`.

## Technical Context

**Language/Version**: Node.js LTS

**Primary Dependencies**: Express, pg (pool), express-async-errors — всё уже установлено; новых зависимостей нет

**Storage**: PostgreSQL 15+ (таблица `activities`, F-01) — миграция не нужна

**Testing**: Ручное тестирование по quickstart.md (MVP-подход, без unit-тестов)

**Target Platform**: Docker (Linux server)

**Project Type**: REST API (web-service)

**Performance Goals**: Нет (команда 4 человека, внутренний инструмент)

**Constraints**: YAGNI — нет новых зависимостей, нет новых миграций

**Scale/Scope**: 4 пользователя, внутренняя CRM

## Constitution Check

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота | ✅ PASS | Controller + routes, знакомый паттерн F-07/F-08 |
| Spec-First | ✅ PASS | specify → clarify → plan → tasks → implement |
| Последовательность фич | ✅ PASS | F-08 завершён, F-09 следующая |
| YAGNI | ✅ PASS | Только поля из spec, нет лишних абстракций |
| Stack compliance | ✅ PASS | Node.js + Express + pg, no new deps |
| UUID PK | ✅ PASS | Таблица activities использует UUID (F-01) |
| TIMESTAMPTZ | ✅ PASS | created_at + updated_at с DEFAULT NOW() + trigger |
| REST /api/v1/ | ✅ PASS | /api/v1/activities |
| Roles/RBAC | ✅ PASS | requireRole(['admin','bdm']) create/update; requireRole(['admin']) delete |

**Constitution Check: PASS**

## Project Structure

### Documentation (this feature)

```text
specs/009-activities-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── activities-api.md  # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── app.js                            # MODIFY: mount activitiesRouter
├── controllers/
│   └── activitiesController.js       # CREATE: createActivity, listActivitiesForEntity, updateActivity, deleteActivity
├── routes/
│   ├── activities.js                 # CREATE: POST /, PUT /:id, DELETE /:id
│   ├── accounts.js                   # MODIFY: GET /:id/activities
│   ├── contacts.js                   # MODIFY: GET /:id/activities
│   └── deals.js                      # MODIFY: GET /:id/activities
└── middleware/
    └── auth.js                       # EXISTS — requireRole (без изменений)
```

**Key differences from F-07/F-08**:
1. Вычисляемое поле `overdue` — SQL CASE WHEN в каждом SELECT
2. Фильтрация по multiple параметрам (completed, type, due_date_from/to) с dynamic WHERE
3. Null-inclusive date filter: `(due_date IS NULL OR due_date >= $X)`
4. Нет файловых операций (в отличие от F-08)
5. Каскадное удаление уже реализовано в F-04/F-05/F-06 — F-09 ничего не меняет в существующих контроллерах

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*
