# Implementation Plan: Контакты (Contacts)

**Branch**: `005-contacts-crud` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-contacts-crud/spec.md`

## Summary

Реализация CRUD-операций для контактов (физических лиц). 8 эндпоинтов: создание (admin/bdm), глобальный список с поиском/пагинацией (все роли), список контактов аккаунта (все роли), просмотр одного контакта (все роли), частичное обновление (admin/bdm), загрузка/удаление фото (admin/bdm), удаление (admin). Фото хранится в `uploads/contacts/{id}/avatar_{uuid}.ext`, управляется через multer memoryStorage + запись через fs. account_id валидируется на уровне приложения (SELECT перед INSERT/UPDATE). deal_contacts удаляются автоматически через FK CASCADE.

## Technical Context

**Language/Version**: Node.js LTS 18+

**Primary Dependencies**:
- Express, pg — уже установлены (F-01/F-02)
- multer 2.1.1 — уже установлен (указан в конституции)
- express-async-errors — уже установлен (F-03)
- `crypto.randomUUID()` — встроено в Node.js 15.6+/LTS 18+; отдельный пакет `uuid` не нужен

**Storage**: PostgreSQL 15 — таблица `contacts` создана в F-01; `deal_contacts` с CASCADE; индексы существуют

**File Storage**: локальная файловая система, `uploads/contacts/{id}/avatar_{uuid}.ext`; директория создаётся на лету при первом запросе (`fs.mkdirSync({ recursive: true })`)

**Testing**: Ручное тестирование через curl; автоматизированные тесты не в scope MVP

**Target Platform**: Linux server (Docker, node:lts-alpine)

**Project Type**: web-service (backend API only)

**Performance Goals**: Нет специфических целей — внутренний инструмент для 4 человек

**Constraints**:
- multer fileFilter + limits.fileSize для валидации на уровне middleware
- MulterError обрабатывается inline в роуте (не глобальный error handler) — возвращает 400/413
- account_id: SELECT перед INSERT/UPDATE если передан (не null)
- partial update: идентичный D-01 паттерн из F-04 research.md

**Scale/Scope**: 4 пользователя; ожидаемый объём — десятки-сотни контактов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота прежде всего | ✅ PASS | controller + router + upload middleware; никаких лишних абстракций |
| YAGNI | ✅ PASS | Только 8 эндпоинтов по spec; поиск только по 3 полям; смена owner — не в scope |
| Spec-First | ✅ PASS | Spec + clarification завершены до планирования |
| REST API `/api/v1/` prefix | ✅ PASS | /api/v1/contacts/* и /api/v1/accounts/:id/contacts |
| HTTP status codes | ✅ PASS | 200/201/204/400/403/404/413 покрыты по spec |
| UUID PK | ✅ PASS | Существующая таблица contacts — UUID PK от F-01 |
| Нет over-engineering | ✅ PASS | Нет Repository pattern, нет ORM, нет сервисного слоя |
| TIMESTAMPTZ | ✅ PASS | created_at/updated_at в таблице contacts — TIMESTAMPTZ |
| Загрузка файлов: multer | ✅ PASS | multer 2.1.1 уже установлен; конституция фиксирует multer для uploads |

**Re-check post-design**: ✅ PASS — дизайн соответствует всем принципам конституции.

## Project Structure

### Documentation (this feature)

```text
specs/005-contacts-crud/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── contacts-api.md  # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── middleware/
│   ├── auth.js              # EXISTING F-03 — без изменений
│   └── upload.js            # NEW: multer конфигурация для фото контактов
├── routes/
│   ├── auth.js              # EXISTING F-02 — без изменений
│   ├── users.js             # EXISTING F-03 — без изменений
│   ├── accounts.js          # MODIFY F-04: добавить GET /:id/contacts роут
│   └── contacts.js          # NEW: /api/v1/contacts routes
├── controllers/
│   ├── usersController.js   # EXISTING F-03 — без изменений
│   ├── accountsController.js # EXISTING F-04 — без изменений
│   └── contactsController.js # NEW: все 8 функций
└── app.js                   # MODIFY: mount /api/v1/contacts router

uploads/                     # GITIGNORED — создаётся автоматически при первом фото
└── contacts/
    └── {contact_id}/
        └── avatar_{uuid}.ext
```

**Routing Decision**: `GET /api/v1/accounts/:id/contacts` добавляется в `server/routes/accounts.js` как `router.get('/:id/contacts', listContactsByAccount)`. Это избегает конфликтов монтирования и логически принадлежит accounts-роутеру. Контроллер-функция `listContactsByAccount` живёт в `contactsController.js`.
