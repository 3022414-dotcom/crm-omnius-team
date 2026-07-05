# Data Model: Активности (Activities)

**Date**: 2026-07-05 | **Plan**: [plan.md](plan.md)

## Таблица `activities` (F-01, без изменений)

| Колонка | Тип | Ограничения | Примечание |
|---------|-----|-------------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | |
| `type` | `activity_type` ENUM | NOT NULL | `call \| email \| meeting \| task` |
| `entity_type` | `entity_type` ENUM | NOT NULL | `account \| contact \| deal` |
| `entity_id` | `UUID` | NOT NULL | полиморфный FK (без constraint) |
| `description` | `TEXT` | nullable | опциональное описание |
| `due_date` | `TIMESTAMPTZ` | nullable | срок выполнения |
| `completed` | `BOOLEAN` | NOT NULL, DEFAULT false | статус выполнения |
| `owner_id` | `UUID` | NOT NULL, FK → users(id), ON DELETE RESTRICT | создатель/ответственный |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | обновляется триггером |

**Индекс**: `idx_activities_entity` ON `(entity_type, entity_id)` — уже создан в F-01.

**Триггер**: `set_updated_at` — уже создан в F-01.

**Миграция**: Не требуется — таблица полностью существует.

## API Response Shape

### Activity Object

```json
{
  "id": "uuid",
  "type": "call",
  "entity_type": "account",
  "entity_id": "uuid",
  "description": "Обсудили условия договора",
  "due_date": "2026-07-10T12:00:00.000Z",
  "completed": false,
  "overdue": false,
  "owner": {
    "id": "uuid",
    "name": "Анастасия Стефанова"
  },
  "created_at": "2026-07-05T10:00:00.000Z",
  "updated_at": "2026-07-05T10:00:00.000Z"
}
```

**НЕ включается в ответ**: `owner_id` (внутреннее поле).

### overdue computation

Поле `overdue` вычисляется в SQL (не хранится в БД):

```sql
CASE
  WHEN a.due_date IS NOT NULL
    AND a.due_date < NOW()
    AND a.completed = false
  THEN true
  ELSE false
END AS overdue
```

| Условие | overdue |
|---------|---------|
| `due_date = null` | `false` |
| `completed = true` | `false` (независимо от due_date) |
| `due_date < NOW()` AND `completed = false` | `true` |
| `due_date >= NOW()` AND `completed = false` | `false` |

## Access Control

| Операция | admin | bdm | viewer |
|----------|-------|-----|--------|
| POST /api/v1/activities | ✅ | ✅ | ❌ |
| GET /api/v1/*/activities | ✅ | ✅ | ✅ |
| PUT /api/v1/activities/:id | ✅ | ✅ | ❌ |
| DELETE /api/v1/activities/:id | ✅ | ❌ | ❌ |

Нет record-level restriction для PUT — bdm может редактировать чужие активности.

## Filter Behavior

Все фильтры применяются через query-string к entity-specific LIST эндпоинтам.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `completed` | `"true"` / `"false"` | Фильтр по статусу; без параметра — все |
| `type` | `call \| email \| meeting \| task` | Фильтр по типу; без параметра — все |
| `due_date_from` | ISO 8601 | Нижняя граница (включительно); null-inclusive |
| `due_date_to` | ISO 8601 | Верхняя граница (включительно); null-inclusive |

**null-inclusive**: Активности с `due_date = null` всегда включаются в результат при любом date-фильтре.

## Файловая структура (новые файлы)

```text
server/
├── controllers/
│   └── activitiesController.js    # CREATE
└── routes/
    └── activities.js              # CREATE
```

**Модификации существующих файлов**:

| Файл | Изменение |
|------|-----------|
| `server/app.js` | Подключить activitiesRouter |
| `server/routes/accounts.js` | GET /:id/activities |
| `server/routes/contacts.js` | GET /:id/activities |
| `server/routes/deals.js` | GET /:id/activities |
