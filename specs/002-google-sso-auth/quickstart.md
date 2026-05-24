# Quickstart: F-02 Google SSO — Ручная верификация

## Предусловия

- F-01 завершена: `npm run migrate` и `npm run seed` выполнены (4 пользователя в таблице users)
- Google OAuth App создан в Google Cloud Console, credentials добавлены в `.env`
- `.env` содержит: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback`, `SESSION_SECRET` (≥32 символов)

## Запуск

```bash
npm run dev        # или npm start
# Сервер запустится на PORT (default: 3000)
```

**Проверка fail-fast**: Убрать `SESSION_SECRET` из `.env` → сервер должен упасть с сообщением `Missing required env vars: SESSION_SECRET`.

---

## US1: Вход в систему

### Сценарий 1 — Успешный вход (зарегистрированный пользователь)

1. Открыть браузер → `http://localhost:3000/`
2. Убедиться: отображается страница с кнопкой "Войти через Google"
3. Нажать кнопку
4. Пройти OAuth с аккаунтом из списка (напр. `shevtsova_julia@omnius.team`)
5. **Ожидание**: редирект на `http://localhost:3000/` (главная страница)
6. **Проверка сессии**:
   ```bash
   # В psql
   SELECT sid, expire FROM session;
   # Ожидание: 1 строка, expire ≈ NOW() + 7 дней
   ```
7. **Проверка google_id**:
   ```bash
   SELECT email, google_id FROM users WHERE email = 'shevtsova_julia@omnius.team';
   # Ожидание: google_id заполнен (не NULL)
   ```

### Сценарий 2 — Отказ в доступе (незарегистрированный пользователь)

1. `http://localhost:3000/`
2. Нажать "Войти через Google"
3. Войти с аккаунтом, которого нет в таблице users
4. **Ожидание**: редирект на `http://localhost:3000/?error=access_denied`
5. **Ожидание**: страница показывает "Доступ запрещён. Обратитесь к администратору."
6. **Проверка**: в таблице session — 0 строк

### Сценарий 3 — Защита маршрутов

```bash
# Без cookie сессии
curl -i http://localhost:3000/api/v1/ping
# Ожидание: HTTP/1.1 401, {"error":"Unauthorized"}
```

---

## US2: Выход из системы

1. Войти (Сценарий 1)
2. Перейти на `http://localhost:3000/auth/logout`
3. **Ожидание**: редирект на `/`, страница входа
4. **Проверка**:
   ```bash
   SELECT COUNT(*) FROM session;
   # Ожидание: 0 (сессия удалена)
   ```
5. Попытаться обратиться к `http://localhost:3000/api/v1/ping`
6. **Ожидание**: 401 Unauthorized

---

## US3: Сохранение сессии после перезапуска

1. Войти (Сценарий 1)
2. Скопировать значение session cookie из браузера (DevTools → Application → Cookies)
3. Перезапустить сервер: `Ctrl+C` → `npm run dev`
4. Обратиться к `http://localhost:3000/api/v1/ping` с тем же cookie
5. **Ожидание**: НЕ 401 (сессия восстановлена из PostgreSQL)

---

## Edge Case: Пользователь удалён во время активной сессии

1. Войти под `ilya.bolkhovsky@gmail.com`
2. В psql: `DELETE FROM users WHERE email = 'ilya.bolkhovsky@gmail.com';`
3. Обратиться к `http://localhost:3000/api/v1/ping` (с активной сессией)
4. **Ожидание**: 401 Unauthorized (deserializeUser вернул false)

---

## Итоговая проверка

```bash
# Все 4 пользователя могут войти
# Новый Google-аккаунт получает access_denied
# Перезапуск сервера не разлогинивает
# Выход уничтожает сессию в БД
# Незащищённые /api/v1/* возвращают 401
```
