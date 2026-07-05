# Implementation Plan: Контейнеризация бэкенда

**Branch**: `001-1-backend-docker` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

## Summary

Добавить `Dockerfile` для бэкенда на `node:20-alpine`, обновить `docker-compose.yml` чтобы поднимать бэкенд вместе с PostgreSQL, создать `.dockerignore`. Никаких изменений в исходном коде — только инфраструктурные файлы.

## Technical Context

**Language/Version**: Node.js 20 LTS (alpine)

**Primary Dependencies**: node:20-alpine image; Docker Compose v2

**Storage**: `./uploads` volume mount для персистентности файлов

**Testing**: Ручное — `docker-compose up -d` + curl

**Target Platform**: Docker (linux/amd64)

**Project Type**: Infrastructure / DevOps

**Performance Goals**: Нет (4 пользователя)

**Constraints**: Не изменять логику приложения; devDependencies не включать в образ

**Scale/Scope**: MVP, 4 пользователя

## Constitution Check

| Принцип | Статус | Примечание |
|---------|--------|------------|
| Простота | ✅ PASS | 3 файла, минимальный Dockerfile |
| YAGNI | ✅ PASS | Нет multi-stage, нет auto-migrations |
| Stack compliance | ✅ PASS | Node.js LTS + PostgreSQL 15 + Docker |
| Spec-First | ✅ PASS | spec → plan → tasks → implement |

**Constitution Check: PASS**

## Project Structure

### Documentation

```text
specs/001-1-backend-docker/
├── plan.md         # This file
└── tasks.md        # Phase 2 output
```

### Source Code

```text
Dockerfile           # NEW — бэкенд Docker image
.dockerignore        # NEW — исключения для build context
docker-compose.yml   # MODIFY — добавить backend service
```

## Key Decisions

**D-01 Base image**: `node:20-alpine` — LTS, минимальный размер (~180 MB vs ~900 MB для debian)

**D-02 `npm ci --omit=dev`**: исключает devDependencies (nodemon) из production образа

**D-03 DATABASE_URL в docker-compose**: `env_file: .env` загружает все переменные из .env, `environment:` переопределяет только DATABASE_URL с hostname `postgres` (имя сервиса в docker-compose сети)

**D-04 uploads volume**: `./uploads:/app/uploads` — bind mount на хосте; файлы персистируются при пересборке образа

**D-05 depends_on**: `condition: service_healthy` — бэкенд стартует только после pg_isready (healthcheck уже настроен для postgres сервиса)

**D-06 Автомиграции**: вне scope — запускаются вручную через `docker-compose exec backend npm run migrate`

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*
