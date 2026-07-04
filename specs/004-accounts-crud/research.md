# Research: Аккаунты (Accounts)

**Feature**: F-04 Аккаунты | **Date**: 2026-07-04 | **Plan**: [plan.md](plan.md)

## Design Decisions

### D-01: Частичное обновление (Partial Update via Dynamic SET)

**Decision**: Динамический SET-clause через сборку массивов полей и параметров.

**Rationale**: `PUT /accounts/:id` с partial update семантикой — только переданные поля обновляются. Нет `PATCH` в REST смысле (требует JSON Patch RFC), нет полного замещения (риск затереть данные). Динамический подход: собираем массив `"field = $N"` только для пришедших полей и выполняем один UPDATE-запрос.

**Implementation Pattern**:
```js
const UPDATABLE_FIELDS = ['name', 'industry', 'website', 'phone', 'address', 'notes'];
const updates = [];
const values = [];
let idx = 1;
for (const field of UPDATABLE_FIELDS) {
  if (field in body) {
    updates.push(`${field} = $${idx++}`);
    values.push(body[field]);
  }
}
if (updates.length === 0) {
  // No fields to update — return current record unchanged
}
updates.push(`updated_at = NOW()`);
values.push(id); // last param for WHERE
const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING ...`;
```

**Alternatives considered**:
- PATCH с JSON Patch (RFC 6902) — избыточно для внутреннего инструмента
- Полная замена всех полей — риск случайного затирания; не соответствует UX спеки

---

### D-02: contactsCount и dealsCount через субзапросы

**Decision**: Субзапросы в SELECT (не JOIN + GROUP BY, не отдельные запросы).

**Rationale**: Для внутреннего инструмента с небольшим объёмом данных субзапросы читабельны и достаточно эффективны. Индексы idx_contacts_account_id и idx_deals_account_id обеспечат быстрое COUNT.

**Implementation Pattern**:
```sql
SELECT
  a.id, a.name, a.industry, a.website, a.phone, a.address, a.notes,
  a.owner_id, a.created_at, a.updated_at,
  (SELECT COUNT(*) FROM contacts WHERE account_id = a.id) AS "contactsCount",
  (SELECT COUNT(*) FROM deals WHERE account_id = a.id) AS "dealsCount"
