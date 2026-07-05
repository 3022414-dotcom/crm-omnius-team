# Quickstart: Deals CRUD (F-06)

**Предусловия**: Сервер запущен (`npm start`), авторизован как admin (cookie SESSION).

Замените переменные:
- `ADMIN_COOKIE` — cookie из браузера (connect.sid=...)
- `BDM_COOKIE` — cookie bdm-пользователя
- `BASE` = `http://localhost:3000`

---

## §1 — Создание сделки (US1)

```bash
# 1.1 Создать сделку с минимальными полями
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Тестовая сделка"}' | jq .

# Ожидание: 201, stage="lead", owner_id=<ваш id>
# Сохранить: DEAL_ID=<id из ответа>

# 1.2 Создать сделку с полными полями (нужен существующий ACCOUNT_ID)
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Полная сделка\",\"value\":250000,\"close_date\":\"2026-09-30\",\"account_id\":\"$ACCOUNT_ID\"}" | jq .

# 1.3 Создание без title → 400
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"value":100}' | jq .

# Ожидание: 400 Bad Request

# 1.4 Viewer → 403
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Cookie: $VIEWER_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Viewer deal"}' | jq .

# Ожидание: 403 Forbidden

# 1.5 Несуществующий account_id → 400
curl -s -X POST "$BASE/api/v1/deals" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Bad account","account_id":"00000000-0000-0000-0000-000000000000"}' | jq .

# Ожидание: 400, message: "Аккаунт не найден"
```

---

## §2 — Просмотр и поиск сделок (US2)

```bash
# 2.1 Список сделок (по умолчанию)
curl -s "$BASE/api/v1/deals" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# Ожидание: {data:[...], total:N, page:1, limit:20}
# Каждый объект содержит: account{id,name}, owner{id,name}, contacts_count

# 2.2 Фильтр по stage
curl -s "$BASE/api/v1/deals?stage=lead" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.data[] | .stage'

# Ожидание: все "lead"

# 2.3 Поиск по title
curl -s "$BASE/api/v1/deals?search=тест" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.data[] | .title'

# 2.4 Фильтр по date range
curl -s "$BASE/api/v1/deals?date_from=2026-01-01&date_to=2026-12-31" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.data | length'

# 2.5 GET /deals/:id с контактами
curl -s "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# Ожидание: объект с полями account, owner, contacts (массив)

# 2.6 Несуществующий ID → 404
curl -s "$BASE/api/v1/deals/00000000-0000-0000-0000-000000000000" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# Ожидание: 404
```

---

## §3 — Редактирование сделки (US3)

```bash
# 3.1 Частичное обновление — только stage
curl -s -X PUT "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"stage":"qualified"}' | jq .stage

# Ожидание: "qualified"

# 3.2 Невалидный stage → 400
curl -s -X PUT "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"stage":"invalid_stage"}' | jq .

# Ожидание: 400

# 3.3 Пустой title → 400
curl -s -X PUT "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"title":""}' | jq .

# Ожидание: 400

# 3.4 Смена owner_id (нужен существующий USER_ID)
curl -s -X PUT "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"owner_id\":\"$USER_ID\"}" | jq .owner_id

# Ожидание: USER_ID

# 3.5 Несуществующий owner_id → 400
curl -s -X PUT "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"owner_id":"00000000-0000-0000-0000-000000000000"}' | jq .

# Ожидание: 400, message: "Пользователь не найден"

# 3.6 Viewer → 403
curl -s -X PUT "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $VIEWER_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"stage":"proposal"}' | jq .

# Ожидание: 403
```

---

## §4 — Управление контактами сделки (US4)

```bash
# 4.1 Привязать контакт (нужен существующий CONTACT_ID)
curl -s -X POST "$BASE/api/v1/deals/$DEAL_ID/contacts" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"contact_id\":\"$CONTACT_ID\"}" | jq .

# Ожидание: 201

# 4.2 Повторная привязка → 200 (идемпотентно)
curl -s -X POST "$BASE/api/v1/deals/$DEAL_ID/contacts" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"contact_id\":\"$CONTACT_ID\"}" \
  -w "\nHTTP: %{http_code}" | tail -1

# Ожидание: HTTP: 200

# 4.3 Несуществующий contact_id → 400
curl -s -X POST "$BASE/api/v1/deals/$DEAL_ID/contacts" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"contact_id":"00000000-0000-0000-0000-000000000000"}' | jq .

# Ожидание: 400, message: "Контакт не найден"

# 4.4 Проверить contacts_count в списке
curl -s "$BASE/api/v1/deals?search=тест" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.data[] | .contacts_count'

# Ожидание: 1

# 4.5 Отвязать контакт
curl -s -X DELETE "$BASE/api/v1/deals/$DEAL_ID/contacts/$CONTACT_ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"

# Ожидание: 204

# 4.6 Повторное отвязывание → 204 (идемпотентно)
curl -s -X DELETE "$BASE/api/v1/deals/$DEAL_ID/contacts/$CONTACT_ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"

# Ожидание: 204
```

---

## §5 — Удаление сделки (US5)

```bash
# 5.1 bdm → 403
curl -s -X DELETE "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $BDM_COOKIE" -w "%{http_code}"

# Ожидание: 403

# 5.2 Admin удаляет сделку
curl -s -X DELETE "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"

# Ожидание: 204

# 5.3 GET после удаления → 404
curl -s "$BASE/api/v1/deals/$DEAL_ID" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# Ожидание: 404

# 5.4 Несуществующая сделка → 404
curl -s -X DELETE "$BASE/api/v1/deals/00000000-0000-0000-0000-000000000000" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# Ожидание: 404
```

---

## §6 — Smoke test (быстрая проверка)

```bash
# Создать → список → детали → удалить
DEAL=$(curl -s -X POST "$BASE/api/v1/deals" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Smoke test deal"}')
ID=$(echo $DEAL | jq -r .id)
echo "Created: $ID"

curl -s "$BASE/api/v1/deals" -H "Cookie: $ADMIN_COOKIE" | jq .total
curl -s "$BASE/api/v1/deals/$ID" -H "Cookie: $ADMIN_COOKIE" | jq '.stage, (.contacts | length)'
curl -s -X DELETE "$BASE/api/v1/deals/$ID" -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"
curl -s "$BASE/api/v1/deals/$ID" -H "Cookie: $ADMIN_COOKIE" | jq .error
```
