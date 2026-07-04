# Quickstart: Тестирование F-03 RBAC

**Feature**: F-03 | **Date**: 2026-05-25

## Предварительные требования

- Сервер запущен (`npm start` или `npm run dev`)
- F-02 (Google SSO) реализована, вы авторизованы через браузер
- Для тестирования разных ролей: используйте сессии разных пользователей или временно измените роль в БД

## Базовые проверки

### 1. Свой профиль (любая роль)
```bash
curl -b cookies.txt http://localhost:3000/api/v1/users/me
# → 200: { "id": "...", "name": "...", "email": "...", "role": "..." }
```

### 2. Список пользователей

**Как admin:**
```bash
curl -b admin-cookies.txt http://localhost:3000/api/v1/users
# → 200: массив из 4 пользователей
```

**Как bdm или viewer:**
```bash
curl -b bdm-cookies.txt http://localhost:3000/api/v1/users
# → 403: { "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }
```

### 3. Изменение роли пользователя (admin)
```bash
curl -X PATCH -b admin-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"role": "bdm"}' \
  http://localhost:3000/api/v1/users/{USER_ID}/role
# → 200: обновлённый профиль пользователя
```

## Проверка защитных механизмов

### 4. Попытка изменить свою роль (должна быть отклонена)
```bash
curl -X PATCH -b admin-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"role": "viewer"}' \
  http://localhost:3000/api/v1/users/{YOUR_OWN_ID}/role
# → 403: { "error": "Forbidden", "message": "Нельзя изменить собственную роль" }
```

### 5. Попытка изменить роль последнего admin (должна быть отклонена)
```bash
# Убедитесь, что в системе только 1 admin
curl -X PATCH -b admin-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"role": "bdm"}' \
  http://localhost:3000/api/v1/users/{LAST_ADMIN_ID}/role
# → 403: { "error": "Forbidden", "message": "Невозможно изменить роль единственного администратора" }
```

### 6. BDM пытается удалить ресурс (должно быть отклонено)
```bash
curl -X DELETE -b bdm-cookies.txt \
  http://localhost:3000/api/v1/accounts/{ANY_ID}
# → 403: { "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }
```

### 7. Viewer пытается создать ресурс (должно быть отклонено)
```bash
curl -X POST -b viewer-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}' \
  http://localhost:3000/api/v1/accounts
# → 403: { "error": "Forbidden", "message": "Недостаточно прав для выполнения операции" }
```

## Матрица ролей — быстрая проверка

| Операция | admin | bdm | viewer |
|----------|-------|-----|--------|
| GET /api/v1/users/me | 200 | 200 | 200 |
| GET /api/v1/users | 200 | 403 | 403 |
| PATCH /api/v1/users/:id/role | 200* | 403 | 403 |
| POST /api/v1/accounts | 201 | 201 | 403 |
| PUT /api/v1/accounts/:id | 200 | 200 | 403 |
| DELETE /api/v1/accounts/:id | 204 | 403 | 403 |

*при соблюдении правил self-role и last-admin
