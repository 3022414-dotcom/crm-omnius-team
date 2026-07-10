# Data Model: Фронтенд CRM

**Branch**: `011-crm-frontend` | **Date**: 2026-07-05

> Фронтенд не имеет собственной БД. Этот документ описывает формы данных из backend API и клиентские модели представления.

---

## Сессия пользователя (Auth State)

Источник: `GET /api/v1/users/me`

```ts
interface CurrentUser {
  id: string;          // UUID
  email: string;
  name: string;
  role: 'admin' | 'bdm' | 'viewer';
}
```

Хранится в Zustand store. Инициализируется при монтировании `<App>`. Null = неавторизован → редирект `/login`.

---

## Account (Аккаунт)

### Список (`GET /api/v1/accounts`)

```ts
interface AccountListItem {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  owner: { id: string; name: string } | null;
  created_at: string;   // ISO 8601
  updated_at: string;
}
```

### Детальная страница (`GET /api/v1/accounts/:id`)

Те же поля + вкладки подгружаются отдельными запросами:
- Contacts: `GET /api/v1/accounts/:id/contacts`
- Deals: `GET /api/v1/deals?account_id=:id`
- Notes: `GET /api/v1/accounts/:id/notes`
- Attachments: `GET /api/v1/accounts/:id/attachments`
- Activities: `GET /api/v1/accounts/:id/activities`

### Форма создания/редактирования

```ts
interface AccountFormData {
  name: string;          // required
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  owner_id?: string;     // UUID; admin/bdm выбирают из списка users
}
```

---

## Contact (Контакт)

### Список (`GET /api/v1/contacts`)

```ts
interface ContactListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  photo_path: string | null;  // относительный путь → абсолютный URL через /uploads/...
  account: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
}
```

### Форма

```ts
interface ContactFormData {
  first_name: string;    // required
  last_name: string;     // required
  email?: string;
  phone?: string;
  position?: string;
  account_id?: string;
  owner_id?: string;
}
```

---

## Deal (Сделка)

### Список (`GET /api/v1/deals`)

```ts
interface DealListItem {
  id: string;
  title: string;
  value: number | null;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  close_date: string | null;   // ISO 8601 date
  account: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  created_at: string;
}
```

Query params поддерживаемые бэкендом: `stage`, `account_id`, `owner_id`.

### Kanban (`GET /api/v1/deals/kanban`)

```ts
interface KanbanBoard {
  lead: KanbanCard[];
  qualified: KanbanCard[];
  proposal: KanbanCard[];
  negotiation: KanbanCard[];
  won: KanbanCard[];
  lost: KanbanCard[];
}

interface KanbanCard {
  id: string;
  title: string;
  value: number | null;
  account: { name: string } | null;
  owner: { id: string; name: string };
  close_date: string | null;
  contacts_count: number;
}
```

### Форма

```ts
interface DealFormData {
  title: string;         // required
  value?: number;
  stage: DealStage;      // required, default: 'lead'
  close_date?: string;
  account_id?: string;
  owner_id?: string;
}
```

---

## Note (Заметка)

Полиморфная — одна форма для account/contact/deal.

```ts
interface Note {
  id: string;
  content: string;
  entity_type: 'account' | 'contact' | 'deal';
  entity_id: string;
  author: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

interface NoteFormData {
  content: string;   // required
}
```

---

## Attachment (Вложение)

```ts
interface Attachment {
  id: string;
  file_name: string;
  file_path: string;    // → /uploads/... для скачивания
  file_size: number;
  mime_type: string;
  uploaded_by: { id: string; name: string };
  created_at: string;
}
```

Загрузка: `POST /api/v1/attachments` multipart/form-data с `entity_type`, `entity_id`, `file`.
Клиентская валидация до отправки: `file.size <= 50 * 1024 * 1024`.

---

## Activity (Активность)

```ts
interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task';
  entity_type: 'account' | 'contact' | 'deal';
  entity_id: string;
  description: string | null;
  due_date: string | null;    // ISO 8601
  completed: boolean;
  overdue: boolean;           // вычисляется бэкендом
  owner: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

interface ActivityFormData {
  type: ActivityType;         // required
  entity_type: EntityType;    // required (задаётся контекстом)
  entity_id: string;          // required (задаётся контекстом)
  description?: string;
  due_date?: string;
}
```

---

## Глобальный список активностей

Источник: `GET /api/v1/activities` (новый endpoint, добавляется в F-11)

Query params:
- `owner_id` — только для admin; bdm/viewer игнорируют (бэкенд автоматически фильтрует по req.user.id)
- `completed` — `true` / `false`
- `type` — call/email/meeting/task

Ответ: массив `Activity[]`, сортировка: `due_date ASC NULLS LAST, created_at DESC`.

---

## Клиентские состояния компонентов

### Theme Store (Zustand)

```ts
interface ThemeStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
```

Персистентность: `localStorage.setItem('theme', theme)`. Инициализация: читает `localStorage.theme` → fallback `matchMedia('(prefers-color-scheme: dark)')`.

### Auth Store (Zustand)

```ts
interface AuthStore {
  user: CurrentUser | null;
  setUser: (user: CurrentUser | null) => void;
}
```

---

## RBAC — правила видимости UI

| Элемент | admin | bdm | viewer |
|---------|-------|-----|--------|
| Кнопка «Создать» | ✅ | ✅ | ❌ |
| Кнопка «Редактировать» | ✅ | ✅ | ❌ |
| Кнопка «Удалить» | ✅ | ❌ | ❌ |
| Перетаскивание на Kanban | ✅ | ✅ | ❌ |
| Загрузка вложений/фото | ✅ | ✅ | ❌ |
| Фильтр по owner (глобал. активности) | ✅ | ❌ | ❌ |
