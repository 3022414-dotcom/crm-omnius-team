# Implementation Plan: Entity Field Fixes — Deal, Contact, Account

**Branch**: `015-entity-fields-fix` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Привести поля карточек Deal/Account/Contact в соответствие с ТЗ: Our Services (7 значений), Deal Owner (dropdown с пользователями), Created By + Created Date (read-only), Amount (пробел как разделитель тысяч), порядок полей Deal, Created By в Account и Contact.

## Summary

Фиксируем несоответствия UI и данных в карточках трёх сущностей. Большинство изменений — чистый фронтенд (константы, порядок полей, форматирование). Единственное бэкенд-изменение — добавление колонки `created_by_id` в три таблицы (одна миграция) + расширение GET-ответов + снятие ограничения admin с `GET /api/v1/users`. Никаких новых npm-пакетов, никаких новых маршрутов.

## Technical Context

**Language/Version**: Node.js LTS (backend), React 18 + Vite (frontend)

**Primary Dependencies**: Express, pg (node-postgres), node-pg-migrate, React Query, Intl.NumberFormat (browser built-in)

**Storage**: PostgreSQL 15+ — три таблицы: deals, accounts, contacts

**Testing**: Ручное тестирование по quickstart.md

**Target Platform**: Внутренний веб-сервис, Docker

**Project Type**: Web-service (REST API + SPA)

**Performance Goals**: N/A — внутренний инструмент на 4 пользователя

**Constraints**: Без новых npm-пакетов; форматирование только на фронтенде; один файл миграции

**Scale/Scope**: 4 пользователя, ~100 записей в каждой таблице

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Обоснование |
|---------|--------|-------------|
| Простота прежде всего | ✅ PASS | Нет новых пакетов, нет новых маршрутов, минимальная миграция |
| Spec-First | ✅ PASS | Workflow: specify → clarify → plan → tasks → implement |
| YAGNI | ✅ PASS | Только то, что в spec.md. Никакого over-engineering |
| Stack (Node/Express/PG) | ✅ PASS | Используем существующий стек без изменений |
| DB conventions (UUID FK, TIMESTAMPTZ) | ✅ PASS | `created_by_id UUID REFERENCES users(id) ON DELETE SET NULL` |
| React + Vite (frontend) | ✅ PASS | Изменяем только существующие JSX-файлы |
| Нет новых npm-пакетов | ✅ PASS | Форматирование через `Intl.NumberFormat` (browser built-in) |

**Post-design Constitution Re-check**: Пройдёт — добавляем колонку через node-pg-migrate (соответствует соглашению), FK с ON DELETE SET NULL (соответствует каскадной политике constitution).

## Phase 0: Research

Все технические решения известны из анализа кода. NEEDS CLARIFICATION отсутствуют.

**Результаты:**

### Decision 1: Формат колонки created_by_id
- **Решение**: `created_by_id UUID REFERENCES users(id) ON DELETE SET NULL`
- **Обоснование**: Поведение при удалении пользователя — SET NULL (не CASCADE), чтобы историческая запись не исчезала. Показываем «—» при NULL. Соответствует конституции (ON DELETE SET NULL).
- **Альтернативы**: ON DELETE RESTRICT — отклонён (заблокировал бы удаление пользователей).

### Decision 2: Форматирование Amount
- **Решение**: Изменить `formatAmount` в `client/src/lib/date.js` с `style: 'currency'` на `style: 'decimal'`. Локаль `ru-RU` даёт пробел как разделитель тысяч: `5 000 000`.
- **Обоснование**: `Intl.NumberFormat` — браузерный built-in, не нужен новый пакет. Локаль `ru-RU` с `style: 'decimal'` даёт именно пробел (неразрывный), что соответствует ТЗ.
- **Альтернативы**: Ручной regex — отклонён (лишняя сложность при наличии Intl API).
- **Осторожность**: `formatAmount` используется в AccountDetailPage и ContactDetailPage в таблицах сделок. После изменения — отображение без знака ₽, только число. Это корректно, т.к. Currency — отдельное поле.

### Decision 3: Снятие ограничения admin с GET /api/v1/users
- **Решение**: Убрать `requireRole(['admin'])` из `router.get('/', ...)` в `server/routes/users.js`. Эндпоинт защищён глобальным `requireAuth` (все маршруты под `/api/v1/` уже требуют аутентификации через `app.use`).
- **Обоснование**: AccountDetailPage уже использует `getUsers` для Account Manager dropdown — т.е. bdm не мог видеть список пользователей. Это баг, Q1 clarify подтвердил открытие для всех authenticated.
- **Альтернативы**: Отдельный эндпоинт — отклонён (YAGNI, дублирование).

