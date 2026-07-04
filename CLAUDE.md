# omnius.team CRM — Claude Code Context

## Проект

Внутренняя CRM для omnius.team — AI-агентство (B2B-обучение, консалтинг, аутсорсинг). Команда 4 человека. Цель 2026: 30 млн руб. оборота.

## Ключевые документы

- [`all-features-mvp.md`](all-features-mvp.md) — все 11 фич MVP с AC, Tech Notes, Edge Cases
- [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — архитектурные принципы, стек, соглашения

## ОБЯЗАТЕЛЬНО перед разработкой любой фичи

1. Прочитать `all-features-mvp.md` — AC, Tech Notes и Edge Cases для конкретной фичи
2. Прочитать `.specify/memory/constitution.md` — стек, соглашения, принципы
3. Проверить зависимости фичи (порядок: F-01 → F-02 → ... → F-11)

## Фреймворк разработки

Все фичи проходят через spec-kit в строгом порядке:

```
/speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement
```

Ни одна фича не начинается без спецификации. Никакой прямой реализации вне этого цикла.

## Порядок разработки MVP

| # | Фича | Зависит от |
|---|------|------------|
| F-01 | Схема БД и миграции | — |
| F-02 | Google SSO авторизация | F-01 |
| F-03 | Роли и права доступа | F-02 |
| F-04 | Аккаунты (Accounts) | F-03 |
| F-05 | Контакты (Contacts) | F-04 |
| F-06 | Сделки (Deals) | F-04, F-05 |
| F-07 | Заметки (Notes) | F-04, F-05, F-06 |
| F-08 | Вложения (Attachments) | F-04, F-05, F-06 |
| F-09 | Активности (Activities) | F-04, F-05, F-06 |
| F-10 | Kanban-доска | F-06 |
| F-11 | UI/UX общий | F-04 — F-10 |

## Команда и роли

| Пользователь | Роль |
|---|---|
| Дмитрий Твердохлебов | admin |
| Юлия Шевцова | admin |
| Анастасия Стефанова | bdm |
| Илья Болховский | viewer |

## Стек (кратко)

- Backend: Node.js + Express
- DB: PostgreSQL 15+ (Docker)
- Auth: Google OAuth 2.0 (Passport.js)
- Sessions: express-session + connect-pg-simple
- Migrations: node-pg-migrate
- Package manager: npm
- Deploy: Docker + docker-compose

Фронтенд не выбран — зафиксировать до F-04 (Next.js или React+Vite).

<!-- SPECKIT START -->
**Active feature plan**: [specs/004-accounts-crud/plan.md](specs/004-accounts-crud/plan.md)
<!-- SPECKIT END -->
