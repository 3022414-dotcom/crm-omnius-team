# API Contract: Notes

**Auth**: все эндпоинты требуют сессии (ensureAuthenticated)

---

## POST /api/v1/notes

**Роли**: admin, bdm | **Статус 403**: viewer

**Request Body**:
```json
{
  "entity_type": "account",   // REQUIRED: account | contact | deal
  "entity_id":   "uuid",      // REQUIRED
  "content":     "Текст заметки"  // REQUIRED, непустой
}
```

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 201 | Note Object (с author {id, name}) | Успех |
| 400 | `{"error":"Bad Request","message":"content обязателен"}` | content пустой/отсутствует |
| 400 | `{"error":"Bad Request","message":"Невалидный entity_type"}` | entity_type не из списка |
| 404 | `{"error":"Not Found"}` | entity_id не существует |
| 403 | `{"error":"Forbidden"}` | viewer |

**Поведение**: author_id = req.user.id

---

## GET /api/v1/accounts/:id/notes

**Роли**: все авторизованные

**Response 200**: Простой массив `[Note Object, ...]`, sorted created_at DESC

| Code | Условие |
|------|---------|
| 200 | `[...notes]` (пустой массив если нет заметок) |
| 404 | Аккаунт не найден |

---

## GET /api/v1/contacts/:id/notes

**Роли**: все авторизованные

| Code | Условие |
|------|---------|
| 200 | `[...notes]` |
| 404 | Контакт не найден |

---

## GET /api/v1/deals/:id/notes

**Роли**: все авторизованные

| Code | Условие |
|------|---------|
| 200 | `[...notes]` |
| 404 | Сделка не найдена |

---

## PUT /api/v1/notes/:id

**Роли**: admin, bdm (+ record-level: только автор ИЛИ admin)

**Request Body**:
```json
{ "content": "Обновлённый текст" }
```

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 200 | Note Object (с author {id, name}) | Успех |
| 400 | `{"error":"Bad Request","message":"content обязателен"}` | content пустой |
| 403 | `{"error":"Forbidden"}` | viewer, или bdm не-автор |
| 404 | `{"error":"Not Found"}` | Заметка не найдена |

---

## DELETE /api/v1/notes/:id

**Роли**: admin, bdm (+ record-level: только автор ИЛИ admin)

| Code | Условие |
|------|---------|
| 204 | Заметка удалена |
| 403 | viewer, или bdm не-автор |
| 404 | Заметка не найдена |
