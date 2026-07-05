# Tasks: Kanban-доска

**Branch**: `010-kanban-board` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Design documents from `specs/010-kanban-board/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Ручное тестирование по quickstart.md (MVP-подход, без unit-тестов)

**Organization**: Задачи сгруппированы по user story. Каждая story независимо тестируема.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Параллельно с другими (разные файлы, нет зависимостей)
- **[Story]**: Привязка к user story из spec.md

---

## Phase 1: Setup (Проверка перед модификацией)

**Purpose**: Убедиться в готовности существующего кода. Новых файлов нет — только модификации существующих.

- [X] T001 Confirm `VALID_STAGES` at line 5 of server/controllers/dealsController.js = `['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']`; confirm route order in server/routes/deals.js has `router.get('/:id', getDealById)` — это якорь для вставки `GET /kanban` ПЕРЕД ним; confirm `module.exports` in dealsController.js lists current exports without `getKanbanDeals` or `updateDealStage`

**Checkpoint**: Структура файлов соответствует плану — можно начинать реализацию

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Нет — `VALID_STAGES` уже существует, pg pool и requireRole уже импортированы. Фаза пропускается.

*(Нет задач)*

---

## Phase 3: User Story 1 — Просмотр Kanban-доски (Priority: P1) 🎯 MVP

**Goal**: Любой авторизованный пользователь получает `GET /api/v1/deals/kanban` → объект с 6 стадиями, карточки отсортированы created_at DESC, пустые стадии = `[]`

**Independent Test**: `GET /api/v1/deals/kanban` → 200 с 6 ключами (lead/qualified/proposal/negotiation/won/lost), каждый = массив карточек; пустые стадии = `[]`; каждая карточка содержит id, title, value, account (объект|null), owner ({id,name}), close_date, contacts_count; нет авторизации → 401

### Implementation for User Story 1

- [X] T002 [US1] Implement `getKanbanDeals` in server/controllers/dealsController.js: (1) `const owner_id = req.query.owner_id || null`; (2) `const { rows } = await pool.query('SELECT d.id, d.title, d.value, d.stage, d.close_date, a.name AS account_name, u.id AS owner_uid, u.name AS owner_name, COUNT(dc.contact_id)::int AS contacts_count FROM deals d LEFT JOIN users u ON d.owner_id = u.id LEFT JOIN accounts a ON d.account_id = a.id LEFT JOIN deal_contacts dc ON dc.deal_id = d.id WHERE ($1::uuid IS NULL OR d.owner_id = $1::uuid) GROUP BY d.id, d.title, d.value, d.stage, d.close_date, a.name, u.id, u.name ORDER BY d.created_at DESC', [owner_id])`; (3) `const board = Object.fromEntries(VALID_STAGES.map(s => [s, []]))`; (4) для каждого row: `board[row.stage].push({ id: row.id, title: row.title, value: row.value, account: row.account_name ? { name: row.account_name } : null, owner: { id: row.owner_uid, name: row.owner_name }, close_date: row.close_date, contacts_count: row.contacts_count })`; (5) `return res.json(board)`; (6) добавить `getKanbanDeals` в `module.exports` рядом с существующими экспортами
- [X] T003 [US1] Update server/routes/deals.js: (1) добавить `getKanbanDeals` к существующему импорту из `'../controllers/dealsController'` (строка 3); (2) вставить `router.get('/kanban', getKanbanDeals)` ПЕРЕД строкой `router.get('/:id', getDealById)` — КРИТИЧНО: если поставить после, Express будет матчить "kanban" как UUID в параметре `:id`

**Checkpoint**: `GET /api/v1/deals/kanban` → 200, 6 стадий, корректные карточки; пустые стадии = `[]`; 401 без авторизации

---

## Phase 4: User Story 2 — Перемещение сделки по стадиям (Priority: P2)

**Goal**: Admin/bdm меняет стадию сделки через `PATCH /api/v1/deals/:id/stage` → 200 с полным объектом сделки

**Independent Test**: `PATCH /api/v1/deals/:id/stage {stage:"qualified"}` → 200 с обновлённым stage; `{stage:"archive"}` → 400; несуществующая → 404; viewer → 403

### Implementation for User Story 2

- [X] T004 [US2] Implement `updateDealStage` in server/controllers/dealsController.js: (1) `const { stage } = req.body`; (2) если `!stage || !VALID_STAGES.includes(stage)` → `return res.status(400).json({ error: 'Bad Request', message: 'stage обязателен: lead/qualified/proposal/negotiation/won/lost' })`; (3) `const { rows: [deal] } = await pool.query('SELECT id FROM deals WHERE id=$1', [req.params.id])` — если `!deal` → 404; (4) `await pool.query('UPDATE deals SET stage=$1, updated_at=NOW() WHERE id=$2', [stage, req.params.id])`; (5) `const { rows: [row] } = await pool.query('SELECT d.id, d.title, d.value, d.stage, d.close_date, d.account_id, d.owner_id, d.created_at, d.updated_at, a.name AS account_name, u.name AS owner_name FROM deals d LEFT JOIN accounts a ON d.account_id = a.id LEFT JOIN users u ON d.owner_id = u.id WHERE d.id=$1', [req.params.id])`; (6) `return res.json({ id: row.id, title: row.title, value: row.value, stage: row.stage, close_date: row.close_date, account_id: row.account_id, owner_id: row.owner_id, account: row.account_id ? { id: row.account_id, name: row.account_name } : null, owner: { id: row.owner_id, name: row.owner_name }, created_at: row.created_at, updated_at: row.updated_at })`; (7) добавить `updateDealStage` в `module.exports`
- [X] T005 [US2] Update server/routes/deals.js: (1) добавить `updateDealStage` к существующему импорту из `'../controllers/dealsController'` (строка 3); (2) добавить `router.patch('/:id/stage', requireRole(['admin', 'bdm']), updateDealStage)` — место в роутере не критично для PATCH (нет конфликта с существующими маршрутами)

**Checkpoint**: `PATCH /api/v1/deals/:id/stage` → 200 с обновлённым stage; 400/404/403 при ошибках

---

## Phase 5: User Story 3 — Фильтрация Kanban по владельцу (Priority: P3)

**Goal**: Фильтрация `GET /api/v1/deals/kanban?owner_id=UUID` возвращает только сделки указанного владельца

**Independent Test**: `GET /api/v1/deals/kanban?owner_id=UUID` → только сделки данного владельца; `?owner_id=несуществующий-UUID` → все 6 стадий = `[]`; без параметра → все сделки

**Примечание**: Реализация US3 включена в T002 — `getKanbanDeals` принимает `req.query.owner_id || null` и передаёт в SQL `WHERE ($1::uuid IS NULL OR d.owner_id = $1::uuid)`. Отдельного кода не требуется.

### Verification for User Story 3

- [X] T006 [US3] Verify owner_id filter в server/controllers/dealsController.js: убедиться, что `getKanbanDeals` (из T002) передаёт `owner_id` как первый параметр в pool.query; `req.query.owner_id || null` → `null` при отсутствии параметра (все сделки); UUID → фильтр по владельцу; несуществующий UUID → pg не выдаёт ошибку, просто нет строк → все стадии `[]`; проверить по quickstart.md §3

**Checkpoint**: `GET /deals/kanban?owner_id=<мой UUID>` → только мои сделки; `?owner_id=00000000-0000-0000-0000-000000000000` → все стадии []

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Финальная проверка и ручная валидация

- [X] T007 Verify module.exports in server/controllers/dealsController.js включает `getKanbanDeals` и `updateDealStage` рядом с существующими: `{ createDeal, listDeals, getDealById, updateDeal, linkContact, unlinkContact, deleteDeal, getKanbanDeals, updateDealStage }`
- [ ] T008 Run quickstart.md §1–§7 smoke test: создать сделки → GET /deals/kanban (6 стадий) → GET /deals/kanban?owner_id=UUID → PATCH /deals/:id/stage → проверить 400/404/403 → проверить сортировку created_at DESC

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Нет зависимостей — старт немедленно
- **Phase 2**: Пропущена — нет задач
- **US1 (Phase 3)**: T002 → T003 (нельзя регистрировать маршрут до реализации функции)
- **US2 (Phase 4)**: T004 → T005 (аналогично); T004 независим от T002/T003
- **US3 (Phase 5)**: T006 зависит от T002 (проверка реализации)
- **Polish (Phase 6)**: T007/T008 зависят от всех фаз

### Порядок изменений в dealsController.js (строго последовательно)

```
T001 (verify) → T002 (getKanbanDeals) → T004 (updateDealStage) → T007 (verify exports)
```

### Порядок изменений в deals.js (строго последовательно)

```
T003 (GET /kanban) → T005 (PATCH /:id/stage)
```

### Параллельные возможности

- T002 и T004 модифицируют один и тот же файл (dealsController.js) → **НЕ параллельно** (добавлять последовательно)
- T003 и T005 модифицируют один и тот же файл (deals.js) → **НЕ параллельно**
- T003 можно начинать после T002 (не ждать T004)
- T004 можно начинать независимо от T002 (разные функции в одном файле, но добавлять последовательно)

---

## Implementation Strategy

### MVP (только US1)

1. T001 (Verify)
2. T002, T003 (US1: GET /kanban)
3. **STOP**: Проверить вручную — 6 стадий, корректные карточки
4. Продолжить к US2–US3

### Full Delivery

1. Verify (T001)
2. US1 (T002–T003) → checkpoint
3. US2 (T004–T005) → checkpoint
4. US3 verify (T006) → checkpoint
5. Polish (T007–T008)

---

## Notes

- **Route order CRITICAL (T003)**: `router.get('/kanban', ...)` ПЕРЕД `router.get('/:id', ...)` — иначе "kanban" будет интерпретирован как UUID
- **VALID_STAGES reuse (T002, T004)**: константа уже определена в dealsController.js на строке 5 — не дублировать
- **contacts_count (T002)**: `COUNT(dc.contact_id)::int` — `::int` преобразует pg bigint в JS number; `LEFT JOIN` гарантирует 0 для сделок без контактов
- **account_name GROUP BY (T002)**: `a.name` должно быть в GROUP BY, иначе pg выдаст ошибку; `u.id` и `u.name` также
- **owner_id в SQL (T002)**: `$1::uuid IS NULL` — работает с pg при передаче null; невалидный UUID строкой вызовет pg ошибку (допустимо для MVP с UUID из системы)
- **updateDealStage response (T004)**: возвращать полный объект сделки (тот же формат что getDealById), не Kanban-карточку
- **updated_at (T004)**: использовать `SET stage=$1, updated_at=NOW()` — не через UPDATABLE_FIELDS (он нам не нужен)
- [P] задачи = разные файлы, без blocking зависимостей
