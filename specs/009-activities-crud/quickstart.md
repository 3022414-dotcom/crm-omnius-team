# Quickstart: Активности (Activities)

**Date**: 2026-07-05 | **Contract**: [contracts/activities-api.md](contracts/activities-api.md)

## Prerequisites

```bash
# Сервер запущен
cd /Users/shevtsovajulia/Development/crm-omnius-team
docker compose up -d  # PostgreSQL
npm start             # Express on :3000

# Переменные для тестов
ACCOUNT_ID="<существующий UUID аккаунта>"
CONTACT_ID="<существующий UUID контакта>"
DEAL_ID="<существующий UUID сделки>"
BASE="http://localhost:3000/api/v1"
```

---

## §1 Создание активностей (US1)

```bash
# 1a. Звонок к аккаунту (без due_date)
curl -s -X POST "$BASE/activities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "call",
    "entity_type": "account",
    "entity_id": "'"$ACCOUNT_ID"'",
    "description": "Обсудили условия договора"
  }' | jq '{id, type, completed, overdue, owner}'
# Ожидаем: 201, completed=false, overdue=false

# 1b. Задача с прошедшим due_date (будет overdue)
ACTIVITY_ID=$(curl -s -X POST "$BASE/activities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "task",
    "entity_type": "account",
    "entity_id": "'"$ACCOUNT_ID"'",
    "description": "Просроченная задача",
    "due_date": "2026-01-01T00:00:00.000Z"
  }' | jq -r '.id')
echo "Created activity: $ACTIVITY_ID"
# Ожидаем: 201

# 1c. Ошибки валидации
curl -s -X POST "$BASE/activities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"entity_type":"account","entity_id":"'"$ACCOUNT_ID"'"}' | jq .
# Ожидаем: 400 (type обязателен)

curl -s -X POST "$BASE/activities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"type":"call","entity_type":"account","entity_id":"00000000-0000-0000-0000-000000000000"}' | jq .
# Ожидаем: 404 (entity не найдена)
```

---

## §2 Список активностей сущности (US2)

```bash
# 2a. Все активности аккаунта
curl -s "$BASE/accounts/$ACCOUNT_ID/activities" \
  -b cookies.txt | jq 'length, .[0]'
# Ожидаем: массив, каждый объект содержит overdue

# 2b. Проверка overdue=true для просроченной задачи
curl -s "$BASE/accounts/$ACCOUNT_ID/activities" \
  -b cookies.txt | jq '[.[] | select(.id == "'"$ACTIVITY_ID"'")] | .[0].overdue'
# Ожидаем: true

# 2c. Фильтр: только невыполненные
curl -s "$BASE/accounts/$ACCOUNT_ID/activities?completed=false" \
  -b cookies.txt | jq '[.[] | .completed] | unique'
# Ожидаем: [false]

# 2d. Фильтр: только звонки
curl -s "$BASE/accounts/$ACCOUNT_ID/activities?type=call" \
  -b cookies.txt | jq '[.[] | .type] | unique'
# Ожидаем: ["call"]

# 2e. Фильтр: date range (активности без due_date должны попасть)
curl -s "$BASE/accounts/$ACCOUNT_ID/activities?due_date_from=2026-07-01&due_date_to=2026-07-31" \
  -b cookies.txt | jq 'length'
# Ожидаем: включает активности с due_date=null

# 2f. Активности контакта и сделки
curl -s "$BASE/contacts/$CONTACT_ID/activities" -b cookies.txt | jq 'type'
curl -s "$BASE/deals/$DEAL_ID/activities" -b cookies.txt | jq 'type'
# Ожидаем: "array"

# 2g. Несуществующая сущность
curl -s "$BASE/accounts/00000000-0000-0000-0000-000000000000/activities" \
  -b cookies.txt | jq .
# Ожидаем: 404
```

---

## §3 Обновление активности (US3)

```bash
# 3a. Отметить выполненной (completed: true → overdue должно стать false)
curl -s -X PUT "$BASE/activities/$ACTIVITY_ID" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"completed": true}' | jq '{completed, overdue}'
# Ожидаем: completed=true, overdue=false

# 3b. Обратный toggle (false → можно снова)
curl -s -X PUT "$BASE/activities/$ACTIVITY_ID" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"completed": false}' | jq '{completed, overdue}'
# Ожидаем: completed=false, overdue=true (due_date в прошлом)

# 3c. Обновить type
curl -s -X PUT "$BASE/activities/$ACTIVITY_ID" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"type": "email"}' | jq '.type'
# Ожидаем: "email"

# 3d. Невалидный type
curl -s -X PUT "$BASE/activities/$ACTIVITY_ID" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"type": "fax"}' | jq .
# Ожидаем: 400

# 3e. Несуществующая активность
curl -s -X PUT "$BASE/activities/00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"completed": true}' | jq .
# Ожидаем: 404
```

---

## §4 Удаление активности (US4)

```bash
# Создать активность для удаления
DEL_ID=$(curl -s -X POST "$BASE/activities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"type":"meeting","entity_type":"account","entity_id":"'"$ACCOUNT_ID"'","description":"to delete"}' \
  | jq -r '.id')

# 4a. Удалить (admin)
curl -s -X DELETE "$BASE/activities/$DEL_ID" -b cookies.txt -o /dev/null -w "%{http_code}"
# Ожидаем: 204

# 4b. Проверить — больше нет
curl -s -X DELETE "$BASE/activities/$DEL_ID" -b cookies.txt | jq .
# Ожидаем: 404

# 4c. bdm → 403
# (переключить на bdm-сессию)
curl -s -X DELETE "$BASE/activities/$ACTIVITY_ID" -b cookies_bdm.txt | jq .
# Ожидаем: 403
```

---

## §5 Smoke test (полный сценарий)

```bash
echo "=== F-09 Smoke Test ==="

# 1. Создать активность
ACT=$(curl -s -X POST "$BASE/activities" \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"type":"call","entity_type":"account","entity_id":"'"$ACCOUNT_ID"'","description":"smoke"}')
ACT_ID=$(echo $ACT | jq -r '.id')
echo "Created: $ACT_ID | overdue=$(echo $ACT | jq '.overdue')"

# 2. Проверить в списке
COUNT=$(curl -s "$BASE/accounts/$ACCOUNT_ID/activities" -b cookies.txt | jq length)
echo "List count: $COUNT"

# 3. Обновить
UPD=$(curl -s -X PUT "$BASE/activities/$ACT_ID" \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"completed":true}')
echo "Updated completed=$(echo $UPD | jq '.completed') overdue=$(echo $UPD | jq '.overdue')"

# 4. Удалить
STATUS=$(curl -s -X DELETE "$BASE/activities/$ACT_ID" -b cookies.txt -o /dev/null -w "%{http_code}")
echo "Delete status: $STATUS"

# 5. Verify gone
GONE=$(curl -s "$BASE/accounts/$ACCOUNT_ID/activities" -b cookies.txt | jq "[.[] | select(.id == \"$ACT_ID\")] | length")
echo "Still present: $GONE (expect 0)"
```
