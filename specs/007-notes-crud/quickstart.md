# Quickstart: Notes CRUD (F-07)

**Предусловия**: Сервер запущен (`npm start`), авторизованы как admin и bdm (cookies).

Переменные:
- `ADMIN_COOKIE`, `BDM_COOKIE`, `VIEWER_COOKIE`
- `BASE` = `http://localhost:3000`
- `ACCOUNT_ID`, `CONTACT_ID`, `DEAL_ID` — существующие id из F-04/F-05/F-06

---

## §1 — Создание заметки (US1)

```bash
# 1.1 Создать заметку к аккаунту
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"account\",\"entity_id\":\"$ACCOUNT_ID\",\"content\":\"Звонок состоялся\"}" | jq .

# Ожидание: 201, author.id = текущий пользователь, author.name присутствует
# Сохранить: NOTE_ID=<id из ответа>

# 1.2 Создать заметку к контакту
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $BDM_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"contact\",\"entity_id\":\"$CONTACT_ID\",\"content\":\"Договорились о встрече\"}" | jq .

# 1.3 Создать заметку к сделке
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"deal\",\"entity_id\":\"$DEAL_ID\",\"content\":\"Сделка на финальной стадии\"}" | jq .

# 1.4 Пустой content → 400
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"account\",\"entity_id\":\"$ACCOUNT_ID\",\"content\":\"\"}" | jq .
# Ожидание: 400

# 1.5 Невалидный entity_type → 400
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"user\",\"entity_id\":\"$ACCOUNT_ID\",\"content\":\"test\"}" | jq .
# Ожидание: 400 Невалидный entity_type

# 1.6 Несуществующий entity_id → 404
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"entity_type":"account","entity_id":"00000000-0000-0000-0000-000000000000","content":"test"}' | jq .
# Ожидание: 404

# 1.7 Viewer → 403
curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $VIEWER_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"account\",\"entity_id\":\"$ACCOUNT_ID\",\"content\":\"test\"}" | jq .
# Ожидание: 403
```

---

## §2 — Просмотр заметок сущности (US2)

```bash
# 2.1 Список заметок аккаунта
curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/notes" \
  -H "Cookie: $VIEWER_COOKIE" | jq .
# Ожидание: plain array [...], sorted created_at DESC, каждая с author{id,name}

# 2.2 Список заметок контакта
curl -s "$BASE/api/v1/contacts/$CONTACT_ID/notes" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# 2.3 Список заметок сделки
curl -s "$BASE/api/v1/deals/$DEAL_ID/notes" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# 2.4 Сущность без заметок → []
# (используйте entity_id у которой нет заметок)
curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/notes" \
  -H "Cookie: $ADMIN_COOKIE" | jq '. | length'
# Ожидание: число ≥ 0

# 2.5 Несуществующий аккаунт → 404
curl -s "$BASE/api/v1/accounts/00000000-0000-0000-0000-000000000000/notes" \
  -H "Cookie: $ADMIN_COOKIE" | jq .
# Ожидание: 404
```

---

## §3 — Редактирование заметки (US3)

```bash
# Сохранить ID заметки, созданной BDM:
BDM_NOTE_ID=<id заметки созданной bdm>

# 3.1 Автор редактирует свою заметку
curl -s -X PUT "$BASE/api/v1/notes/$BDM_NOTE_ID" \
  -H "Cookie: $BDM_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"content":"Обновлённый текст"}' | jq .content
# Ожидание: "Обновлённый текст"

# 3.2 Admin редактирует чужую заметку
curl -s -X PUT "$BASE/api/v1/notes/$BDM_NOTE_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"content":"Admin поправил"}' | jq .content
# Ожидание: "Admin поправил"

# 3.3 Пустой content → 400
curl -s -X PUT "$BASE/api/v1/notes/$NOTE_ID" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"content":""}' | jq .
# Ожидание: 400

# 3.4 Viewer → 403
curl -s -X PUT "$BASE/api/v1/notes/$NOTE_ID" \
  -H "Cookie: $VIEWER_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"content":"test"}' | jq .
# Ожидание: 403

# 3.5 BDM редактирует чужую заметку → 403
# (NOTE_ID = заметка созданная admin, BDM_COOKIE = другой пользователь)
curl -s -X PUT "$BASE/api/v1/notes/$NOTE_ID" \
  -H "Cookie: $BDM_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"content":"Чужая заметка"}' | jq .
# Ожидание: 403
```

---

## §4 — Удаление заметки (US4)

```bash
# 4.1 Автор удаляет свою заметку
curl -s -X DELETE "$BASE/api/v1/notes/$BDM_NOTE_ID" \
  -H "Cookie: $BDM_COOKIE" -w "%{http_code}"
# Ожидание: 204

# 4.2 GET после удаления → 404 (или отсутствует в списке)
curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/notes" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.[] | select(.id == "$BDM_NOTE_ID")'
# Ожидание: пусто

# 4.3 Admin удаляет любую заметку
curl -s -X DELETE "$BASE/api/v1/notes/$NOTE_ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"
# Ожидание: 204

# 4.4 BDM удаляет чужую заметку → 403
# (создать новую заметку admin, попытаться удалить bdm)
NEW_NOTE=$(curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"account\",\"entity_id\":\"$ACCOUNT_ID\",\"content\":\"Чужая\"}")
NEW_ID=$(echo $NEW_NOTE | jq -r .id)
curl -s -X DELETE "$BASE/api/v1/notes/$NEW_ID" \
  -H "Cookie: $BDM_COOKIE" -w "%{http_code}"
# Ожидание: 403

# 4.5 Несуществующая заметка → 404
curl -s -X DELETE "$BASE/api/v1/notes/00000000-0000-0000-0000-000000000000" \
  -H "Cookie: $ADMIN_COOKIE" | jq .
# Ожидание: 404
```

---

## §5 — Smoke test

```bash
# Создать → прочитать список → удалить
NOTE=$(curl -s -X POST "$BASE/api/v1/notes" \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"entity_type\":\"account\",\"entity_id\":\"$ACCOUNT_ID\",\"content\":\"Smoke test\"}")
ID=$(echo $NOTE | jq -r .id)
echo "Created: $ID"

curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/notes" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.[0].content'

curl -s -X DELETE "$BASE/api/v1/notes/$ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"
```
