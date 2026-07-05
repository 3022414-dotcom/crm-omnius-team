# Implementation Plan: Вложения (Attachments)

**Branch**: `008-attachments-crud` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-attachments-crud/spec.md`

## Summary

CRUD для файловых вложений к аккаунтам, контактам и сделкам (полиморфная ассоциация). Загрузка через multipart/form-data (multer), хранение на локальной ФС (`uploads/`), скачивание через `/download`, удаление только admin (в отличие от F-07, где автор мог удалять). Таблица `attachments` уже существует (F-01). multer уже установлен (F-05). Новые файлы: `attachmentsController.js`, `attachments.js`. Модификации: `app.js`, `accounts.js`, `contacts.js`, `deals.js`, `accountsController.js`, `contactsController.js`, `dealsController.js` (каскадное удаление файлов).

## Technical Context

**Language/Version**: Node.js LTS

**Primary Dependencies**: Express, pg (pool), multer, fs (built-in), path (built-in), express-async-errors — всё уже установлено

**Storage**: PostgreSQL 15+ (таблица `attachments`, F-01) + локальная ФС (`uploads/`)

**Testing**: Ручное тестирование по quickstart.md (MVP-подход)

**Target Platform**: Docker (Linux server)

**Project Type**: REST API (web-service)

**Performance Goals**: Нет специфических (команда 4 человека); лимит файла 50 MB

**Constraints**: YAGNI — нет новых зависимостей, нет over-engineering

**Scale/Scope**: 4 пользователя, небольшое количество файлов в MVP

## Constitution Check

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота | ✅ PASS | Controller + routes, multer уже в стеке |
| Spec-First | ✅ PASS | Spec → clarify → plan → tasks → implement |
| Последовательность фич | ✅ PASS | F-07 завершён, F-08 следующая |
| YAGNI | ✅ PASS | Только поля из spec, без over-engineering |
| Stack compliance | ✅ PASS | Node.js + Express + pg + multer, no new deps |
| UUID PK | ✅ PASS | Таблица attachments использует UUID (F-01) |
| TIMESTAMPTZ | ✅ PASS | created_at через существующий DEFAULT NOW() |
| REST /api/v1/ | ✅ PASS | /api/v1/attachments |
| Roles/RBAC | ✅ PASS | requireRole(['admin','bdm']) upload; requireRole(['admin']) delete |

**Constitution Check: PASS**

## Project Structure

### Documentation (this feature)

```text
specs/008-attachments-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── attachments-api.md  # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── app.js                            # MODIFY: mount attachmentsRouter
├── controllers/
│   ├── attachmentsController.js      # CREATE: createAttachment, listAttachmentsForEntity, downloadAttachment, deleteAttachment
│   ├── accountsController.js         # MODIFY: deleteAccount — cascade delete files + DB records
│   ├── contactsController.js         # MODIFY: deleteContact — cascade delete files + DB records
│   └── dealsController.js            # MODIFY: deleteDeal — cascade delete files + DB records
├── routes/
│   ├── attachments.js                # CREATE: POST /, GET /:id/download, DELETE /:id
│   ├── accounts.js                   # MODIFY: GET /:id/attachments
│   ├── contacts.js                   # MODIFY: GET /:id/attachments
│   └── deals.js                      # MODIFY: GET /:id/attachments
└── middleware/
    └── auth.js                       # EXISTS — requireRole (без изменений)
uploads/                              # EXISTS — добавятся поддиректории accounts/, contacts/, deals/
```

**Key differences from F-07 (Notes)**:
1. Multer middleware для upload (multipart/form-data)
2. Download endpoint (`/attachments/:id/download`)
3. Cascade delete требует не только DB-delete но и fs.unlink всех файлов → модификация accountsController/contactsController/dealsController
4. Удаление только admin (без record-level исключения для автора)

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*
