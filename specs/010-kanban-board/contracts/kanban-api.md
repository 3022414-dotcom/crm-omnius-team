# API Contracts: Kanban-доска

**Feature**: F-10 Kanban-доска
**Date**: 2026-07-05
**Base URL**: `/api/v1`

---

## GET /deals/kanban

Возвращает все сделки, сгруппированные по стадиям воронки продаж.

### Auth

Требует авторизации (любая роль: admin, bdm, viewer).

### Query Parameters

| Параметр | Тип | Обязателен | Описание |
|----------|-----|------------|----------|
| `owner_id` | UUID | Нет | Фильтр по владельцу сделки. Без параметра — все сделки. |

### Response 200 OK

```json
{
  "lead": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Тренинг для команды Газпром",
      "value": "150000.00",
      "account": { "name": "Газпром" },
      "owner": { "id": "550e8400-e29b-41d4-a716-446655440010", "name": "Анастасия Стефанова" },
      "close_date": "2026-08-31",
      "contacts_count": 3
    }
  ],
  "qualified": [],
  "proposal": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "title": "Консалтинг AI-стратегия",
      "value": null,
      "account": null,
      "owner": { "id": "550e8400-e29b-41d4-a716-446655440011", "name": "Дмитрий Твердохлебов" },
      "close_date": null,
      "contacts_count": 0
    }
  ],
  "negotiation": [],
  "won": [],
  "lost": []
}
```

**Инварианты ответа:**
- Всегда 6 ключей в порядке: `lead → qualified → proposal → negotiation → won → lost`
- Пустые стадии = `[]`, не `null`
- `account` = `null` если сделка без аккаунта
- Карточки отсортированы по `created_at DESC` внутри каждой стадии

### Response 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

### Response 400 Bad Request (невалидный owner_id)

Возвращается pg-ошибкой при невалидном UUID. Для MVP допустимо (4 пользователя, UUID берётся из системы).

---

## PATCH /deals/:id/stage

Меняет стадию существующей сделки. Возвращает полный объект сделки.

### Auth

Требует авторизации с ролью `admin` или `bdm`.

### Path Parameters

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | UUID | ID сделки |

### Request Body

```json
{ "stage": "qualified" }
```

| Поле | Тип | Обязателен | Допустимые значения |
|------|-----|------------|---------------------|
| `stage` | string | Да | `lead`, `qualified`, `proposal`, `negotiation`, `won`, `lost` |

### Response 200 OK

Полный объект сделки (тот же формат, что у `GET /deals/:id`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "Тренинг для команды Газпром",
  "value": "150000.00",
  "stage": "qualified",
  "close_date": "2026-08-31",
  "account": { "id": "550e8400-e29b-41d4-a716-446655440020", "name": "Газпром" },
  "owner": { "id": "550e8400-e29b-41d4-a716-446655440010", "name": "Анастасия Стефанова" },
  "created_at": "2026-07-01T10:00:00Z",
  "updated_at": "2026-07-05T14:30:00Z"
}
```

### Response 400 Bad Request

```json
{
  "error": "Bad Request",
  "message": "stage обязателен: lead/qualified/proposal/negotiation/won/lost"
}
```

Возвращается при:
- Отсутствующем `stage` в теле запроса
- Значении `stage`, не входящем в допустимый список

### Response 403 Forbidden

```json
{ "error": "Forbidden" }
```

Возвращается при попытке пользователя с ролью `viewer` изменить стадию.

### Response 404 Not Found

```json
{ "error": "Not Found" }
```

Возвращается если сделка с указанным `id` не найдена.
