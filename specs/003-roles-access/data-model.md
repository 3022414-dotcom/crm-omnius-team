# Data Model: Роли и права доступа (RBAC)

**Feature**: F-03 | **Date**: 2026-05-25

F-03 не создаёт новых таблиц в БД. Используется существующая таблица `users`, созданная в F-01.

---

## Existing Entity: users

| Поле | Тип PostgreSQL | Ограничения | Описание |
|------|---------------|-------------|---------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Идентификатор пользователя |
| name | VARCHAR | NOT NULL | Полное имя |
| email | VARCHAR | UNIQUE NOT NULL | Email в нижнем регистре |
| role | user_role ENUM | NOT NULL | Роль: 'admin', 'bdm', 'viewer' |
| google_id | VARCHAR | UNIQUE, NULLABLE | Google OAuth ID (внутренний) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Дата создания |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Дата обновления (триггер set_updated_at) |

**ENUM тип** `user_role` создан в F-01 миграции: `CREATE TYPE user_role AS ENUM ('admin', 'bdm', 'viewer')`

### Текущие данные (seed F-01)

| name | email | role |
|------|-------|------|
| Дмитрий Твердохлебов | dima@omnius.team | admin |
| Юлия Шевцова | shevtsova_julia@omnius.team | admin |
| Анастасия Стефанова | anastasia@omnius.team | bdm |
| Илья Болховский | ilya.bolkhovsky@gmail.com | viewer |

---

## Application-Level Model: Permission Matrix

Матрица определяется в коде, а не в БД. `requireRole(allowedRoles)` проверяет `req.user.role` против списка.

| HTTP Method | Область применения | Допустимые роли |
|-------------|-------------------|----------------|
| GET | /api/v1/* (все ресурсы) | admin, bdm, viewer |
| POST | /api/v1/* | admin, bdm |
| PUT | /api/v1/* | admin, bdm |
| DELETE | /api/v1/* | admin |
| GET | /api/v1/users (список) | admin |
| GET | /api/v1/users/me | admin, bdm, viewer |
| GET | /api/v1/users/:id | admin |
| PATCH | /api/v1/users/:id/role | admin |

---

## API Response Shape: User Object

Поля, возвращаемые в API-ответах (google_id исключён):

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "admin | bdm | viewer",
  "created_at": "ISO 8601 timestamp"
}
```

---

## Business Rules (application-level constraints)

1. **Self-role protection**: Пользователь не может изменить собственную роль (`req.user.id === req.params.id` → 403)
2. **Last-admin protection**: Нельзя изменить роль единственного admin (`COUNT(*) WHERE role='admin' = 1` и target = этот admin → 403)
3. **Role validation**: Значение `role` в PATCH запросе должно быть одним из: `admin`, `bdm`, `viewer` → иначе 400