### Decision 4: created_by в GET-ответах
- **Решение**: Добавить LEFT JOIN users cb ON x.created_by_id = cb.id в SELECT в getDealById, getAccountById, getContactById. Вернуть `created_by: { id, name } | null`.
- **Обоснование**: Фронтенд читает created_by?.name. LEFT JOIN обеспечивает корректную обработку NULL (новые и старые записи).
- **Альтернативы**: Отдельный запрос — отклонён (дополнительный roundtrip не нужен).

### Decision 5: Deal Owner в DealDetailPage
- **Решение**: Добавить `useQuery(['users'], getUsers)` — по аналогии с AccountDetailPage. Показывать Deal Owner через InlineField type="select" с optionObjects из списка users. Поле уже записывается через `owner_id` в UPDATABLE_FIELDS backend-контроллера.
- **Обоснование**: Паттерн уже реализован в AccountDetailPage (Account Manager). Копируем структуру.

### Decision 6: Label "Amount" vs "Value"
- **Решение**: Переименовать `label="Value"` → `label="Amount"`. DB-колонка остаётся `value` (нет смысла менять схему ради label).
- **Обоснование**: Spec называет поле Amount. Frontend label независим от column name.

## Project Structure

### Documentation (this feature)

```text
specs/015-entity-fields-fix/
├── plan.md              # This file
├── research.md          # Integrated above (Phase 0)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code — файлы, которые изменяются

```text
Backend (5 изменений):
server/
  migrations/
    1783814400000_f15_entity_fields_fix.js  ← NEW: created_by_id в deals/accounts/contacts
  routes/
    users.js                                 ← MODIFY: снять requireRole(['admin']) с GET /
  controllers/
    dealsController.js                       ← MODIFY: INSERT created_by_id, JOIN в GET
    accountsController.js                    ← MODIFY: INSERT created_by_id, JOIN в GET
    contactsController.js                    ← MODIFY: INSERT created_by_id, JOIN в GET

Frontend (4 изменения):
client/src/
  lib/
    date.js                                  ← MODIFY: formatAmount → decimal style
  pages/
    deals/DealDetailPage.jsx                 ← MODIFY: OUR_SERVICES, порядок полей, Owner, Created By/Date, Amount
    accounts/AccountDetailPage.jsx           ← MODIFY: добавить поле Created By (read-only)
    contacts/ContactDetailPage.jsx           ← MODIFY: добавить поле Created By (read-only)
```

**Итого: 9 файлов, 1 новый (миграция), 8 модифицированных.**

## Data Model Changes

### Migration: 1783814400000_f15_entity_fields_fix.js

```sql
-- up
ALTER TABLE deals    ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE accounts ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_created_by_id    ON deals(created_by_id);
CREATE INDEX IF NOT EXISTS idx_accounts_created_by_id ON accounts(created_by_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by_id ON contacts(created_by_id);

-- down
DROP INDEX IF EXISTS idx_deals_created_by_id;
DROP INDEX IF EXISTS idx_accounts_created_by_id;
DROP INDEX IF EXISTS idx_contacts_created_by_id;

ALTER TABLE deals    DROP COLUMN IF EXISTS created_by_id;
ALTER TABLE accounts DROP COLUMN IF EXISTS created_by_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS created_by_id;
```

### Backend API changes (non-breaking)

**GET /api/v1/deals/:id** — добавляется поле `created_by`:
```json
{
  "created_by": { "id": "uuid", "name": "Юлия Шевцова" }
}
```
При NULL (старые записи): `"created_by": null`

**GET /api/v1/accounts/:id** — аналогично  
**GET /api/v1/contacts/:id** — аналогично

**GET /api/v1/users** — убирается ограничение `admin`-only, доступно всем authenticated.

### Frontend field changes

**DealDetailPage.jsx** — новый порядок полей в leftPanel:
```
Deal Name → Stage → Account → Location → Deal Type → Source → Project Domain
→ Description → Our Services → Amount → Currency → Deal Storage
→ Deal Owner → Created By (RO) → Created Date (RO)
→ Expected Start Date → Close Date → Lost Reason (conditional)
```

**OUR_SERVICES** константа меняется с:
```js
['AI Consulting', 'AI Outsource', 'AI Outstaff', 'AI Course', 'AI Product']
```
на:
```js
['Workshop', 'Webinar', 'Consulting', 'POC', 'Development', 'Accelerator', 'Performance']
```

**formatAmount** (date.js) меняется с currency на decimal:
```js
// было
new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
// стало
new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 })
```
Результат: `5 000 000` вместо `5 000 000 ₽`.

## Complexity Tracking

Нет нарушений конституции — таблица не требуется.
