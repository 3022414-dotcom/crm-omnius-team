# API Contract: Активности (Activities)

**Date**: 2026-07-05 | **Base URL**: `/api/v1`

## Общие соглашения

- Аутентификация: сессия (session cookie); все эндпоинты требуют авторизации
- Content-Type: `application/json` (кроме GET, DELETE)
- Ответы на ошибки: `{ "error": "...", "message": "..." }`
- UUID: стандартный RFC 4122

---

## POST /api/v1/activities

Создать новую активность.

**Доступ**: `admin`, `bdm`

**Request Body**:
```json
{
  "type":        "call",
  "entity_type": "account",
  "entity_id":   "uuid",
  "description": "Обсудили условия договора",
  "due_date":    "2026-07-10T12:00:00.000Z"
}
```

| Поле | Обязательно | Тип | Допустимые значения |
|------|------------|-----|---------------------|
| `type` | ✅ | string ENUM | `call \| email \| meeting \| task` |
| `entity_type` | ✅ | string ENUM | `account \| contact \| deal` |
| `entity_id` | ✅ | UUID string | UUID существующей сущности |
| `description` | ❌ | string | произвольный текст |
| `due_date` | ❌ | ISO 8601 string | дата в будущем или прошлом |

**Response 201 Created**:
```json
{
  "id":          "uuid",
  "type":        "call",
  "entity_type": "account",
  "entity_id":   "uuid",
  "description": "Обсудили условия договора",
  "due_date":    "2026-07-10T12:00:00.000Z",
  "completed":   false,
  "overdue":     false,
  "owner": {
    "id":   "uuid",
    "name": "Анастасия Стефанова"
  },
  "created_at":  "2026-07-05T10:00:00.000Z",
  "updated_at":  "2026-07-05T10:00:00.000Z"
}
```

**Errors**:
| Status | Условие |
|--------|---------|
| 400 | `type` отсутствует или не из списка |
| 400 | `entity_type` не из списка |
| 400 | `entity_id` отсутствует |
| 403 | пользователь — `viewer` |
| 404 | сущность `entity_id` не найдена |

---

## GET /api/v1/accounts/:id/activities

Список активностей аккаунта.

**Доступ**: все авторизованные роли

**Query Parameters**:
| Параметр | Тип | Примечание |
|----------|-----|------------|
| `completed` | `"true"` / `"false"` | без параметра — все |
| `type` | `call \| email \| meeting \| task` | без параметра — все типы |
| `due_date_from` | ISO 8601 date | нижняя граница; null-due_date записи включаются |
| `due_date_to` | ISO 8601 date | верхняя граница; null-due_date записи включаются |

**Response 200 OK**:
```json
[
  {
    "id":          "uuid",
    "type":        "call",
    "entity_type": "account",
    "entity_id":   "uuid",
    "description": "Звонок по договору",
    "due_date":    null,
    "completed":   false,
    "overdue":     false,
    "owner": { "id": "uuid", "name": "Анастасия Стефанова" },
    "created_at":  "2026-07-05T10:00:00.000Z",
    "updated_at":  "2026-07-05T10:00:00.000Z"
  }
]
```

Пустой массив `[]` если активностей нет.

**Errors**:
| Status | Условие |
|--------|---------|
| 404 | аккаунт `:id` не найден |

---

## GET /api/v1/contacts/:id/activities

Идентичен `/api/v1/accounts/:id/activities` — тот же контракт, `entity_type = "contact"`.

---

## GET /api/v1/deals/:id/activities

Идентичен `/api/v1/accounts/:id/activities` — тот же контракт, `entity_type = "deal"`.

---

## PUT /api/v1/activities/:id

Обновить активность.

**Доступ**: `admin`, `bdm`

**Request Body** (все поля опциональны, хотя бы одно обязательно):
```json
{
  "type":        "email",
  "description": "Обновлённое описание",
  "due_date":    "2026-07-15T09:00:00.000Z",
  "completed":   true
}
```

| Поле | Тип | Допустимые значения |
|------|-----|---------------------|
| `type` | string ENUM | `call \| email \| meeting \| task` |
| `description` | string \| null | произвольный текст или null |
| `due_date` | ISO 8601 string \| null | дата или null |
| `completed` | boolean | `true \| false` (двусторонний toggle) |

**Response 200 OK**: Полный объект активности (см. POST 201).

**Errors**:
| Status | Условие |
|--------|---------|
| 400 | `type` невалидное значение |
| 403 | пользователь — `viewer` |
| 404 | активность `:id` не найдена |

---

## DELETE /api/v1/activities/:id

Удалить активность.

**Доступ**: только `admin`

**Response 204 No Content**: Тело отсутствует.

**Errors**:
| Status | Условие |
|--------|---------|
| 403 | пользователь — `bdm` или `viewer` |
| 404 | активность `:id` не найдена |
