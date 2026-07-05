# API Contract: Attachments

**Auth**: все эндпоинты требуют сессии (ensureAuthenticated)

---

## POST /api/v1/attachments

**Роли**: admin, bdm | **Статус 403**: viewer

**Request**: `multipart/form-data`

| Поле | Тип | Обязательный | Описание |
|------|-----|-------------|---------|
| file | file | ✓ | Загружаемый файл (поле формы: `file`) |
| entity_type | string | ✓ | `account` / `contact` / `deal` |
| entity_id | uuid | ✓ | ID существующей сущности |

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 201 | Attachment Object | Успех |
| 400 | `{"error":"Bad Request","message":"Файл обязателен"}` | Файл не приложен |
| 400 | `{"error":"Bad Request","message":"Невалидный entity_type"}` | entity_type не из списка |
| 400 | `{"error":"Bad Request","message":"entity_id обязателен"}` | entity_id отсутствует |
| 404 | `{"error":"Not Found"}` | entity_id не существует |
| 403 | `{"error":"Forbidden"}` | viewer |
| 413 | `{"error":"Payload Too Large","message":"Файл не должен превышать 50 MB"}` | Файл > 50 MB |

**Поведение**: uploaded_by = req.user.id; при ошибке валидации — файл удаляется с диска.

---

## GET /api/v1/accounts/:id/attachments

**Роли**: все авторизованные

| Code | Условие |
|------|---------|
| 200 | `[...Attachment Object]` sorted created_at DESC (пустой массив если нет вложений) |
| 404 | Аккаунт не найден |

---

## GET /api/v1/contacts/:id/attachments

**Роли**: все авторизованные

| Code | Условие |
|------|---------|
| 200 | `[...Attachment Object]` |
| 404 | Контакт не найден |

---

## GET /api/v1/deals/:id/attachments

**Роли**: все авторизованные

| Code | Условие |
|------|---------|
| 200 | `[...Attachment Object]` |
| 404 | Сделка не найдена |

---

## GET /api/v1/attachments/:id/download

**Роли**: все авторизованные

**Responses**:

| Code | Headers | Условие |
|------|---------|---------|
| 200 | `Content-Disposition: attachment; filename="<file_name>"` + `Content-Type: <mime_type>` | Файл отправлен |
| 404 | — | Запись не найдена ИЛИ файл физически отсутствует на диске |
| 500 | — | Ошибка при передаче файла |

---

## DELETE /api/v1/attachments/:id

**Роли**: только admin | **Статус 403**: bdm, viewer

| Code | Условие |
|------|---------|
| 204 | Запись удалена из БД, файл удалён с диска |
| 403 | bdm или viewer |
| 404 | Вложение не найдено |
