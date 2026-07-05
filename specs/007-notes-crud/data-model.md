# Data Model: Заметки (Notes)

**Feature**: F-07 | **Branch**: `007-notes-crud`

---

## Таблица БД (существует с F-01)

### notes

| Колонка | Тип | Constraints |
|---------|-----|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| entity_type | ENUM(account/contact/deal) | NOT NULL |
| entity_id | UUID | NOT NULL (нет FK — полиморфная ассоциация) |
| content | TEXT | NOT NULL, непустой |
| author_id | UUID FK → users(id) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW(), триггер set_updated_at |

**Индекс**: `(entity_type, entity_id)` — создан в F-01

---

## Shapes — форматы ответов API

### Note Object (в ответе на create и list)

```json
{
  "id": "uuid",
  "content": "Обсудили условия контракта",
  "entity_type": "account",
  "entity_id": "uuid",
  "author": { "id": "uuid", "name": "Анастасия Стефанова" },
  "created_at": "2026-07-05T12:00:00.000Z",
  "updated_at": "2026-07-05T12:00:00.000Z"
}
```

### List Response (GET /accounts/:id/notes и аналоги)

```json
[
  {
    "id": "uuid",
    "content": "Звонок состоялся",
    "entity_type": "account",
    "entity_id": "uuid",
    "author": { "id": "uuid", "name": "Анастасия Стефанова" },
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-05T10:00:00.000Z"
  }
]
```

Формат: **простой массив** `[...]`, без envelope `{data, total, page, limit}` (clarification Q1).

---

## Валидационные правила

| Поле | Правило |
|------|---------|
| entity_type | Обязателен; должен быть из `['account','contact','deal']` (400 иначе) |
| entity_id | Обязателен; сущность должна существовать в соответствующей таблице (404 если нет) |
| content | Обязателен; trim; непустой (400 если пустой или отсутствует) |
| author_id | Устанавливается автоматически = req.user.id |

---

## Константы

```js
const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES      = { account: 'accounts', contact: 'contacts', deal: 'deals' };
```

---

## Контроль доступа (record-level)

| Операция | Кто может |
|----------|-----------|
| CREATE | admin, bdm |
| LIST | все авторизованные |
| UPDATE | автор заметки ИЛИ admin |
| DELETE | автор заметки ИЛИ admin |

Viewer → 403 на CREATE/UPDATE/DELETE (requireRole на уровне роута).
Non-author bdm → 403 на UPDATE/DELETE (inline author check в контроллере).
