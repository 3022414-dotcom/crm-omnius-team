# Research: Активности (Activities)

**Date**: 2026-07-05 | **Plan**: [plan.md](plan.md)

## D-01 — overdue computation: SQL vs app-level

**Decision**: Вычислять `overdue` в SQL через `CASE WHEN` в каждом SELECT.

**Rationale**: SQL-подход даёт точный результат без итерации строк в JS; логика не дублируется между create и list путями; одна точка истины.

**SQL-паттерн**:
```sql
CASE
  WHEN a.due_date IS NOT NULL
    AND a.due_date < NOW()
    AND a.completed = false
  THEN true
  ELSE false
END AS overdue
```

**Alternatives considered**:
- App-level (JS after query): проще читать, но дублирование if-условия в каждой функции. Отклонено.
- Хранить `overdue` в БД: требует триггера обновления при изменении `due_date`/`completed`/clock. Излишне сложно. Отклонено.

---

## D-02 — Null-inclusive date filter

**Decision**: Активности без `due_date` (null) всегда включаются в результат при применении фильтра `due_date_from`/`due_date_to` (Clarification Q2).

**SQL-паттерн** (оба фильтра применены):
```sql
(a.due_date IS NULL OR (a.due_date >= $from AND a.due_date <= $to))
```

**Паттерн для одной границы** (только from):
```sql
(a.due_date IS NULL OR a.due_date >= $from)
```

**Паттерн для одной границы** (только to):
```sql
(a.due_date IS NULL OR a.due_date <= $to)
```

**Rationale**: Пользователи фильтруют по дате для отображения задач в диапазоне. Задачи без срока релевантны всегда — не имеет смысла их скрывать.

---

## D-03 — Bidirectional completed toggle

**Decision**: PUT принимает `{ completed: boolean }` и устанавливает точное значение без state-machine валидации (Clarification Q1).

**Rationale**: Toggle двусторонний (true ↔ false); нет ограничений на переходы состояния. Проверять только тип: значение должно быть boolean; строки "true"/"false" отклоняются (400).

**Invariant**: Когда `completed` устанавливается в `true`, `overdue` автоматически становится `false` по D-01 формуле (три условия не выполняются одновременно).

---

## D-04 — Dynamic WHERE clause

**Decision**: Строить WHERE динамически через массив условий + параметры.

**Паттерн**:
```js
const conditions = ['a.entity_type = $1', 'a.entity_id = $2'];
const params = [entityType, entityId];
let idx = 3;

if (completed !== undefined) {
  conditions.push(`a.completed = $${idx++}`);
  params.push(completed === 'true');
}
if (type) {
  conditions.push(`a.type = $${idx++}`);
  params.push(type);
}
if (due_date_from) {
  conditions.push(`(a.due_date IS NULL OR a.due_date >= $${idx++})`);
  params.push(due_date_from);
}
if (due_date_to) {
  conditions.push(`(a.due_date IS NULL OR a.due_date <= $${idx++})`);
  params.push(due_date_to);
}
```

**Alternatives considered**:
- Отдельный SQL на каждую комбинацию: комбинаторный взрыв при 4 фильтрах (16 вариантов). Отклонено.
- ORM query builder: нет ORM в стеке. Отклонено.

---

## D-05 — listActivitiesForEntity factory

**Decision**: Использовать фабрику `listActivitiesForEntity(entityType)`, возвращающую `async (req, res) => {...}` — тот же паттерн что F-07 `listNotesForEntity` и F-08 `listAttachmentsForEntity`.

**Rationale**: Устоявшийся паттерн проекта; три entity-specific маршрута (accounts/contacts/deals) без дублирования бизнес-логики.

---

## D-06 — owner в ответе: JOIN с users

**Decision**: JOIN с таблицей `users` для получения `name` владельца в каждом запросе.

**SQL**:
```sql
FROM activities a
JOIN users u ON a.owner_id = u.id
WHERE a.entity_type = $1 AND a.entity_id = $2
ORDER BY a.created_at DESC
```

**Response mapping**: `owner: { id: u.id, name: u.name }` — явный маппинг, без spread. Поле `owner_id` не включается в ответ.

---

## D-07 — Каскадное удаление: нет изменений

**Decision**: F-09 не модифицирует контроллеры F-04/F-05/F-06.

**Rationale**: Проверено в коде: `accountsController.deleteAccount`, `contactsController.deleteContact`, `dealsController.deleteDeal` уже содержат `DELETE FROM activities WHERE entity_type=X AND entity_id=Y`. Физических файлов у активностей нет — каскад чисто DB-level и уже реализован.

---

## D-08 — Explicit response field mapping

**Decision**: Явный маппинг всех полей ответа (без spread). Поле `owner_id` не включается.

**Response object**:
```js
{
  id: a.id,
  type: a.type,
  entity_type: a.entity_type,
  entity_id: a.entity_id,
  description: a.description,
  due_date: a.due_date,
  completed: a.completed,
  overdue: a.overdue,            // computed by SQL
  owner: { id: u.id, name: u.name },
  created_at: a.created_at,
  updated_at: a.updated_at,
}
```

**Rationale**: Согласованность с F-07/F-08; исключает случайную утечку внутренних полей.
