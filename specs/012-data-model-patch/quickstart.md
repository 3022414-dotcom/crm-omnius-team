# Quickstart: F-12 Data Model Patch — Test Scenarios

**Feature**: F-12 Data Model Patch  
**Date**: 2026-07-10

---

## Pre-conditions

1. Docker запущен: `docker ps` показывает `omnius_crm_db` (PostgreSQL) и `omnius_crm_backend` (Express)
2. Существующие данные: хотя бы 1 аккаунт, 1 контакт, 1 сделка с `stage = 'qualified'` или `'negotiation'`

---

## Scenario 1: Миграция применяется без ошибок

```bash
npm run db:migrate
```

**Ожидаемый результат**: команда завершается без ошибок, выводит `Migrations complete!`

**Проверка в БД** (psql в контейнере):
```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name IN ('accounts', 'contacts', 'deals', 'deal_contacts')
ORDER BY table_name, ordinal_position;
```
Должны присутствовать: `accounts.type`, `accounts.location`, `accounts.is_target`, `deals.currency`, `deals.expected_start_date`, `deal_contacts.role`.

---

## Scenario 2: Deal Stage Migration (qualified → qualifying)

**Подготовка**: До миграции существует сделка со `stage = 'qualified'`.

**После миграции**:
```sql
SELECT id, title, stage FROM deals WHERE stage = 'qualifying';
```
Должна вернуть ранее-qualified сделку с `stage = 'qualifying'`.

```sql
-- Убедиться, что старых значений нет
SELECT DISTINCT stage FROM deals WHERE stage IN ('qualified', 'negotiation');
-- Ожидаемый результат: 0 строк
```

---

## Scenario 3: Industry SET NULL

**Подготовка**: До миграции у аккаунта `industry = 'SomeOldValue'`.

**После миграции**:
```sql
SELECT name, industry FROM accounts WHERE name = 'аккаунт с industry';
-- Ожидается: industry = NULL
```

---

## Scenario 4: email_corp копируется из email

```sql
SELECT first_name, email, email_corp FROM contacts WHERE email IS NOT NULL LIMIT 5;
-- Ожидается: email_corp = email для каждой строки
```

---

## Scenario 5: Создание аккаунта с новыми полями

**Запрос** (через UI или curl):
```http
POST /api/v1/accounts
Content-Type: application/json

{
  "name": "Test Corp F12",
  "type": "Prospect",
  "location": "Russia",
  "size": "51-200",
  "is_target": true,
  "account_storage": "https://drive.google.com/test"
}
```

**Ожидается**: 201, тело содержит все переданные поля.

---

## Scenario 6: Создание сделки со стейджем "Discovery"

```http
POST /api/v1/deals
Content-Type: application/json

{
  "title": "New Discovery Deal",
  "stage": "discovery",
  "currency": "RUB",
  "deal_type": "New Client",
  "our_services": ["Consulting", "Workshop"]
}
```

**Ожидается**: 201, `stage = "discovery"`, `our_services = ["Consulting", "Workshop"]`.

---

## Scenario 7: Валидация lost_reason

```http
POST /api/v1/deals
Content-Type: application/json

{
  "title": "Lost Deal No Reason",
  "stage": "lost"
}
```

**Ожидается**: **400 Bad Request** с сообщением об обязательности `lost_reason`.

---

## Scenario 8: Kanban показывает 8 колонок

Открыть `/kanban` в браузере.  
**Ожидается**: 8 колонок — Lead, Qualifying, Discovery, Proposal, Closing, Contract, Won, Lost.  
Карточка сделки показывает: название, аккаунт, сумму, Deal Owner, Expected Start Date.

---

## Scenario 9: Существующий аккаунт открывается после миграции

Открыть карточку аккаунта, созданного до F-12.  
**Ожидается**: карточка открывается, старые поля (name, website, phone) сохранены, новые поля (type, location, size) пустые — без ошибок JS.

---

## Scenario 10: deal_contacts — role и comment

1. Открыть детальную страницу сделки.
2. Добавить контакт к сделке.
3. Установить `role = "Decision Maker"`, `comment = "Финальное решение за ним"`.
4. Сохранить.

**Ожидается**: role и comment сохранены, отображаются в таблице контактов сделки.
