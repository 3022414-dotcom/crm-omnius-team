# Quickstart: Контакты (Contacts)

**Feature**: F-05 Контакты | **Date**: 2026-07-04

**Prerequisites**:
- Сервер запущен: `docker-compose up -d && npm run dev`
- Есть авторизованные сессии: admin_cookies.txt, bdm_cookies.txt, viewer_cookies.txt
- В системе есть хотя бы один аккаунт (из F-04). Записать ACCOUNT_ID.

---

## §1 Создание контакта (US1)

### 1.1 Минимальный контакт (только имя и фамилия)

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/contacts \
  -H 'Content-Type: application/json' \
  -d '{"first_name": "Иван", "last_name": "Иванов"}' | jq .
```

**Ожидаемый результат**: 201; объект с id/first_name/last_name/owner_id; email/phone/position/photo_path/account_id = null.

### 1.2 Полный контакт с привязкой к аккаунту

```bash
ACCOUNT_ID="<uuid аккаунта из F-04>"
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/contacts \
  -H 'Content-Type: application/json' \
  -d "{
    \"first_name\": \"Мария\",
    \"last_name\": \"Петрова\",
    \"email\": \"maria@example.com\",
    \"phone\": \"+7 (900) 000-00-01\",
    \"position\": \"Директор\",
    \"account_id\": \"$ACCOUNT_ID\"
  }" | jq .
# Записать CONTACT_ID для дальнейших тестов
```

**Ожидаемый результат**: 201; все поля сохранены; account_id = ACCOUNT_ID.

### 1.3 Без first_name → 400

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/contacts \
  -H 'Content-Type: application/json' \
  -d '{"last_name": "Иванов"}' | jq .
```

**Ожидаемый результат**: `{"error":"Bad Request","message":"Поле first_name обязательно"}`

### 1.4 Несуществующий account_id → 400

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/contacts \
  -H 'Content-Type: application/json' \
  -d '{"first_name":"Тест","last_name":"Тестов","account_id":"00000000-0000-0000-0000-000000000000"}' | jq .
```

**Ожидаемый результат**: `{"error":"Bad Request","message":"Аккаунт не найден"}`

### 1.5 Viewer не может создать → 403

```bash
curl -s -b viewer_cookies.txt -X POST http://localhost:3000/api/v1/contacts \
  -H 'Content-Type: application/json' \
  -d '{"first_name":"Тест","last_name":"Тестов"}' | jq .
```

**Ожидаемый результат**: 403 Forbidden.

---

## §2 Просмотр и поиск (US2)

*Предполагается несколько контактов из §1.*

### 2.1 Список без параметров

```bash
curl -s -b viewer_cookies.txt http://localhost:3000/api/v1/contacts | jq .
```

**Ожидаемый результат**: `{ "data": [...], "total": N, "page": 1, "limit": 20 }`.

### 2.2 Поиск по фамилии

```bash
curl -s -b viewer_cookies.txt 'http://localhost:3000/api/v1/contacts?search=петрова' | jq .
```

**Ожидаемый результат**: только контакты, совпадающие по имени/фамилии/email.

### 2.3 Контакты аккаунта

```bash
ACCOUNT_ID="<uuid аккаунта>"
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID/contacts" | jq .
```

**Ожидаемый результат**: `{ "data": [...], "total": N, "page": 1, "limit": 20 }` — только контакты этого аккаунта.

### 2.4 Контакты несуществующего аккаунта → 404

```bash
curl -s -b viewer_cookies.txt \
  http://localhost:3000/api/v1/accounts/00000000-0000-0000-0000-000000000000/contacts | jq .
```

**Ожидаемый результат**: `{"error":"Not Found"}`

### 2.5 Конкретный контакт

```bash
CONTACT_ID="<id из §1.2>"
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/contacts/$CONTACT_ID" | jq .
```

**Ожидаемый результат**: 200, полный объект контакта.

---

## §3 Редактирование (US3)

### 3.1 Обновить только phone (частичное обновление)

```bash
CONTACT_ID="<id из §1.1>"
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/contacts/$CONTACT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"phone": "+7 (999) 999-99-99"}' | jq .
```

**Ожидаемый результат**: 200; только phone обновлён; first_name/last_name сохранены.

### 3.2 Отвязать от аккаунта (account_id: null)

```bash
CONTACT_ID="<id из §1.2>"
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/contacts/$CONTACT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"account_id": null}' | jq .account_id
```

**Ожидаемый результат**: `null`

### 3.3 Пустое тело → 200 без изменений

```bash
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/contacts/$CONTACT_ID" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

