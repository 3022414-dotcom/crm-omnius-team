# Implementation Plan: Роли и права доступа (RBAC)

**Branch**: `003-roles-access` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-roles-access/spec.md`

## Summary

Реализация ролевой модели доступа (RBAC) для CRM omnius.team. Три роли: admin (полный доступ), bdm (чтение + запись без удаления), viewer (только чтение). Реализация через centralized middleware `requireRole(allowedRoles)` в Express, применяемый на уровне отдельных роутов. Добавляются эндпоинты управления пользователями: GET /api/v1/users, GET /api/v1/users/me, GET /api/v1/users/:id, PATCH /api/v1/users/:id/role.

## Technical Context

**Language/Version**: Node.js LTS 18+

**Primary Dependencies**: Express, pg — оба уже установлены в F-01/F-02; новых зависимостей не требуется

**Storage**: PostgreSQL 15 — таблица `users` создана в F-01 (поле `role` ENUM: admin/bdm/viewer уже существует)

**Testing**: Ручное тестирование через curl/httpie или Insomnia; автоматизированные тесты не в scope MVP

**Target Platform**: Linux server (Docker, образ node:lts-alpine)

**Project Type**: web-service (backend API only)

**Performance Goals**: Нет специфических целей — внутренний инструмент для 4 человек

**Constraints**: `requireRole` middleware не делает DB-запросов (роль уже в `req.user` через `deserializeUser` F-02); только проверка last-admin требует одного дополнительного SELECT

**Scale/Scope**: 4 пользователя, ~10 эндпоинтов в области F-03

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота прежде всего | ✅ PASS | Только middleware + router + controller; никаких лишних абстракций |
| YAGNI | ✅ PASS | Только то, что нужно RBAC: requireRole middleware + user endpoints |
| Spec-First | ✅ PASS | Spec + clarification завершены до планирования |
| REST API `/api/v1/` prefix | ✅ PASS | Все новые эндпоинты: /api/v1/users/* |
| HTTP status codes | ✅ PASS | 200/400/401/403/404 покрыты по spec |
| UUID PK | ✅ PASS | Существующая таблица users — UUID PK от F-01 |
| Нет over-engineering | ✅ PASS | Нет Repository pattern, нет DI, нет policy-based auth |

**Re-check post-design**: ✅ PASS — дизайн соответствует всем принципам конституции.

## Project Structure

### Documentation (this feature)

```text
specs/003-roles-access/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── users-api.md     # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
server/
├── middleware/
│   └── auth.js              # MODIFY: add requireRole(allowedRoles) to existing file
├── routes/
│   ├── auth.js              # EXISTING F-02 — no changes
│   └── users.js             # NEW: /api/v1/users routes
├── controllers/
│   └── usersController.js   # NEW: listUsers, getMe, getUserById, updateUserRole
└── app.js                   # MODIFY: mount /api/v1/users router
```

**Structure Decision**: Single backend project. F-03 добавляет в существующую структуру server/ из F-01/F-02 без новых директорий верхнего уровня. Директория `controllers/` определена конституцией и создаётся здесь впервые.
