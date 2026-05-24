# Contract: Auth Routes (F-02)

## Публичные маршруты (без аутентификации)

### GET /
Страница входа — минимальный server-rendered HTML.

**Response**: `200 OK`, `Content-Type: text/html`

**Query params**:
- `?error=access_denied` → показать: "Доступ запрещён. Обратитесь к администратору."
- `?error=email_not_verified` → показать: "Google-аккаунт не подтверждён. Обратитесь в поддержку Google."

**Behaviour**: Если пользователь уже авторизован → `302 /` (остаётся на главной).

---

### GET /auth/google
Инициирует Google OAuth 2.0 flow. Редиректит браузер на Google.

**Response**: `302 → https://accounts.google.com/o/oauth2/...`

**Scopes**: `profile`, `email`

---

### GET /auth/google/callback
OAuth callback от Google после авторизации пользователя.

**Query params**: `code`, `state` (от Google), или `error` (при отказе пользователя).

**Success** (пользователь найден в users, email_verified):
- Создаёт сессию
- Обновляет `google_id` если NULL
- `302 /`

**Failure — не в whitelist**:
- `302 /?error=access_denied`

**Failure — email не подтверждён**:
- `302 /?error=email_not_verified`

**Failure — пользователь нажал "Отмена" на Google**:
- `302 /?error=oauth_cancelled`

---

### GET /auth/logout
Уничтожает сессию на сервере, очищает cookie.

**Response**: `302 /`

**Behaviour**: Идемпотентен — если сессии нет, всё равно редиректит на `/`.

---

## Middleware: ensureAuthenticated

Применяется ко всем маршрутам `/api/v1/*`.

**Если авторизован** (`req.isAuthenticated() === true`):
- `next()` — запрос продолжается

**Если не авторизован**:
- `401 Unauthorized`
- Body: `{ "error": "Unauthorized" }`

---

## Примечание о маршрутах `/api/v1/*`

В F-02 маршруты `/api/v1/*` ещё не реализованы (начинаются с F-04). Middleware `ensureAuthenticated` регистрируется в `app.js` как guard для всего префикса, чтобы следующие фичи автоматически получали защиту без дополнительных изменений.

**Тестирование**: В F-02 достаточно проверить `GET /api/v1/ping` (заглушка) → 401 без cookie, 200 с cookie.
