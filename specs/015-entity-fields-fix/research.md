# Research: Entity Field Fixes — Deal, Contact, Account

**Feature**: F-15 | **Branch**: `015-entity-fields-fix` | **Date**: 2026-07-13

## Decision 1: created_by_id FK — поведение при удалении пользователя

- **Decision**: `ON DELETE SET NULL`
- **Rationale**: При удалении пользователя исторические записи сохраняются; поле показывает «—». Соответствует конституции (аналогичная политика: `contacts.account_id` → `ON DELETE SET NULL`).
- **Alternatives considered**: `ON DELETE RESTRICT` — заблокировал бы удаление пользователей пока у них есть созданные записи; неприемлемо для 4-person CRM. `ON DELETE CASCADE` — удалял бы записи вместе с пользователем; деструктивно.

## Decision 2: Форматирование Amount (тысячи через пробел)

- **Decision**: `Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 })`
- **Rationale**: Browser built-in, нет нового пакета. Локаль `ru-RU` даёт неразрывный пробел как разделитель тысяч, что соответствует ТЗ. `style: 'decimal'` — без знака валюты (Currency — отдельное поле).
- **Alternatives considered**: `style: 'currency'` — добавляет знак ₽, не соответствует ТЗ (`5 000 000` без символа). Ручной regex/replace — лишняя сложность.
- **Impact**: `formatAmount` используется в AccountDetailPage и ContactDetailPage (таблицы сделок). После изменения числа отображаются без ₽ — это корректно.

## Decision 3: GET /api/v1/users — снятие ограничения admin

- **Decision**: Убрать `requireRole(['admin'])` из `router.get('/', ...)`. Эндпоинт защищён глобальным `requireAuth`.
- **Rationale**: AccountDetailPage уже вызывает `getUsers` для dropdown Account Manager — значит bdm не мог использовать это поле (получал 403). Это существующий баг. Clarify Q1 подтвердил: открыть всем authenticated.
- **Alternatives considered**: Отдельный эндпоинт `GET /api/v1/users/list` (public subset) — YAGNI; дублирование существующего эндпоинта без необходимости. Встроить в entity response — усложнение контрактов.

## Decision 4: created_by JOIN в GET-ответах

- **Decision**: `LEFT JOIN users cb ON x.created_by_id = cb.id` в getDealById, getAccountById, getContactById. Поле ответа: `created_by: { id, name } | null`.
- **Rationale**: Паттерн LEFT JOIN уже используется везде в проекте (owner, account_manager). NULL-safe: старые записи (NULL created_by_id) вернут `created_by: null`, фронтенд показывает `deal.created_by?.name ?? '—'`.
- **Alternatives considered**: N+1 запрос (SELECT users WHERE id=...) — лишний roundtrip. Вернуть только created_by_name — неконсистентно с остальными вложенными объектами.

## Decision 5: Deal Owner в DealDetailPage

- **Decision**: `useQuery(['users'], getUsers, { enabled: canWrite })` + InlineField type="select" с optionObjects. При readOnly — отображать `deal.owner?.name ?? '—'`.
- **Rationale**: Паттерн полностью скопирован из AccountDetailPage (Account Manager). owner_id уже в UPDATABLE_FIELDS backend-контроллера деалов — обновление работает без изменений контроллера.
- **Alternatives considered**: Отдельный эндпоинт для owners — YAGNI. Статический список имён — не поддерживается при изменении состава команды.

## Decision 6: Label "Amount" (колонка остаётся `value`)

- **Decision**: Переименовать только UI-label с "Value" на "Amount". DB-колонка `value` не меняется.
- **Rationale**: Изменение DB-колонки требует миграции + переименования во всех местах — излишне. Label в InlineField независим от имени поля.
- **Alternatives considered**: Переименовать DB-колонку в `amount` — потребует ALTER TABLE + изменение всех SELECT/INSERT в dealsController — избыточно для визуального изменения.
