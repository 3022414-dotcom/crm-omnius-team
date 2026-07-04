# Quickstart: Аккаунты (Accounts)

**Feature**: F-04 Аккаунты | **Date**: 2026-07-04

**Prerequisites**:
- Сервер запущен: `docker-compose up -d && npm run dev` (или `node server/index.js`)
- Есть авторизованные сессии для трёх ролей (получить через Google OAuth или тест-сессию)
- В системе есть пользователи: admin (Дмитрий/Юлия), bdm (Анастасия), viewer (Илья)
- Сохранить cookie-файлы: admin_cookies.txt, bdm_cookies.txt, viewer_cookies.txt

---

## §1 Создание аккаунта (US1)

### 1.1 Минимальный аккаунт (только name)

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name": "Тест ООО"}' | jq .
```

**Ожидаемый результат**: 201, объект с полями id/name/owner_id/created_at/updated_at; industry/website/phone/address/notes = null.

### 1.2 Полный аккаунт

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Омниус Технологии",
    "industry": "IT-консалтинг",
    "website": "https://omnius.team",
    "phone": "+7 (495) 000-00-00",
    "address": "Москва, ул. Тестовая, 1",
    "notes": "Потенциальный клиент"
  }' | jq .
```

**Ожидаемый результат**: 201, все поля присутствуют; `owner_id` = id текущего admin-пользователя.

### 1.3 Без name → 400

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"industry": "IT"}' | jq .
```

**Ожидаемый результат**: `{"error":"Bad Request","message":"Поле name обязательно"}`

### 1.4 Пустой name → 400

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name": "   "}' | jq .
```

**Ожидаемый результат**: 400 Bad Request.

### 1.5 Viewer не может создать → 403

```bash
curl -s -b viewer_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name": "Тест"}' | jq .
```

**Ожидаемый результат**: `{"error":"Forbidden","message":"Недостаточно прав для выполнения операции"}`

---

## §2 Просмотр и поиск (US2)

*Предполагается, что в системе есть несколько аккаунтов из §1.*

### 2.1 Список без параметров

```bash
curl -s -b viewer_cookies.txt http://localhost:3000/api/v1/accounts | jq .
```

**Ожидаемый результат**: `{ "data": [...], "total": N, "page": 1, "limit": 20 }`. Каждый объект содержит `contactsCount` и `dealsCount`.

### 2.2 Пагинация

```bash
curl -s -b viewer_cookies.txt 'http://localhost:3000/api/v1/accounts?page=1&limit=1' | jq .
```

**Ожидаемый результат**: `data` массив из 1 элемента; `total` = полное количество аккаунтов.

### 2.3 Поиск по части названия

```bash
curl -s -b viewer_cookies.txt 'http://localhost:3000/api/v1/accounts?search=омниус' | jq .
```

**Ожидаемый результат**: только аккаунты, содержащие "омниус" в названии (без учёта регистра).

### 2.4 Поиск без результатов

```bash
curl -s -b viewer_cookies.txt 'http://localhost:3000/api/v1/accounts?search=несуществующий12345' | jq .
```

**Ожидаемый результат**: `{ "data": [], "total": 0, "page": 1, "limit": 20 }`

### 2.5 Просмотр конкретного аккаунта (подставить реальный ID)

```bash
ACCOUNT_ID="<id из ответа §1.1>"
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" | jq .
```

**Ожидаемый результат**: 200, полный объект аккаунта с `contactsCount` и `dealsCount`.

### 2.6 Несуществующий ID → 404

```bash
curl -s -b viewer_cookies.txt \
  http://localhost:3000/api/v1/accounts/00000000-0000-0000-0000-000000000000 | jq .
```

**Ожидаемый результат**: `{"error":"Not Found"}`

---

## §3 Редактирование (US3)

*Использовать ID аккаунта "Тест ООО" из §1.1.*

### 3.1 Обновить только один телефон (частичное обновление)

```bash
ACCOUNT_ID="<id из §1.1>"
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"phone": "+7 (900) 111-22-33"}' | jq .
```

