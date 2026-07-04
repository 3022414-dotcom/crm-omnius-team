# API Contract: Аккаунты (Accounts)

**Feature**: F-04 Аккаунты | **Date**: 2026-07-04 | **Plan**: [plan.md](../plan.md)

**Base URL**: `/api/v1/accounts`

**Auth**: Все эндпоинты требуют аутентификации (обеспечивается `ensureAuthenticated` в app.js).

---

## POST /api/v1/accounts

**Создание нового аккаунта**

**Доступ**: admin, bdm

**Request Body** (application/json):
```json
{
  "name": "Рога и Копыта ООО",        // required: непустая строка
  "industry": "Консалтинг",            // optional
  "website": "https://rogaikopyta.ru", // optional
  "phone": "+7 (495) 123-45-67",       // optional
  "address": "Москва, ул. Пушкина, 1", // optional
  "notes": "Ключевой клиент"           // optional
}
```

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 201 | Account Object (без счётчиков) | Успешное создание |
| 400 | `{ "error": "Bad Request", "message": "Поле name обязательно" }` | name отсутствует или пустая строка |
| 401 | `{ "error": "Unauthorized" }` | Не авторизован |
| 403 | `{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }` | Роль viewer |

**Notes**:
- `owner_id` устанавливается автоматически = `req.user.id`; поле из тела игнорируется
- `id`, `created_at`, `updated_at` генерируются сервером

---

## GET /api/v1/accounts

**Список аккаунтов с поиском и пагинацией**

**Доступ**: admin, bdm, viewer (любая авторизованная роль)

**Query Parameters**:

| Параметр | Тип | Default | Описание |
|----------|-----|---------|----------|
| search | string | `""` | Поиск по name (ILIKE, case-insensitive) |
| page | integer | `1` | Номер страницы (< 1 → 1) |
| limit | integer | `20` | Размер страницы (> 100 → 100) |

**Response 200** (application/json):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Рога и Копыта ООО",
      "industry": "Консалтинг",
      "website": "https://rogaikopyta.ru",
      "phone": "+7 (495) 123-45-67",
      "address": "Москва, ул. Пушкина, 1",
      "notes": "Ключевой клиент",
      "owner_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2026-07-04T10:00:00.000Z",
      "updated_at": "2026-07-04T10:00:00.000Z",
      "contactsCount": 3,
      "dealsCount": 2
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

**Edge Cases**:
- Нет аккаунтов / поиск без результатов → `{ "data": [], "total": 0, "page": 1, "limit": 20 }`
- Сортировка: `ORDER BY created_at DESC` (newest first)

---

## GET /api/v1/accounts/:id

**Просмотр одного аккаунта**

**Доступ**: admin, bdm, viewer (любая авторизованная роль)

**Path Parameters**:
- `:id` — UUID аккаунта

**Response 200** (application/json) — Account Object с `contactsCount` и `dealsCount`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Рога и Копыта ООО",
  "industry": "Консалтинг",
  "website": "https://rogaikopyta.ru",
  "phone": "+7 (495) 123-45-67",
  "address": "Москва, ул. Пушкина, 1",
  "notes": "Ключевой клиент",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-07-04T10:00:00.000Z",
  "updated_at": "2026-07-04T10:00:00.000Z",
  "contactsCount": 3,
  "dealsCount": 2
}
```

**Responses**:

| Code | Условие |
|------|---------|
| 200 | Аккаунт найден |
| 404 | `{ "error": "Not Found" }` — аккаунт не существует |
| 401 | Не авторизован |

---

## PUT /api/v1/accounts/:id

**Частичное обновление аккаунта** (только переданные поля изменяются)

**Доступ**: admin, bdm

**Path Parameters**:
- `:id` — UUID аккаунта

**Request Body** (application/json) — любое подмножество полей:
```json
{
  "phone": "+7 (495) 999-00-00"
}
```

**Updatable Fields**: `name`, `industry`, `website`, `phone`, `address`, `notes`

**Non-updatable**: `id`, `owner_id`, `created_at`, `updated_at` — игнорируются из тела

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 200 | Account Object (без счётчиков) — полный обновлённый объект | Успешное обновление |
| 200 | Account Object без изменений | Пустое тело запроса — данные не меняются |
| 400 | `{ "error": "Bad Request", "message": "Поле name не может быть пустым" }` | name передан как пустая строка |
| 401 | `{ "error": "Unauthorized" }` | Не авторизован |
| 403 | `{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }` | Роль viewer |
| 404 | `{ "error": "Not Found" }` | Аккаунт не существует |

**Notes**:
- `updated_at` обновляется до `NOW()` при любом фактическом изменении полей
- При пустом теле запроса (0 переданных полей) — делается SELECT и возвращается текущий объект, `updated_at` не трогается

---

## DELETE /api/v1/accounts/:id

**Удаление аккаунта с каскадным удалением связанных объектов**

**Доступ**: admin only

**Path Parameters**:
- `:id` — UUID аккаунта

**Cascade Behavior** (выполняется в транзакции):
1. DELETE activities, attachments, notes, где entity_type='deal' AND entity_id IN (deals аккаунта)
2. DELETE activities, attachments, notes, где entity_type='account' AND entity_id=id
3. DELETE deals WHERE account_id=id
4. DELETE accounts WHERE id=id → DB автоматически SET NULL на contacts.account_id

**Responses**:

| Code | Body | Условие |
|------|------|---------|
| 204 | — | Успешное удаление |
| 401 | `{ "error": "Unauthorized" }` | Не авторизован |
| 403 | `{ "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }` | Роль bdm или viewer |
| 404 | `{ "error": "Not Found" }` | Аккаунт не существует |

**Notes**:
- Контакты (contacts) НЕ удаляются — их `account_id` обнуляется автоматически FK-правилом SET NULL
- Все изменения выполняются в PostgreSQL-транзакции
