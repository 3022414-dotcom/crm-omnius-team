# API Contracts: Consumed by Frontend

**Branch**: `011-crm-frontend` | **Date**: 2026-07-05

> Фронтенд потребляет существующие backend API (F-04–F-10) + 1 новый endpoint (FR-012). Все маршруты с префиксом `/api/v1/` требуют активной сессии (cookie); иначе → 401.

---

## Auth

| Method | Path | Description | Auth required |
|--------|------|-------------|---------------|
| GET | `/auth/google` | Старт OAuth flow | No |
| GET | `/auth/google/callback` | OAuth callback (backend only) | No |
| GET | `/auth/logout` | Завершить сессию | Yes |
| GET | `/api/v1/users/me` | Текущий пользователь | Yes |

**Важно**: login/logout — `window.location.href`, не fetch (требуют редиректа).

---

## Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users` | Список пользователей (для выбора owner в формах) |
| GET | `/api/v1/users/me` | Текущий пользователь |

---

## Accounts

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/accounts` | all | Список; query: `search`, `owner_id` |
| GET | `/api/v1/accounts/:id` | all | Детальная страница |
| POST | `/api/v1/accounts` | admin, bdm | Создать |
| PUT | `/api/v1/accounts/:id` | admin, bdm | Обновить |
| DELETE | `/api/v1/accounts/:id` | admin | Удалить |
| GET | `/api/v1/accounts/:id/contacts` | all | Контакты аккаунта |
| GET | `/api/v1/accounts/:id/notes` | all | Заметки |
| GET | `/api/v1/accounts/:id/attachments` | all | Вложения |
| GET | `/api/v1/accounts/:id/activities` | all | Активности |

---

## Contacts

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/contacts` | all | Список; query: `search`, `account_id` |
| GET | `/api/v1/contacts/:id` | all | Детальная |
| POST | `/api/v1/contacts` | admin, bdm | Создать |
| PUT | `/api/v1/contacts/:id` | admin, bdm | Обновить |
| DELETE | `/api/v1/contacts/:id` | admin | Удалить |
| POST | `/api/v1/contacts/:id/photo` | admin, bdm | Загрузить фото (multipart) |
| DELETE | `/api/v1/contacts/:id/photo` | admin | Удалить фото |
| GET | `/api/v1/contacts/:id/notes` | all | Заметки |
| GET | `/api/v1/contacts/:id/attachments` | all | Вложения |
| GET | `/api/v1/contacts/:id/activities` | all | Активности |

**Клиентская валидация фото**: `file.size <= 5 * 1024 * 1024` И `file.type.startsWith('image/')`.

---

## Deals

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/deals` | all | Список; query: `stage`, `account_id`, `owner_id` |
| GET | `/api/v1/deals/kanban` | all | Kanban-доска; query: `owner_id` |
| GET | `/api/v1/deals/:id` | all | Детальная |
| POST | `/api/v1/deals` | admin, bdm | Создать |
| PUT | `/api/v1/deals/:id` | admin, bdm | Обновить |
| PATCH | `/api/v1/deals/:id/stage` | admin, bdm | Обновить стадию (Kanban drag) |
| DELETE | `/api/v1/deals/:id` | admin | Удалить |
| POST | `/api/v1/deals/:id/contacts` | admin, bdm | Привязать контакт |
| DELETE | `/api/v1/deals/:id/contacts/:contact_id` | admin, bdm | Отвязать контакт |
| GET | `/api/v1/deals/:id/notes` | all | Заметки |
| GET | `/api/v1/deals/:id/attachments` | all | Вложения |
| GET | `/api/v1/deals/:id/activities` | all | Активности |

---

## Notes

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/notes` | admin, bdm | Создать; body: `{entity_type, entity_id, content}` |
| PUT | `/api/v1/notes/:id` | admin, bdm | Обновить |
| DELETE | `/api/v1/notes/:id` | admin | Удалить |

---

## Attachments

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/attachments` | admin, bdm | Загрузить (multipart/form-data) |
| GET | `/api/v1/attachments/:id/download` | all | Скачать файл |
| DELETE | `/api/v1/attachments/:id` | admin | Удалить |

**Клиентская валидация**: `file.size <= 50 * 1024 * 1024`.

---

## Activities (entity-scoped)

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/activities` | admin, bdm | Создать |
| PUT | `/api/v1/activities/:id` | admin, bdm | Обновить |
| DELETE | `/api/v1/activities/:id` | admin | Удалить |

---

## Activities (global) — НОВЫЙ ENDPOINT (добавляется в F-11)

| Method | Path | Auth scope | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/activities` | all | Глобальный список |

**Query params**:

| Param | Type | Description |
|-------|------|-------------|
| `owner_id` | UUID | Только для admin; bdm/viewer игнорируют — автофильтр по req.user.id |
| `completed` | boolean | `true` / `false` |
| `type` | string | `call` / `email` / `meeting` / `task` |

**Response** (массив):
```json
[
  {
    "id": "uuid",
    "type": "call",
    "entity_type": "deal",
    "entity_id": "uuid",
    "description": "...",
    "due_date": "2026-07-10T10:00:00Z",
    "completed": false,
    "overdue": true,
    "owner": { "id": "uuid", "name": "Анастасия" },
    "created_at": "...",
    "updated_at": "..."
  }
]
```

**Backend implementation** (добавить в activitiesController.js):
```js
async function listActivities(req, res) {
  const isAdmin = req.user.role === 'admin';
  const owner_id = isAdmin ? (req.query.owner_id || null) : req.user.id;
  // WHERE ($1::uuid IS NULL OR a.owner_id = $1)
  // + filters: completed, type
  // ORDER BY due_date ASC NULLS LAST, created_at DESC
}
```

**Route** (добавить в server/routes/activities.js):
```js
router.get('/', listActivities);  // BEFORE /:id
```