**Ожидаемый результат**: 200, объект с обновлённым `phone`; поле `name` = "Тест ООО" (не затёрто); `updated_at` изменился.

### 3.2 Повторный GET — проверить что только phone изменился

```bash
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" | jq '{name, phone, industry}'
```

**Ожидаемый результат**: `name = "Тест ООО"`, `phone = "+7 (900) 111-22-33"`, `industry = null`.

### 3.3 Пустое тело — данные без изменений

```bash
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

**Ожидаемый результат**: 200, объект без изменений.

### 3.4 Обновление name пустой строкой → 400

```bash
curl -s -b admin_cookies.txt -X PUT "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name": ""}' | jq .
```

**Ожидаемый результат**: 400 Bad Request.

### 3.5 Viewer не может обновить → 403

```bash
curl -s -b viewer_cookies.txt -X PUT "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"industry": "IT"}' | jq .
```

**Ожидаемый результат**: 403 Forbidden.

---

## §4 Удаление и каскад (US4)

### 4.1 Подготовка — создать аккаунт и привязать данные

```bash
# Создать аккаунт для удаления
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name": "Для удаления"}' | jq .
# Запомнить DELETE_ACCOUNT_ID
```

*(Контакты, сделки, заметки — будут добавляться в F-05/F-06/F-07. Для F-04 достаточно проверить удаление пустого аккаунта.)*

### 4.2 Удалить аккаунт (admin)

```bash
DELETE_ACCOUNT_ID="<id из §4.1>"
curl -s -o /dev/null -w "%{http_code}" -b admin_cookies.txt \
  -X DELETE "http://localhost:3000/api/v1/accounts/$DELETE_ACCOUNT_ID"
```

**Ожидаемый результат**: `204`

### 4.3 Проверить что аккаунт исчез

```bash
curl -s -b viewer_cookies.txt "http://localhost:3000/api/v1/accounts/$DELETE_ACCOUNT_ID" | jq .
```

**Ожидаемый результат**: `{"error":"Not Found"}`

### 4.4 Удаление несуществующего → 404

```bash
curl -s -b admin_cookies.txt \
  -X DELETE http://localhost:3000/api/v1/accounts/00000000-0000-0000-0000-000000000000 | jq .
```

**Ожидаемый результат**: `{"error":"Not Found"}`

### 4.5 bdm не может удалить → 403

```bash
ACCOUNT_ID="<id любого существующего аккаунта>"
curl -s -b bdm_cookies.txt -X DELETE "http://localhost:3000/api/v1/accounts/$ACCOUNT_ID" | jq .
```

**Ожидаемый результат**: 403 Forbidden.

---

## §5 Проверка матрицы доступа

| Операция | admin | bdm | viewer |
|----------|-------|-----|--------|
| POST /accounts | ✅ 201 | ✅ 201 | ❌ 403 |
| GET /accounts | ✅ 200 | ✅ 200 | ✅ 200 |
| GET /accounts/:id | ✅ 200 | ✅ 200 | ✅ 200 |
| PUT /accounts/:id | ✅ 200 | ✅ 200 | ❌ 403 |
| DELETE /accounts/:id | ✅ 204 | ❌ 403 | ❌ 403 |

---

## §6 Edge Cases

### 6.1 Дублирующееся название — допустимо

```bash
curl -s -b admin_cookies.txt -X POST http://localhost:3000/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name": "Тест ООО"}' | jq .name
```

**Ожидаемый результат**: 201 — дубль разрешён (нет UNIQUE constraint на name).

### 6.2 limit > 100 → применяется как 100

```bash
curl -s -b viewer_cookies.txt 'http://localhost:3000/api/v1/accounts?limit=500' | jq .limit
```

**Ожидаемый результат**: `100`

### 6.3 page=0 → применяется как page=1

```bash
curl -s -b viewer_cookies.txt 'http://localhost:3000/api/v1/accounts?page=0' | jq .page
```

**Ожидаемый результат**: `1`
