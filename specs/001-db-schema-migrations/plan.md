# Implementation Plan: F-01 Схема данных и миграции

**Branch**: `001-db-schema-migrations` | **Date**: 2026-05-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-db-schema-migrations/spec.md`

## Summary

Создать полную схему данных CRM через систему версионированных миграций. Схема включает 9 таблиц, 4 ENUM-типа, триггерную функцию для auto-update `updated_at`, FK-ограничения с правильными каскадами, и поисковые индексы. Отдельный скрипт seed добавляет 4 участника команды.

## Technical Context

**Language/Version**: Node.js LTS (v22+), JavaScript (CommonJS)

**Primary Dependencies**: node-pg-migrate ^6.x, pg ^8.x, dotenv ^16.x

**Storage**: PostgreSQL 15+ (Docker образ postgres:15-alpine)

**Testing**: Ручная верификация — psql-запросы после запуска миграции; автотесты не входят в F-01

**Target Platform**: Linux (Docker), macOS (локальная разработка)

**Project Type**: Backend — слой данных (нет API, нет UI)

**Performance Goals**: Создание схемы < 60 секунд (SC-001); поисковые запросы — без ощутимой задержки (SC-004)

**Constraints**: PostgreSQL 15+ обязателен (`gen_random_uuid()` встроен); Docker обязателен для локального окружения

**Scale/Scope**: 4 пользователя, сотни записей — малый внутренний инструмент

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Комментарий |
|---------|--------|-------------|
| Простота | ✅ PASS | Один migration-файл, никакого ORM, прямой SQL |
| Spec-First | ✅ PASS | Spec → Clarify → Plan → Tasks → Implement |
| YAGNI | ✅ PASS | Только таблицы MVP, никакого soft-delete, audit-log и т.д. |
| UUID v4 `gen_random_uuid()` | ✅ PASS | Применяется ко всем PK |
| TIMESTAMPTZ везде | ✅ PASS | Все timestamp-поля с timezone |
| updated_at триггер | ✅ PASS | Одна функция, применяется к 7 таблицам |
| node-pg-migrate | ✅ PASS | Инструмент миграций согласно конституции |
| npm | ✅ PASS | Пакетный менеджер согласно конституции |
| Docker PostgreSQL | ✅ PASS | postgres:15-alpine, контейнер omnius_crm_db |

**Нарушений нет. Gate пройден.**

## Project Structure

### Documentation (this feature)

```text
specs/001-db-schema-migrations/
├── plan.md              ← этот файл
├── research.md          ← Phase 0: технические решения
├── data-model.md        ← Phase 1: полная схема всех таблиц
├── quickstart.md        ← Phase 1: инструкция по запуску
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 (создаётся /speckit-tasks)
```

### Source Code

```text
server/
├── migrations/
│   └── 20260524000001_initial_schema.js   ← единый файл миграции
├── db/
│   ├── pool.js                             ← pg.Pool (переиспользуется во всех фичах)
│   └── seed.js                             ← скрипт начального заполнения
package.json                                ← npm-скрипты: migrate, seed
.env.example                                ← шаблон переменных окружения
docker-compose.yml                          ← PostgreSQL сервис
.gitignore                                  ← node_modules/, uploads/, .env
```

**Structure Decision**: Структура из одного backend-проекта. Нет frontend (выбирается перед F-04). Нет отдельного migrations-пакета — файлы миграций лежат в `server/migrations/` согласно конституции.

## Complexity Tracking

*Нарушений конституции нет — раздел пуст.*