FROM accounts a
WHERE ...
ORDER BY a.created_at DESC
LIMIT $1 OFFSET $2
```

**Alternatives considered**:
- LEFT JOIN + GROUP BY — сложнее читать, требует GROUP BY всех полей
- Отдельные SELECT COUNT(*) запросы — N+1 проблема (недопустимо для списка)
- `COUNT(*) OVER()` window function — не применимо для разных таблиц

**Note**: При создании (POST) и обновлении (PUT) счётчики НЕ включаются в ответ согласно спеке. Ответ POST/PUT возвращает только поля таблицы accounts.

---

### D-03: Поиск без учёта регистра (ILIKE)

**Decision**: `WHERE a.name ILIKE $N` с паттерном `'%' || $1 || '%'`.

**Rationale**: PostgreSQL `ILIKE` — встроенный оператор case-insensitive LIKE. Для MVP без нагрузки триграммные индексы не нужны. Существующий индекс `idx_accounts_name` не используется при ILIKE (нужен специальный `pg_trgm`), но это приемлемо для 4 пользователей и сотен записей.

**Implementation Pattern**:
```sql
-- С поиском:
WHERE ($1 = '' OR a.name ILIKE '%' || $1 || '%')
-- Или условно (лучше для индексов в будущем):
-- Если search пустой — не добавляем WHERE clause
```

**Alternatives considered**:
- `LOWER(name) LIKE LOWER($1)` — работает, но ILIKE нативнее в PostgreSQL
- Full-text search (tsvector) — избыточно для MVP
- pg_trgm с GIN-индексом — в бэклоге, не нужен при малом объёме

---

### D-04: Пагинация через LIMIT/OFFSET + отдельный COUNT

**Decision**: Два запроса: один `SELECT ... LIMIT $1 OFFSET $2` + один `SELECT COUNT(*)`. Envelope: `{ data, total, page, limit }`.

**Rationale**: `COUNT(*) OVER()` window function в одном запросе проще, но конфликтует с субзапросами `contactsCount`/`dealsCount` — смешение `COUNT(*) OVER()` и коррелированных подзапросов усложняет SQL. Два запроса — читабельнее, разница незначительна при малом объёме.

**Implementation Pattern**:
```js
// Query 1: data
const { rows } = await pool.query(
  `SELECT a.*, (SELECT COUNT(*) FROM contacts WHERE account_id = a.id) AS "contactsCount",
   (SELECT COUNT(*) FROM deals WHERE account_id = a.id) AS "dealsCount"
   FROM accounts a WHERE ($3 = '' OR a.name ILIKE '%' || $3 || '%')
   ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
  [limit, offset, search]
);
// Query 2: total
const { rows: countRows } = await pool.query(
  `SELECT COUNT(*)::int AS total FROM accounts WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')`,
  [search]
);
const total = countRows[0].total;
res.json({ data: rows, total, page, limit });
```

**Parameter defaults**: page=1 (min 1), limit=20 (default), limit cap=100. Если page < 1 → page=1. Если limit > 100 → limit=100.

**Alternatives considered**:
- Cursor-based pagination — избыточно для MVP
- `COUNT(*) OVER()` — смешивается неудобно с subquery-счётчиками

---

### D-05: Каскадное удаление на уровне приложения

**Decision**: При удалении аккаунта контроллер выполняет DELETE в правильном порядке внутри транзакции.

**Rationale**: Схема БД имеет:
- `contacts.account_id → ON DELETE SET NULL` (DB-level, автоматически)
- `deals.account_id → ON DELETE SET NULL` (DB-level, но спека требует DELETE сделок)
- notes/attachments/activities — полиморфные (entity_type + entity_id), без FK → только app-level

Поскольку `deals.account_id → SET NULL` в миграции (не CASCADE), но спека требует удалять сделки — нужен явный DELETE FROM deals в контроллере ПЕРЕД удалением аккаунта. Иначе при удалении аккаунта deals.account_id обнулится, но сами сделки останутся (нарушение FR-008).

**Cascade Order** (внутри транзакции):
1. `DELETE FROM activities WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $id)`
2. `DELETE FROM attachments WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $id)`
3. `DELETE FROM notes WHERE entity_type = 'deal' AND entity_id IN (SELECT id FROM deals WHERE account_id = $id)`
4. `DELETE FROM activities WHERE entity_type = 'account' AND entity_id = $id`
5. `DELETE FROM attachments WHERE entity_type = 'account' AND entity_id = $id`
6. `DELETE FROM notes WHERE entity_type = 'account' AND entity_id = $id`
7. `DELETE FROM deals WHERE account_id = $id`
8. `DELETE FROM accounts WHERE id = $id` → DB автоматически SET NULL на contacts.account_id

**Alternatives considered**:
- PostgreSQL-триггер вместо app-level — усложняет миграции; нет явного контроля в коде
- Изменить FK deals.account_id → CASCADE DELETE — требует новой миграции; меняет схему БД, которая принята в F-01

---

### D-06: owner_id — только при создании

**Decision**: `owner_id = req.user.id` устанавливается автоматически при POST. Поле не принимается из тела запроса и не меняется через PUT.

**Rationale**: Спека FR-002 явно: "Система ДОЛЖНА автоматически назначать создателя аккаунта его владельцем". Смена владельца — в бэклоге. Если клиент передаёт `owner_id` в теле — игнорировать.

---

### D-07: Валидация name

**Decision**: `name` обязателен при POST (400 если отсутствует или пустая строка после trim). При PUT — если поле передано, должно быть непустой строкой.

**Implementation**:
```js
// POST
if (!body.name || !body.name.trim()) return res.status(400).json({ error: 'Bad Request', message: 'Поле name обязательно' });

// PUT — только если name передан
if ('name' in body && (!body.name || !body.name.trim())) {
  return res.status(400).json({ error: 'Bad Request', message: 'Поле name не может быть пустым' });
}
```
