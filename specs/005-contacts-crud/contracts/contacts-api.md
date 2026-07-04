# API Contract: Контакты (Contacts)

**Feature**: F-05 Контакты | **Date**: 2026-07-04 | **Plan**: [plan.md](../plan.md)

**Base URL**: `/api/v1/contacts`

**Auth**: Все эндпоинты требуют аутентификации (ensureAuthenticated в app.js).

---

## POST /api/v1/contacts

**Создание нового контакта**

**Доступ**: admin, bdm

**Request Body** (application/json):
```json
{
  "first_name": "Иван",        // required: непустая строка
  "last_name": "Иванов",       // required: непустая строка
  "email": "ivan@example.com", // optional
  "phone": "+7 495 123-45-67", // optional
  "position": "Директор",      // optional
  "account_id": "uuid..."      // optional; 400 если аккаунт не существует
}
```

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 201 | Contact Object | Успешное создание |
| 400 | `{ "error": "Bad Request", "message": "Поле first_name обязательно" }` | Отсутствует или пустое first_name/last_name |
| 400 | `{ "error": "Bad Request", "message": "Аккаунт не найден" }` | account_id не существует |
| 401 | `{ "error": "Unauthorized" }` | Не авторизован |
| 403 | `{ "error": "Forbidden", "message": "..." }` | Роль viewer |

**Notes**: `owner_id` = `req.user.id` (автоматически); `photo_path` = null

---

## GET /api/v1/contacts

**Список контактов с поиском и пагинацией**

**Доступ**: admin, bdm, viewer

**Query Parameters**:

| Параметр | Default | Описание |
|----------|---------|----------|
| search | `""` | Поиск по first_name, last_name, email (ILIKE, case-insensitive) |
| page | `1` | Номер страницы (< 1 → 1) |
| limit | `20` | Размер страницы (> 100 → 100) |

**Response 200**:
```json
{
  "data": [ /* Contact Objects */ ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Edge Cases**:
- Нет контактов / поиск без результатов → `{ "data": [], "total": 0, "page": 1, "limit": 20 }`
- Сортировка: `ORDER BY created_at DESC`

---

## GET /api/v1/accounts/:id/contacts

**Список контактов конкретного аккаунта**

**Доступ**: admin, bdm, viewer

**Path Parameters**: `:id` — UUID аккаунта

**Query Parameters**: те же что у GET /api/v1/contacts (page, limit; search — по желанию)

**Response 200**:
```json
{
  "data": [ /* Contact Objects */ ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

**Responses**:

| Code | Условие |
|------|---------|
| 200 | Список контактов аккаунта (может быть пустым) |
| 404 | `{ "error": "Not Found" }` — аккаунт не существует |

---

## GET /api/v1/contacts/:id

**Просмотр одного контакта**

**Доступ**: admin, bdm, viewer

**Path Parameters**: `:id` — UUID контакта

**Response 200**: Contact Object

**Responses**:

| Code | Условие |
|------|---------|
| 200 | Контакт найден |
| 404 | `{ "error": "Not Found" }` |

---

## PUT /api/v1/contacts/:id

**Частичное обновление контакта** (только переданные поля изменяются)

**Доступ**: admin, bdm

**Request Body** (application/json) — любое подмножество полей:
```json
{
  "phone": "+7 (900) 111-22-33"
}
```

**Updatable Fields**: `first_name`, `last_name`, `email`, `phone`, `position`, `account_id`

**Non-updatable**: `id`, `owner_id`, `photo_path`, `created_at`, `updated_at`

**Notes**:
- `account_id: null` — допустимо (отвязывает от аккаунта)
- `account_id: "<uuid>"` — проверяется существование аккаунта (400 если не найден)
- Пустое тело `{}` → 200, данные без изменений

**Responses**:

| Code | Условие |
|------|---------|
| 200 | Успешное обновление; Contact Object в ответе |
| 400 | first_name/last_name пустая строка; account_id не найден |
| 403 | Роль viewer |
| 404 | Контакт не существует |

---

## DELETE /api/v1/contacts/:id

**Удаление контакта** (с каскадом)

**Доступ**: admin only

**Cascade Behavior**:
1. DB auto CASCADE: `deal_contacts` WHERE contact_id = id
2. Приложение: удалить файл фото если `photo_path` не null

**Responses**:

| Code | Условие |
|------|---------|
| 204 | Успешное удаление |
| 403 | Роль bdm/viewer |
| 404 | Контакт не существует |

---

## POST /api/v1/contacts/:id/photo

**Загрузка / замена фото контакта**

**Доступ**: admin, bdm

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `photo` — файл изображения (jpeg/jpg/png/webp, max 5 MB)

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 200 | `{ "photo_url": "/uploads/contacts/{id}/avatar_{uuid}.ext" }` | Успешная загрузка |
| 400 | `{ "error": "Bad Request", "message": "Допустимые форматы: jpeg, jpg, png, webp" }` | Неверный формат |
| 400 | `{ "error": "Bad Request", "message": "Файл не загружен" }` | Поле photo отсутствует |
| 403 | `{ "error": "Forbidden" }` | Роль viewer |
| 404 | `{ "error": "Not Found" }` | Контакт не существует |
| 413 | `{ "error": "Payload Too Large", "message": "Файл не должен превышать 5 MB" }` | Файл > 5 MB |

**Notes**:
- Старое фото удаляется автоматически перед сохранением нового
- photo_path в БД обновляется автоматически

---

## DELETE /api/v1/contacts/:id/photo

**Удаление фото контакта**

**Доступ**: admin, bdm

**Responses**:

| Code | Условие |
|------|---------|
| 200 | `{}` — фото удалено (или уже не было — идемпотентно) |
| 403 | Роль viewer |
| 404 | Контакт не существует |
