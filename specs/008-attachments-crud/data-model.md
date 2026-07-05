# Data Model: Вложения (Attachments)

**Feature**: F-08 | **Branch**: `008-attachments-crud`

---

## Таблица БД (существует с F-01)

### attachments

| Колонка | Тип | Constraints |
|---------|-----|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() |
| entity_type | ENUM(account/contact/deal) | NOT NULL |
| entity_id | UUID | NOT NULL (нет FK — полиморфная ассоциация) |
| file_name | VARCHAR | NOT NULL — оригинальное имя файла |
| file_path | VARCHAR | NOT NULL — относительный путь от корня проекта |
| file_size | INTEGER | NOT NULL — размер в байтах |
| mime_type | VARCHAR | NOT NULL |
| uploaded_by | UUID FK → users(id) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Нет updated_at**: файл нельзя изменить, только удалить и загрузить заново.

**Индекс**: `(entity_type, entity_id)` — создан в F-01

---

## Хранение файлов

### Путь на диске

```
uploads/{entity_type}s/{entity_id}/{uuid}_{original_name}
```

**Примеры**:
- `uploads/accounts/550e8400-.../abc123_договор.pdf`
- `uploads/contacts/6ba7b810-.../def456_фото_CV.docx`
- `uploads/deals/6ba7b811-.../ghi789_КП.xlsx`

`file_path` в БД хранится как **относительный путь от корня проекта** (без лидирующего `/`). При download формируется абсолютный путь: `path.join(__dirname, '../../', att.file_path)`.

### Лимит размера

50 MB = 52 428 800 байт (проверяется multer до записи на диск).

---

## API Response Shape

### Attachment Object (в ответах create, list)

```json
{
  "id": "uuid",
  "file_name": "договор_с_клиентом.pdf",
  "file_size": 204800,
  "mime_type": "application/pdf",
  "entity_type": "account",
  "entity_id": "uuid",
  "uploaded_by": { "id": "uuid", "name": "Анастасия Стефанова" },
  "created_at": "2026-07-05T14:00:00.000Z"
}
```

**Примечание**: `file_path` в API-ответ **не включается** (internal field, clarification Q1).

### List Response (GET /accounts/:id/attachments и аналоги)

```json
[
  {
    "id": "uuid",
    "file_name": "договор.pdf",
    "file_size": 204800,
    "mime_type": "application/pdf",
    "entity_type": "account",
    "entity_id": "uuid",
    "uploaded_by": { "id": "uuid", "name": "Анастасия Стефанова" },
    "created_at": "2026-07-05T14:00:00.000Z"
  }
]
```

Формат: **простой массив** `[...]`, sorted by created_at DESC, без пагинации.

---

## Константы

```js
const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES      = { account: 'accounts', contact: 'contacts', deal: 'deals' };
const ENTITY_DIRS        = { account: 'accounts', contact: 'contacts', deal: 'deals' };
```

---

## Контроль доступа

| Операция | Кто может |
|----------|-----------|
| UPLOAD | admin, bdm |
| LIST | все авторизованные |
| DOWNLOAD | все авторизованные |
| DELETE | только admin |

- Нет record-level access — удаление строго по роли (в отличие от F-07 notes)
- Viewer → 403 на UPLOAD и DELETE (requireRole на уровне роута)

---

## Каскадное удаление

При удалении аккаунта / контакта / сделки:
1. SELECT file_path FROM attachments WHERE entity_type=X AND entity_id=Y
2. fs.unlinkSync для каждого файла (silent fail если файл уже отсутствует)
3. DELETE FROM attachments WHERE entity_type=X AND entity_id=Y
4. Продолжить удаление notes, activities, самой сущности

Реализуется в: `accountsController.js`, `contactsController.js`, `dealsController.js` (модификация).
