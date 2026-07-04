# Data Model: Аккаунты (Accounts)

**Feature**: F-04 Аккаунты | **Date**: 2026-07-04 | **Plan**: [plan.md](plan.md)

## Entity: Account

### Таблица: `accounts`

*(создана в F-01, не изменяется)*

| Поле | Тип PostgreSQL | Обязательное | Примечание |
|------|----------------|--------------|------------|
| id | UUID | ✅ PK | DEFAULT gen_random_uuid() |
| name | VARCHAR(255) | ✅ | Название компании |
| industry | VARCHAR(255) | — | Отрасль |
| website | VARCHAR(500) | — | URL сайта |
| phone | VARCHAR(50) | — | Телефон |
| address | TEXT | — | Адрес |
| notes | TEXT | — | Заметки о компании |
| owner_id | UUID FK → users | — | Создатель; ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | ✅ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | ✅ | DEFAULT NOW(); обновляется при PUT |

### Существующие индексы

- `idx_accounts_name` — на поле name (ускоряет ORDER BY name)
- `idx_accounts_owner_id` — на поле owner_id

### Связанные таблицы (из F-01)

| Таблица | Связь | Поведение при DELETE account |
|---------|-------|------------------------------|
| contacts | account_id FK → accounts | SET NULL (DB-level) |
| deals | account_id FK → accounts | SET NULL (DB-level) → app переопределяет: явный DELETE |
| notes | entity_type='account', entity_id=UUID | Нет FK → app-level DELETE |
| attachments | entity_type='account', entity_id=UUID | Нет FK → app-level DELETE |
| activities | entity_type='account', entity_id=UUID | Нет FK → app-level DELETE |

## API Response Shapes

### Account Object (GET /accounts, GET /accounts/:id)

Включает `contactsCount` и `dealsCount`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Рога и Копыта ООО",
  "industry": "Консалтинг",
  "website": "https://rogaikopyta.ru",
  "phone": "+7 (495) 123-45-67",
  "address": "Москва, ул. Пушкина, д. 1",
  "notes": "Ключевой клиент с 2024 года",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-07-04T10:00:00.000Z",
  "updated_at": "2026-07-04T10:00:00.000Z",
  "contactsCount": 3,
  "dealsCount": 2
}
```

### Account Object (POST response, PUT response)

НЕ включает `contactsCount` и `dealsCount` — только поля таблицы:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Рога и Копыта ООО",
  "industry": "Консалтинг",
  "website": "https://rogaikopyta.ru",
  "phone": "+7 (495) 123-45-67",
  "address": "Москва, ул. Пушкина, д. 1",
  "notes": "Ключевой клиент с 2024 года",
  "owner_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-07-04T10:00:00.000Z",
  "updated_at": "2026-07-04T10:00:00.000Z"
}
```

### Pagination Envelope (GET /accounts)

```json
{
  "data": [ /* Account Object[], каждый с contactsCount и dealsCount */ ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

## Validation Rules

| Поле | POST | PUT |
|------|------|-----|
| name | Обязательно; непустая строка после trim | Если передан — непустая строка после trim |
| industry | Опционально | Если передан — любая строка (в т.ч. пустая допустима) |
| website | Опционально | Если передан — любая строка |
| phone | Опционально | Если передан — любая строка |
| address | Опционально | Если передан — любая строка |
| notes | Опционально | Если передан — любая строка |
| owner_id | Игнорируется из тела; устанавливается = req.user.id | Игнорируется |

## Pagination Parameters

| Параметр | Default | Min | Max | Поведение при нарушении |
|----------|---------|-----|-----|------------------------|
| page | 1 | 1 | — | < 1 → применяется как 1 |
| limit | 20 | 1 | 100 | > 100 → применяется как 100 |
| search | '' | — | — | Пустая строка → полный список |
