# Quickstart: Kanban-доска

**Feature**: F-10 Kanban-доска
**Date**: 2026-07-05

## Prerequisites

Сервер запущен, выполнен вход через Google OAuth (сессия в cookie). Переменная `BASE=http://localhost:3000` + `COOKIE=connect.sid=...`.

## §1 — Подготовка тестовых данных

Убедитесь, что в БД есть несколько сделок в разных стадиях. Если нет — создайте через `POST /api/v1/deals`.

```bash
# Создать сделку в стадии lead
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"title":"Тест Kanban lead","stage":"lead"}' | jq .

# Создать сделку в стадии proposal без аккаунта
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"title":"Тест Kanban proposal","stage":"proposal"}' | jq .
```

## §2 — GET /api/v1/deals/kanban (базовый)

```bash
curl -s "$BASE/api/v1/deals/kanban" -b "$COOKIE" | jq .
```

**Ожидаемый результат:**
- HTTP 200
- Объект с 6 ключами: `lead`, `qualified`, `proposal`, `negotiation`, `won`, `lost`
- Пустые стадии = `[]`
- Каждая карточка содержит: `id`, `title`, `value`, `account` (объект или null), `owner` (объект с id+name), `close_date`, `contacts_count`

## §3 — GET /api/v1/deals/kanban?owner_id=UUID (фильтр)

```bash
# Получить свой owner_id из сессии
OWNER_ID=$(curl -s "$BASE/api/v1/users/me" -b "$COOKIE" | jq -r .id)

curl -s "$BASE/api/v1/deals/kanban?owner_id=$OWNER_ID" -b "$COOKIE" | jq .
```

**Ожидаемый результат:**
- HTTP 200
- Только сделки данного владельца во всех стадиях
- Стадии без его сделок = `[]`

```bash
# Несуществующий owner_id — все стадии пустые
curl -s "$BASE/api/v1/deals/kanban?owner_id=00000000-0000-0000-0000-000000000000" \
  -b "$COOKIE" | jq 'to_entries | map(.value | length)'
# Ожидается: [0,0,0,0,0,0]
```

## §4 — PATCH /api/v1/deals/:id/stage (смена стадии)

```bash
# Взять ID сделки из §2
DEAL_ID="<id из ответа §2>"

# Переместить в qualified
curl -s -X PATCH "$BASE/api/v1/deals/$DEAL_ID/stage" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"stage":"qualified"}' | jq .
```

**Ожидаемый результат:**
- HTTP 200
- Полный объект сделки с `"stage": "qualified"`

## §5 — Ошибочные сценарии

```bash
# Невалидная стадия → 400
curl -s -X PATCH "$BASE/api/v1/deals/$DEAL_ID/stage" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"stage":"archive"}' | jq .
# Ожидается: {"error":"Bad Request","message":"stage обязателен: ..."}

# Несуществующая сделка → 404
curl -s -X PATCH "$BASE/api/v1/deals/00000000-0000-0000-0000-000000000000/stage" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"stage":"won"}' | jq .
# Ожидается: {"error":"Not Found"}

# Без авторизации → 401
curl -s "$BASE/api/v1/deals/kanban" | jq .
# Ожидается: {"error":"Unauthorized"}
```

## §6 — Проверка RBAC (viewer → 403)

```bash
# Войти как Илья Болховский (viewer) или через другой браузер
# VIEWER_COOKIE=connect.sid=...

curl -s -X PATCH "$BASE/api/v1/deals/$DEAL_ID/stage" \
  -H "Content-Type: application/json" \
  -b "$VIEWER_COOKIE" \
  -d '{"stage":"won"}' | jq .
# Ожидается: {"error":"Forbidden"}

# viewer может читать доску:
curl -s "$BASE/api/v1/deals/kanban" -b "$VIEWER_COOKIE" | jq .
# Ожидается: 200 с 6 стадиями
```

## §7 — Проверка сортировки

```bash
# Создать 2 сделки в одной стадии
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"title":"Старая сделка","stage":"negotiation"}' | jq .id

sleep 1

curl -s -X POST "$BASE/api/v1/deals" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"title":"Новая сделка","stage":"negotiation"}' | jq .id

# Получить доску — "Новая сделка" должна быть первой в negotiation
curl -s "$BASE/api/v1/deals/kanban" -b "$COOKIE" | jq '.negotiation[0].title'
# Ожидается: "Новая сделка"
```
