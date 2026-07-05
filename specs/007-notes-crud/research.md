# Research: Заметки (Notes)

**Feature**: F-07 | **Branch**: `007-notes-crud` | **Date**: 2026-07-05

---

## D-01: Валидация entity_type и существования сущности

**Decision**: Белый список таблиц + параметризованный SELECT. entity_type проверяется через константу `VALID_ENTITY_TYPES` до обращения к БД.

**Pattern**:
```js
const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES = { account: 'accounts', contact: 'contacts', deal: 'deals' };

if (!VALID_ENTITY_TYPES.includes(entity_type))
  return res.status(400).json({ error: 'Bad Request', message: 'Невалидный entity_type' });

const table = ENTITY_TABLES[entity_type];
const { rows } = await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [entity_id]);
if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
```

**Security**: `table` берётся из whitelisted объекта ENTITY_TABLES — SQL-инъекция невозможна.

**Alternatives considered**: Дополнительная таблица маппинга — избыточно (YAGNI).

---

## D-02: Контроль доступа на уровне записи (author OR admin)

**Decision**: После проверки существования заметки — inline-проверка `author_id` vs `req.user.id` с fallback на роль admin.

**Pattern**:
```js
const { rows: [note] } = await pool.query('SELECT * FROM notes WHERE id=$1', [id]);
if (!note) return res.status(404).json({ error: 'Not Found' });

if (note.author_id !== req.user.id && req.user.role !== 'admin')
  return res.status(403).json({ error: 'Forbidden' });
```

**Важно**: `requireRole(['admin','bdm'])` применяется на уровне роута (viewer → 403 ещё до контроллера), а record-level check — внутри функции.

**Alternatives considered**: Middleware для record-level access — избыточно для MVP с 4 пользователями.

---

## D-03: LIST — factory function для переиспользования в трёх роутерах

**Decision**: `listNotesForEntity(entityType)` возвращает Express-хэндлер. Вызывается из accounts.js, contacts.js, deals.js с соответствующим типом.

**Pattern**:
```js
function listNotesForEntity(entityType) {
  return async function(req, res) {
    const entityId = req.params.id;

    // Validate entity exists (404 если нет)
    const table = ENTITY_TABLES[entityType];
    const { rows: entity } = await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [entityId]);
    if (!entity[0]) return res.status(404).json({ error: 'Not Found' });

    const { rows } = await pool.query(`
      SELECT n.id, n.content, n.entity_type, n.entity_id,
             n.author_id, n.created_at, n.updated_at,
             u.name AS author_name
      FROM notes n
      JOIN users u ON n.author_id = u.id
      WHERE n.entity_type = $1 AND n.entity_id = $2
      ORDER BY n.created_at DESC
    `, [entityType, entityId]);

    return res.json(rows.map(r => ({
      id: r.id, content: r.content,
      entity_type: r.entity_type, entity_id: r.entity_id,
      author: { id: r.author_id, name: r.author_name },
      created_at: r.created_at, updated_at: r.updated_at,
    })));
  };
}
```

**Response**: Простой массив `[...]` (не envelope — clarification Q1 ответ A).

---

## D-04: CREATE — ответ включает author {id, name}

**Decision**: После INSERT — отдельный SELECT с JOIN users для получения author name. Используется тот же shape что и в списке.

**Pattern**:
```js
const { rows: [note] } = await pool.query(
  `INSERT INTO notes (entity_type, entity_id, content, author_id)
   VALUES ($1, $2, $3, $4) RETURNING *`,
  [entity_type, entity_id, content, req.user.id]
);
// Получить author name:
return res.status(201).json({
  ...note,
  author: { id: req.user.id, name: req.user.name },
});
```

**Note**: `req.user` уже содержит name (deserializeUser в app.js делает `SELECT * FROM users`).

---

## D-05: UPDATE — только content изменяется

**Decision**: `UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *`. После UPDATE — возвращаем ответ с вложенным author (как в create).

**Pattern**:
```js
const { rows: [updated] } = await pool.query(
  `UPDATE notes SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
  [content.trim(), id]
);
return res.json({
  ...updated,
  author: { id: updated.author_id, name: authorName },
});
```

Для `authorName` — после UPDATE делаем `SELECT name FROM users WHERE id=$1` с `updated.author_id`, или используем JOIN в том же запросе.

---

## D-06: Порядок регистрации маршрутов в accounts/contacts/deals

**Decision**: `router.get('/:id/notes', ...)` добавляется ПЕРЕД `router.get('/:id', ...)` в каждом роутере — аналогично тому, как в F-05 `/:id/contacts` добавлялось перед `/:id` в accounts.js.

**Паттерн** (для accounts.js):
```js
router.get('/:id/notes', listNotesForEntity('account'));  // BEFORE /:id
router.get('/:id', getAccountById);
```

**Rationale**: Express матчит роуты в порядке регистрации. `/:id/notes` без явного порядка может быть поглощён `/:id`.

---

## D-07: Константы контроллера

```js
const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES      = { account: 'accounts', contact: 'contacts', deal: 'deals' };
```