**Ожидаемый результат**: 200, данные без изменений.

### 3.4 Пустая фамилия → 400

```bash
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/contacts/$CONTACT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"last_name": ""}' | jq .
```

**Ожидаемый результат**: 400 Bad Request.

---

## §4 Управление фото (US4)

### 4.1 Загрузить JPEG-фото

```bash
CONTACT_ID="<id контакта>"
# Создать тестовый JPEG (1x1 pixel)
curl -s -b admin_cookies.txt -X POST \
  "http://localhost:3000/api/v1/contacts/$CONTACT_ID/photo" \
  -F "photo=@/path/to/test.jpg" | jq .
```

**Ожидаемый результат**: `{ "photo_url": "/uploads/contacts/.../avatar_....jpg" }`

### 4.2 Проверить photo_path в БД

```bash
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/contacts/$CONTACT_ID" | jq .photo_path
```

**Ожидаемый результат**: непустая строка с путём.

### 4.3 Повторная загрузка — замена фото

```bash
curl -s -b admin_cookies.txt -X POST \
  "http://localhost:3000/api/v1/contacts/$CONTACT_ID/photo" \
  -F "photo=@/path/to/test2.png" | jq .
```

**Ожидаемый результат**: новый `photo_url`; старый файл удалён с диска.

### 4.4 Неверный формат → 400

```bash
curl -s -b admin_cookies.txt -X POST \
  "http://localhost:3000/api/v1/contacts/$CONTACT_ID/photo" \
  -F "photo=@/etc/hosts" | jq .
```

**Ожидаемый результат**: `{"error":"Bad Request","message":"Допустимые форматы: jpeg, jpg, png, webp"}`

### 4.5 Удалить фото

```bash
curl -s -b admin_cookies.txt -X DELETE \
  "http://localhost:3000/api/v1/contacts/$CONTACT_ID/photo" | jq .
```

**Ожидаемый результат**: 200; GET контакта → `photo_path: null`; файл исчез с диска.

### 4.6 Удалить фото повторно (идемпотентно)

```bash
curl -s -b admin_cookies.txt -X DELETE \
  "http://localhost:3000/api/v1/contacts/$CONTACT_ID/photo" | jq .
```

**Ожидаемый результат**: 200 (не 404).

---

## §5 Удаление (US5)

### 5.1 Создать контакт с фото для удаления

```bash
# Создать + загрузить фото (используя команды из §1.1 и §4.1)
DELETE_CONTACT_ID="<id нового контакта>"
```

### 5.2 Удалить контакт

```bash
curl -s -o /dev/null -w "%{http_code}" -b admin_cookies.txt \
  -X DELETE "http://localhost:3000/api/v1/contacts/$DELETE_CONTACT_ID"
```

**Ожидаемый результат**: `204`

### 5.3 Проверить что контакт исчез

```bash
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/contacts/$DELETE_CONTACT_ID" | jq .
```

**Ожидаемый результат**: `{"error":"Not Found"}`

### 5.4 bdm не может удалить → 403

```bash
CONTACT_ID="<id существующего контакта>"
curl -s -b bdm_cookies.txt -X DELETE "http://localhost:3000/api/v1/contacts/$CONTACT_ID" | jq .
```

**Ожидаемый результат**: 403 Forbidden.

---

## §6 Матрица доступа

| Операция | admin | bdm | viewer |
|----------|-------|-----|--------|
| POST /contacts | ✅ 201 | ✅ 201 | ❌ 403 |
| GET /contacts | ✅ 200 | ✅ 200 | ✅ 200 |
| GET /contacts/:id | ✅ 200 | ✅ 200 | ✅ 200 |
| GET /accounts/:id/contacts | ✅ 200 | ✅ 200 | ✅ 200 |
| PUT /contacts/:id | ✅ 200 | ✅ 200 | ❌ 403 |
| DELETE /contacts/:id | ✅ 204 | ❌ 403 | ❌ 403 |
| POST /contacts/:id/photo | ✅ 200 | ✅ 200 | ❌ 403 |
| DELETE /contacts/:id/photo | ✅ 200 | ✅ 200 | ❌ 403 |
