# Implementation Plan: Заметки (Notes)

**Branch**: `007-notes-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-notes-crud/spec.md`

## Summary

CRUD для текстовых заметок к аккаунтам, контактам и сделкам (полиморфная ассоциация). Контроль доступа на уровне записи: редактирование/удаление — только автор ИЛИ admin (в отличие от F-04–F-06, где доступ только по роли). Таблица `notes` уже существует (F-01). Новые файлы: `server/controllers/notesController.js`, `server/routes/notes.js`. Модификации: `server/app.js`, `server/routes/accounts.js`, `server/routes/contacts.js`, `server/routes/deals.js`.

## Technical Context

**Language/Version**: Node.js LTS

**Primary Dependencies**: Express, pg (pool), express-async-errors — всё уже установлено

**Storage**: PostgreSQL 15+. Таблица `notes` создана F-01. Новых миграций не требуется.

**Testing**: Ручное тестирование по quickstart.md (MVP-подход)

**Target Platform**: Docker (Linux server)

**Project Type**: REST API (web-service)

**Performance Goals**: Нет специфических требований (команда 4 человека)

**Constraints**: YAGNI — нет новых зависимостей, нет over-engineering

**Scale/Scope**: 4 пользователя, ~50–100 заметок в MVP

## Constitution Check

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота | ✅ PASS | Controller + routes, без лишних абстракций |
| Spec-First | ✅ PASS | Spec → clarify → plan → tasks → implement |
| Последовательность фич | ✅ PASS | F-06 завершён, F-07 следующая |
| YAGNI | ✅ PASS | Только поля из spec, без over-engineering |
| Stack compliance | ✅ PASS | Node.js + Express + pg, no new deps |
| UUID PK | ✅ PASS | Таблица notes использует UUID (F-01) |
| TIMESTAMPTZ | ✅ PASS | created_at/updated_at через существующий триггер |
| REST /api/v1/ | ✅ PASS | /api/v1/notes |
| Roles/RBAC | ✅ PASS | requireRole(['admin','bdm']) + record-level author check |

**Constitution Check: PASS**

## Project Structure

### Documentation (this feature)

```text
specs/007-notes-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── notes-api.md     # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── app.js                        # MODIFY: mount notesRouter
├── controllers/
│   └── notesController.js        # CREATE: createNote, updateNote, deleteNote, listNotesForEntity
├── routes/
│   ├── notes.js                  # CREATE: POST /, PUT /:id, DELETE /:id
│   ├── accounts.js               # MODIFY: GET /:id/notes
│   ├── contacts.js               # MODIFY: GET /:id/notes
│   └── deals.js                  # MODIFY: GET /:id/notes
└── middleware/
    └── auth.js                   # EXISTS — requireRole (используется без изменений)
```

**Structure Decision**: Single-project, backend-only. Паттерн F-04/F-05/F-06: один контроллер + один файл роутов. Список заметок реализуется как factory function `listNotesForEntity(entityType)` — переиспользуется в трёх существующих роутерах.

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*
