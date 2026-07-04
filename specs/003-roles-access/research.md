# Research: Роли и права доступа (RBAC)

**Feature**: F-03 | **Date**: 2026-05-25

Технический стек полностью определён конституцией — NEEDS CLARIFICATION отсутствуют. Раздел фиксирует ключевые дизайн-решения.

---

## D-01: Структура requireRole middleware

**Decision**: Factory function `requireRole(allowedRoles)`, возвращающая Express middleware. Принимает массив допустимых ролей.

**Rationale**: Позволяет декларативно применять к конкретному роуту:
```js
router.delete('/:id', requireRole(['admin']), controller.delete)
```
Читаемо, не требует дополнительных файлов, роль уже в `req.user` (F-02 deserializeUser).

**Alternatives considered**:
- Permission-based middleware (`canDo('delete', 'accounts')`) — избыточно для 3 ролей с фиксированной матрицей
- Centralized policy object с lookup-таблицей — лишний слой абстракции для MVP

---

## D-02: Размещение requireRole — роут vs router-level

**Decision**: Применять `requireRole` на уровне отдельного роута, а не на весь router.

**Rationale**: Разные HTTP-методы имеют разные права (GET — все роли, DELETE — только admin). Router-level middleware не даст нужной дифференциации без усложнения.

**Alternatives considered**:
- Отдельный router per role — дублирование роутов, труднее читать
- HTTP method check внутри одного middleware — монолитный middleware, хуже расширяем

---

## D-03: Защита от self-role-change

**Decision**: Проверка в контроллере `updateUserRole`: если `req.user.id === req.params.id` → 403 с сообщением "Нельзя изменить собственную роль".

**Rationale**: Бизнес-правило, а не вопрос доступа — правильное место в контроллере.

**Alternatives considered**:
- Отдельный middleware `preventSelfRoleChange` — over-engineering для одной проверки

---

## D-04: Защита от изменения роли последнего admin

**Decision**: В контроллере `updateUserRole` перед изменением выполнять:
```sql
SELECT COUNT(*) FROM users WHERE role = 'admin'
```
Если count = 1 и целевой пользователь — этот admin → 403 "Невозможно изменить роль единственного администратора".

**Rationale**: Требует одного DB-запроса, который нельзя вынести в middleware без передачи контекста. Один дополнительный SELECT при смене роли — приемлемо для 4 пользователей.

**Alternatives considered**:
- PostgreSQL trigger CHECK — корректно с точки зрения data integrity, но ошибка из триггера возвращает неинформативный PG error code, труднее преобразовать в 403 с понятным сообщением
- Application-level constraint через транзакцию с LOCK — избыточно для 4 пользователей

---

## D-05: Порядок регистрации маршрутов /me vs /:id

**Decision**: `GET /api/v1/users/me` регистрируется РАНЬШЕ `GET /api/v1/users/:id`.

**Rationale**: Express сопоставляет маршруты в порядке регистрации. Если `/:id` зарегистрирован первым, запрос `GET /users/me` будет обработан с id="me" → 404 или неверный ответ.

---

## D-06: Поля в API-ответах для user объектов

**Decision**: Возвращать из API: `id`, `name`, `email`, `role`, `created_at`. Поле `google_id` не возвращается.

**Rationale**: Принцип minimal exposure — `google_id` является внутренней деталью OAuth, не нужен клиентскому коду.

**Alternatives considered**:
- `SELECT *` и возврат всего — раскрывает internal OAuth data

---

## D-07: Расположение requireRole в auth.js vs отдельный файл

**Decision**: Добавить `requireRole` в существующий `server/middleware/auth.js` рядом с `ensureAuthenticated`.

**Rationale**: Оба middleware — про authn/authz. Один файл, один import на стороне роутов. YAGNI — создавать `roles.js` нет смысла.
