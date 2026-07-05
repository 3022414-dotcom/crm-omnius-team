# Quickstart: Attachments CRUD (F-08)

**Предусловия**: Сервер запущен (`npm start`), авторизованы как admin и bdm (cookies).

Переменные:
- `ADMIN_COOKIE`, `BDM_COOKIE`, `VIEWER_COOKIE`
- `BASE` = `http://localhost:3000`
- `ACCOUNT_ID`, `CONTACT_ID`, `DEAL_ID` — существующие id из F-04/F-05/F-06
- Тестовый файл: `test.pdf` (любой PDF < 50 MB в текущей директории)

---

## §1 — Загрузка вложения (US1)

```bash
# 1.1 Загрузить файл к аккаунту
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=account" \
  -F "entity_id=$ACCOUNT_ID" | jq .

# Ожидание: 201, без поля file_path, с uploaded_by.name
# Сохранить: ATT_ID=<id из ответа>

# 1.2 Загрузить к контакту (bdm)
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $BDM_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=contact" \
  -F "entity_id=$CONTACT_ID" | jq .

# 1.3 Загрузить к сделке
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=deal" \
  -F "entity_id=$DEAL_ID" | jq .

# 1.4 Без файла → 400
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "entity_type=account" \
  -F "entity_id=$ACCOUNT_ID" | jq .
# Ожидание: 400

# 1.5 Невалидный entity_type → 400
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=user" \
  -F "entity_id=$ACCOUNT_ID" | jq .
# Ожидание: 400 Невалидный entity_type

# 1.6 Несуществующий entity_id → 404
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=account" \
  -F "entity_id=00000000-0000-0000-0000-000000000000" | jq .
# Ожидание: 404

# 1.7 Viewer → 403
curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $VIEWER_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=account" \
  -F "entity_id=$ACCOUNT_ID" | jq .
# Ожидание: 403
```

---

## §2 — Просмотр вложений сущности (US2)

```bash
# 2.1 Список вложений аккаунта
curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/attachments" \
  -H "Cookie: $VIEWER_COOKIE" | jq .
# Ожидание: plain array, каждый с uploaded_by{id,name}, без file_path

# 2.2 Список вложений контакта
curl -s "$BASE/api/v1/contacts/$CONTACT_ID/attachments" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# 2.3 Список вложений сделки
curl -s "$BASE/api/v1/deals/$DEAL_ID/attachments" \
  -H "Cookie: $ADMIN_COOKIE" | jq .

# 2.4 Несуществующий аккаунт → 404
curl -s "$BASE/api/v1/accounts/00000000-0000-0000-0000-000000000000/attachments" \
  -H "Cookie: $ADMIN_COOKIE" | jq .
# Ожидание: 404

# 2.5 Проверить отсутствие file_path в ответе
curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/attachments" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.[0] | keys'
# Ожидание: ["created_at","entity_id","entity_type","file_name","file_size","id","mime_type","uploaded_by"]
# НЕ должно быть: "file_path"
```

---

## §3 — Скачивание файла (US3)

```bash
# 3.1 Скачать файл (сохранить в downloaded_test.pdf)
curl -s -o downloaded_test.pdf -D - \
  "$BASE/api/v1/attachments/$ATT_ID/download" \
  -H "Cookie: $VIEWER_COOKIE"
# Ожидание: Content-Disposition: attachment; filename="test.pdf"
# Ожидание: Content-Type: application/pdf

# 3.2 Несуществующее вложение → 404
curl -s "$BASE/api/v1/attachments/00000000-0000-0000-0000-000000000000/download" \
  -H "Cookie: $ADMIN_COOKIE" | jq .
# Ожидание: 404
```

---

## §4 — Удаление вложения (US4)

```bash
# Создать новое вложение для удаления
DEL_ATT=$(curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=account" \
  -F "entity_id=$ACCOUNT_ID")
DEL_ID=$(echo $DEL_ATT | jq -r .id)

# 4.1 Admin удаляет вложение → 204
curl -s -X DELETE "$BASE/api/v1/attachments/$DEL_ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"
# Ожидание: 204

# 4.2 BDM не может удалить → 403
NEW_ATT=$(curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=account" \
  -F "entity_id=$ACCOUNT_ID")
NEW_ID=$(echo $NEW_ATT | jq -r .id)
curl -s -X DELETE "$BASE/api/v1/attachments/$NEW_ID" \
  -H "Cookie: $BDM_COOKIE" -w "%{http_code}"
# Ожидание: 403

# 4.3 Несуществующее → 404
curl -s -X DELETE "$BASE/api/v1/attachments/00000000-0000-0000-0000-000000000000" \
  -H "Cookie: $ADMIN_COOKIE" | jq .
# Ожидание: 404
```

---

## §5 — Smoke test

```bash
# Загрузить → получить список → скачать → удалить
ATT=$(curl -s -X POST "$BASE/api/v1/attachments" \
  -H "Cookie: $ADMIN_COOKIE" \
  -F "file=@test.pdf" \
  -F "entity_type=account" \
  -F "entity_id=$ACCOUNT_ID")
ID=$(echo $ATT | jq -r .id)
echo "Created: $ID"

curl -s "$BASE/api/v1/accounts/$ACCOUNT_ID/attachments" \
  -H "Cookie: $ADMIN_COOKIE" | jq '.[0].file_name'

curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/api/v1/attachments/$ID/download" \
  -H "Cookie: $ADMIN_COOKIE"

curl -s -X DELETE "$BASE/api/v1/attachments/$ID" \
  -H "Cookie: $ADMIN_COOKIE" -w "%{http_code}"
# Ожидание финального статуса: 204
```
