# Data Model: Контакты (Contacts)

**Feature**: F-05 Контакты | **Date**: 2026-07-04 | **Plan**: [plan.md](plan.md)

## Entity: Contact

### Таблица: `contacts`

*(создана в F-01, не изменяется)*

| Поле | Тип PostgreSQL | Обязательное | Примечание |
|------|----------------|--------------|------------|
| id | UUID | ✅ PK | DEFAULT gen_random_uuid() |
| first_name | VARCHAR(255) | ✅ | Имя |
| last_name | VARCHAR(255) | ✅ | Фамилия |
| email | VARCHAR(255) | — | Email |
| phone | VARCHAR(50) | — | Телефон |
| position | VARCHAR(255) | — | Должность |
| photo_path | VARCHAR(500) | — | Путь к файлу фото (nullable) |
| account_id | UUID FK → accounts | — | ON DELETE SET NULL (nullable) |
| owner_id | UUID FK → users | ✅ | ON DELETE RESTRICT; автоназначается |
| created_at | TIMESTAMPTZ | ✅ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | ✅ | DEFAULT NOW(); обновляется триггером |

### Таблица: `deal_contacts` (F-01, не изменяется)

| Поле | Тип | Примечание |
|------|-----|------------|
| deal_id | UUID FK → deals | ON DELETE CASCADE |
| contact_id | UUID FK → contacts | ON DELETE CASCADE |
| PK | (deal_id, contact_id) | |

При удалении контакта: все записи в deal_contacts удаляются автоматически (DB CASCADE).

### Файловое хранилище

```
uploads/
└── contacts/
    └── {contact_id}/      ← UUID контакта
        └── avatar_{uuid}.ext  ← uuid = crypto.randomUUID(); ext = jpg/png/webp
```

- Один файл на контакт (при замене старый удаляется)
- photo_path хранит относительный путь: `uploads/contacts/{id}/avatar_{uuid}.ext`
- URL для API: `/{photo_path}` (например, `/uploads/contacts/abc.../avatar_xyz.jpg`)

## API Response Shapes

### Contact Object (все GET-ответы)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "first_name": "Иван",
  "last_name": "Иванов",
  "email": "ivan@example.com",
  "phone": "+7 (495) 123-45-67",
  "position": "Директор по развитию",
  "photo_path": "uploads/contacts/550e8400.../avatar_abc123.jpg",
  "account_id": "660e8400-e29b-41d4-a716-446655440001",
  "owner_id": "770e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-07-04T10:00:00.000Z",
  "updated_at": "2026-07-04T10:00:00.000Z"
}
```

`photo_path` = null если фото не загружено.

### Contact Object (POST response, PUT response)

Идентично GET — возвращает все поля таблицы contacts. POST/PUT НЕ включают дополнительные производные поля.

### Pagination Envelope (GET /contacts, GET /accounts/:id/contacts)

```json
{
  "data": [ /* Contact Object[] */ ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

### Photo Upload Response (POST /contacts/:id/photo)

```json
{
  "photo_url": "/uploads/contacts/550e8400.../avatar_abc123.jpg"
}
```

## Validation Rules

| Поле | POST | PUT |
|------|------|-----|
| first_name | Обязательно; непустая строка после trim | Если передан — непустая строка |
| last_name | Обязательно; непустая строка после trim | Если передан — непустая строка |
| email | Опционально | Если передан — любая строка |
| phone | Опционально | Если передан — любая строка |
| position | Опционально | Если передан — любая строка |
| account_id | Опционально; если передан — SELECT проверка (400 если не найден) | Если передан — SELECT проверка; null = отвязка |
| owner_id | Игнорируется из тела; = req.user.id | Игнорируется |
| photo_path | Игнорируется из тела | Игнорируется |

## Pagination Parameters

| Параметр | Default | Min | Max | Поведение при нарушении |
|----------|---------|-----|-----|------------------------|
| page | 1 | 1 | — | < 1 → применяется как 1 |
| limit | 20 | 1 | 100 | > 100 → применяется как 100 |
| search | '' | — | — | Пустая строка → полный список |
