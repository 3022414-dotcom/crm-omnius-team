# API Contract: Users

**Feature**: F-03 | **Date**: 2026-05-25
**Base path**: `/api/v1/users`

Все эндпоинты требуют аутентификации (401 если не авторизован — middleware F-02).

---

## GET /api/v1/users/me

Возвращает профиль текущего авторизованного пользователя.

**Доступ**: любой авторизованный пользователь (admin, bdm, viewer)

**Response 200**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Анастасия Стефанова",
  "email": "anastasia@omnius.team",
  "role": "bdm",
  "created_at": "2026-05-01T00:00:00.000Z"
}
```

---

## GET /api/v1/users

Возвращает список всех пользователей системы.

**Доступ**: admin only

**Response 200**:
```json
[
  {
    "id": "uuid",
    "name": "Дмитрий Твердохлебов",
    "email": "dima@omnius.team",
    "role": "admin",
    "created_at": "2026-05-01T00:00:00.000Z"
  },
  {
    "id": "uuid",
    "name": "Юлия Шевцова",
    "email": "shevtsova_julia@omnius.team",
    "role": "admin",
    "created_at": "2026-05-01T00:00:00.000Z"
  }
]
```

**Response 403** (bdm/viewer):
```json
{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }
```

---

## GET /api/v1/users/:id

Возвращает профиль конкретного пользователя по UUID.

**Доступ**: admin only

**Path params**: `id` — UUID пользователя

**Response 200**: то же shape что и GET /api/v1/users/me

**Response 403** (bdm/viewer):
```json
{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }
```

**Response 404** (пользователь не найден):
```json
{ "error": "Not Found" }
```

---

## PATCH /api/v1/users/:id/role

Изменяет роль пользователя.

**Доступ**: admin only

**Path params**: `id` — UUID пользователя

**Request body**:
```json
{ "role": "bdm" }
```

**Валидации** (в порядке проверки):
1. `role` обязательный → 400 если отсутствует
2. `role` одно из: `admin`, `bdm`, `viewer` → 400 иначе
3. `id` !== `req.user.id` → 403 если совпадает (self-role-change)
4. Не последний admin → 403 если единственный admin меняет роль

**Response 200** (успех):
```json
{
  "id": "uuid",
  "name": "Анастасия Стефанова",
  "email": "anastasia@omnius.team",
  "role": "admin",
  "created_at": "2026-05-01T00:00:00.000Z"
}
```

**Response 400** (невалидная роль или отсутствует поле):
```json
{ "error": "Bad Request", "message": "Недопустимое значение роли. Допустимые значения: admin, bdm, viewer" }
```

**Response 403** (попытка изменить свою роль):
```json
{ "error": "Forbidden", "message": "Нельзя изменить собственную роль" }
```

**Response 403** (последний admin):
```json
{ "error": "Forbidden", "message": "Невозможно изменить роль единственного администратора" }
```

**Response 403** (bdm/viewer пытается выполнить запрос):
```json
{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }
```

**Response 404** (пользователь не найден):
```json
{ "error": "Not Found" }
```

---

## Сводная таблица ошибок

| HTTP Code | Body | Условие |
|-----------|------|---------|
| 401 | `{ "error": "Unauthorized" }` | Не аутентифицирован (F-02 middleware) |
| 403 | `{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }` | Роль не разрешает операцию |
| 403 | `{ "error": "Forbidden", "message": "Нельзя изменить собственную роль" }` | Self-role-change |
| 403 | `{ "error": "Forbidden", "message": "Невозможно изменить роль единственного администратора" }` | Last-admin protection |
| 400 | `{ "error": "Bad Request", "message": "..." }` | Невалидное значение role |
| 404 | `{ "error": "Not Found" }` | Пользователь не найден |
