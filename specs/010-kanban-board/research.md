# Research: Kanban-доска

**Feature**: F-10 Kanban-доска
**Date**: 2026-07-05

## D-01: URL-путь Kanban-эндпоинта

**Decision**: `GET /api/v1/deals/kanban`

**Rationale**: Соответствует all-features-mvp.md; расширяет существующий deals-роутер без создания нового файла; Express корректно матчит literal path `/kanban` раньше параметрического `/:id` при правильном порядке регистрации; соответствует принципу простоты.

**Alternatives considered**:
- `GET /api/v1/kanban/deals` — потребовал бы новый роутер `server/routes/kanban.js` и регистрацию в `app.js`; нарушает YAGNI

---

## D-02: HTTP-глагол для смены стадии

**Decision**: `PATCH /api/v1/deals/:id/stage`

**Rationale**: Семантически корректен — PATCH означает частичное обновление ресурса (только одно поле `stage`); PUT означает полную замену; предпочтение пользователя; нет конфликта с существующим `PUT /:id`.

**Alternatives considered**:
- `PUT /api/v1/deals/:id/stage` — per all-features-mvp.md, но PATCH точнее по RFC 5789 для одного поля

---

## D-03: Группировка сделок по стадиям

**Decision**: JS-группировка после SQL-запроса

**Rationale**: SQL возвращает плоский список всех сделок (сортировка created_at DESC, фильтр по owner_id); JS-цикл распределяет их по ключам объекта `{lead:[], qualified:[], ...}`. Альтернатива с GROUP BY в SQL не подходит — агрегация массивов JSON через `json_agg` усложняет запрос без выигрыша при 4 пользователях.

**Alternatives considered**:
- SQL `GROUP BY stage + json_agg` — избыточная сложность для MVP при малом объёме данных

---

## D-04: Подсчёт contacts_count

**Decision**: SQL `COUNT(dc.contact_id)` через `LEFT JOIN deal_contacts dc ON dc.deal_id = d.id` + `GROUP BY d.id`

**Rationale**: Один SQL-запрос возвращает и данные сделки, и количество контактов; `LEFT JOIN` гарантирует включение сделок без контактов (`contacts_count = 0`).

---

## D-05: Расположение нового кода

**Decision**: Оба метода (`getKanbanDeals` + `updateDealStage`) добавляются в `server/controllers/dealsController.js`

**Rationale**: `VALID_STAGES` уже там; оба метода оперируют сделками; нет необходимости в отдельном файле; YAGNI.

**Alternatives considered**:
- `server/controllers/kanbanController.js` — отдельный файл, потребовал бы импорта VALID_STAGES или дублирования; нарушает YAGNI

---

## D-06: Структура ответа Kanban-доски

**Decision**: Объект с 6 ключами в фиксированном порядке `STAGE_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']`

**Rationale**: Все 6 стадий всегда присутствуют (SC-001); порядок фиксирован для предсказуемого рендеринга фронтенда; пустые стадии = `[]`.

---

## D-07: Фильтр по owner_id

**Decision**: SQL `($1::uuid IS NULL OR d.owner_id = $1::uuid)` — null передаётся когда параметр не указан; конкретный UUID — при наличии `?owner_id=UUID`

**Rationale**: Один запрос обрабатывает оба случая без условного ветвления в JS; pg корректно обрабатывает null в параметрах; невалидный UUID → pg вернёт ошибку → нужна обработка в контроллере.

---

## D-08: Ответ updateDealStage

**Decision**: Возвращать полный объект сделки (200) в том же формате, что и `getDealById`

**Rationale**: Клиент (будущий фронтенд) сможет обновить карточку в UI без дополнительного запроса; соответствует практике существующих PATCH/PUT в проекте.

**Query strategy**: UPDATE stage → затем SELECT с JOIN users + LEFT JOIN accounts для построения полного ответа.

---

## D-09: Порядок регистрации маршрутов в deals.js

**Decision**: `router.get('/kanban', ...)` ПЕРЕД `router.get('/:id', ...)` в deals.js; `router.patch('/:id/stage', ...)` — место не критично (уникальный метод PATCH)

**Rationale**: Express матчит маршруты в порядке регистрации; `/kanban` — literal path, `:id` — параметрический; при неправильном порядке "kanban" будет интерпретирован как UUID и запрос уйдёт в `getDealById`.
