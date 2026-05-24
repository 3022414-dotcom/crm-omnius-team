# Data Model: F-01 Схема данных и миграции

**Phase 1 output** | Date: 2026-05-24

## ENUM Types

```sql
user_role:     admin | bdm | viewer
deal_stage:    lead | qualified | proposal | negotiation | won | lost
entity_type:   account | contact | deal
activity_type: call | email | meeting | task
```

---

## Tables

### users
Участники команды omnius.team. Доступ только для pre-approved пользователей.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| name | VARCHAR(255) | NOT NULL |
| role | user_role | NOT NULL |
| google_id | VARCHAR(255) | UNIQUE, NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Triggers**: `set_updated_at` BEFORE UPDATE

---

### accounts
Компании — клиенты и потенциальные клиенты.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | VARCHAR(255) | NOT NULL |
| industry | VARCHAR(255) | NULLABLE |
| website | VARCHAR(500) | NULLABLE |
| phone | VARCHAR(50) | NULLABLE |
| address | TEXT | NULLABLE |
| notes | TEXT | NULLABLE |
| owner_id | UUID | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Triggers**: `set_updated_at` BEFORE UPDATE

**Indexes**:
- `idx_accounts_owner_id` ON (owner_id)
- `idx_accounts_name` ON (name) — для поиска

---

### contacts
Контактные лица, привязанные к компаниям.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| first_name | VARCHAR(255) | NOT NULL |
| last_name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NULLABLE (не уникален) |
| phone | VARCHAR(50) | NULLABLE |
| position | VARCHAR(255) | NULLABLE |
| photo_path | VARCHAR(500) | NULLABLE — путь к файлу аватара |
| account_id | UUID | NULLABLE, FK → accounts(id) ON DELETE SET NULL |
| owner_id | UUID | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Triggers**: `set_updated_at` BEFORE UPDATE

**Indexes**:
- `idx_contacts_account_id` ON (account_id)
- `idx_contacts_owner_id` ON (owner_id)
- `idx_contacts_email` ON (email) — для поиска (не уникален)
- `idx_contacts_name` ON (first_name, last_name) — для поиска

---

### deals
Сделки. Этап воронки (deal_stage). Аккаунт необязателен.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| title | VARCHAR(500) | NOT NULL |
| value | DECIMAL(15,2) | NULLABLE |
| stage | deal_stage | NOT NULL, DEFAULT 'lead' |
| close_date | DATE | NULLABLE |
| account_id | UUID | NULLABLE, FK → accounts(id) ON DELETE SET NULL |
| owner_id | UUID | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Triggers**: `set_updated_at` BEFORE UPDATE

**Indexes**:
- `idx_deals_account_id` ON (account_id)
- `idx_deals_owner_id` ON (owner_id)
- `idx_deals_stage` ON (stage)

---

### deal_contacts
Связь M:N между Сделками и Контактами.

| Column | Type | Constraints |
|--------|------|-------------|
| deal_id | UUID | NOT NULL, FK → deals(id) ON DELETE CASCADE |
| contact_id | UUID | NOT NULL, FK → contacts(id) ON DELETE CASCADE |

**Primary Key**: (deal_id, contact_id) — составной

**Indexes**:
- `idx_deal_contacts_contact_id` ON (contact_id) — для обратного поиска

---

### notes
Текстовые заметки к любой из трёх сущностей (полиморфная ассоциация).

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| entity_type | entity_type | NOT NULL |
| entity_id | UUID | NOT NULL |
| content | TEXT | NOT NULL |
| author_id | UUID | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Triggers**: `set_updated_at` BEFORE UPDATE

**Note**: Нет FK-constraint на entity_id (полиморфизм). Каскадное удаление обеспечивается приложением.

**Indexes**:
- `idx_notes_entity` ON (entity_type, entity_id) — основной путь выборки
- `idx_notes_author_id` ON (author_id)

---

### attachments
Файловые вложения к любой из трёх сущностей (полиморфная ассоциация).

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| entity_type | entity_type | NOT NULL |
| entity_id | UUID | NOT NULL |
| file_name | VARCHAR(500) | NOT NULL |
| file_path | VARCHAR(1000) | NOT NULL |
| file_size | INTEGER | NULLABLE (байты) |
| mime_type | VARCHAR(255) | NULLABLE |
| uploaded_by | UUID | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Note**: Нет `updated_at` (вложения не редактируются). Нет FK на entity_id (полиморфизм).

**Note**: `contacts.photo_path` — ОТДЕЛЬНЫЙ атрибут. Фото контакта НЕ хранится в этой таблице.

**Indexes**:
- `idx_attachments_entity` ON (entity_type, entity_id)
- `idx_attachments_uploaded_by` ON (uploaded_by)

---

### activities
Задачи и события (звонки, встречи, письма).

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| type | activity_type | NOT NULL |
| entity_type | entity_type | NOT NULL |
| entity_id | UUID | NOT NULL |
| description | TEXT | NULLABLE |
| due_date | TIMESTAMPTZ | NULLABLE |
| completed | BOOLEAN | NOT NULL, DEFAULT FALSE |
| owner_id | UUID | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Triggers**: `set_updated_at` BEFORE UPDATE

**Indexes**:
- `idx_activities_entity` ON (entity_type, entity_id)
- `idx_activities_owner_id` ON (owner_id)
- `idx_activities_due_date` ON (due_date) — для выборки предстоящих

---

### session
Таблица сессий для connect-pg-simple.

| Column | Type | Constraints |
|--------|------|-------------|
| sid | VARCHAR | PK NOT DEFERRABLE INITIALLY IMMEDIATE |
| sess | JSON | NOT NULL |
| expire | TIMESTAMP(6) | NOT NULL |

**Note**: Управляется библиотекой express-session + connect-pg-simple. Приложение не обращается к ней напрямую.

**Indexes**:
- `IDX_session_expire` ON (expire) — рекомендован connect-pg-simple для TTL-очистки

---

## Relationships Diagram

```
users ←──────────── accounts (owner_id)
  │                      │
  │                      │ SET NULL
  │                      ↓
  ├──────────────── contacts (owner_id, account_id → accounts)
  │                      │
  │                      │ CASCADE via deal_contacts
  │                      ↓
  └──────────────── deals (owner_id, account_id → accounts SET NULL)
                         │
                    deal_contacts (M:N)

notes ──→ entity_type + entity_id (account | contact | deal)
attachments ──→ entity_type + entity_id (account | contact | deal)
activities ──→ entity_type + entity_id (account | contact | deal)
```

## Trigger Function

```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Применяется к: `users`, `accounts`, `contacts`, `deals`, `notes`, `activities`
