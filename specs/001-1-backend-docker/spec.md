# Feature Specification: Контейнеризация бэкенда

**Feature Branch**: `001-1-backend-docker`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Инфраструктурная задача — бэкенд-приложение должно запускаться как Docker-контейнер наравне с PostgreSQL, через единую команду `docker-compose up`.

## Clarifications

*Нет — требования однозначны для инфраструктурной задачи.*

## User Scenarios & Testing

### User Story 1 — Запуск всей системы одной командой (Priority: P1)

Разработчик или администратор поднимает всё окружение командой `docker-compose up` и получает работающее приложение (бэкенд + БД), доступное на `localhost:3000`.

**Why this priority**: Без этого бэкенд нельзя задеплоить — он не контейнеризован. P1 — единственная user story этой фичи.

**Independent Test**: `docker-compose up -d` → оба контейнера healthy → `curl http://localhost:3000/api/v1/deals` возвращает не connection error; загружаемые файлы сохраняются в `uploads/` на хосте при перезапуске контейнера.

**Acceptance Scenarios**:

1. **Given** `.env` с корректными OAuth и session vars, **When** выполняется `docker-compose up -d`, **Then** оба сервиса (`postgres`, `backend`) запускаются без ошибок; бэкенд доступен на `localhost:3000`
2. **Given** контейнеры запущены, **When** выполняется `curl http://localhost:3000/api/v1/deals`, **Then** возвращается не network error (200 или 401 — оба корректные ответы, зависящие от сессии)
3. **Given** контейнеры запущены, **When** контейнер бэкенда перезапускается, **Then** загруженные ранее файлы в `uploads/` остаются доступными (volume mount)
4. **Given** бэкенд-контейнер запускается, **When** PostgreSQL ещё не готов, **Then** бэкенд ждёт готовности БД благодаря `depends_on: condition: service_healthy`
5. **Given** разработчик работает локально без Docker, **When** он запускает `npm start`, **Then** поведение не меняется — Docker-файлы не ломают локальный запуск

### Edge Cases

- `.env` отсутствует → `docker-compose up` упадёт с ошибкой env vars из `server/index.js` — допустимо, документируется в README/quickstart
- Порт 3000 занят → Docker не запустит контейнер — стандартное поведение Docker
- `uploads/` не существует на хосте → Docker создаст его автоматически при монтировании volume

## Requirements

### Functional Requirements

- **FR-001**: Проект ДОЛЖЕН содержать `Dockerfile` для бэкенда на базе `node:20-alpine`; образ копирует только production-зависимости и `server/`; `uploads/` создаётся внутри образа как точка монтирования
- **FR-002**: `docker-compose.yml` ДОЛЖЕН содержать сервис `backend` с: зависимостью от `postgres` (condition: service_healthy), портом `3000`, volume-монтом `./uploads:/app/uploads`, передачей env vars из `.env` с переопределением `DATABASE_URL` на внутренний hostname `postgres`
- **FR-003**: Проект ДОЛЖЕН содержать `.dockerignore` исключающий `node_modules/`, `.git/`, `.env*`, `uploads/`, `specs/` из Docker build context

### Key Entities

- **Dockerfile**: рецепт сборки Docker-образа бэкенда
- **docker-compose backend service**: декларация запуска контейнера с нужными env vars, портами, volume
- **.dockerignore**: список исключений для оптимизации build context

## Success Criteria

### Measurable Outcomes

- **SC-001**: `docker-compose up -d` поднимает оба контейнера без ошибок при наличии корректного `.env`
- **SC-002**: `curl localhost:3000/api/v1/deals` возвращает HTTP-ответ (не connection refused) после запуска
- **SC-003**: Файлы из `uploads/` доступны после перезапуска `backend`-контейнера

## Assumptions

- Node.js 20 LTS используется как base image (соответствует LTS-политике)
- `DATABASE_URL` в `.env` настроен для локального запуска (`localhost`) — docker-compose переопределяет его для внутренней сети
- Миграции (`npm run migrate`) запускаются вручную через `docker-compose exec backend npm run migrate` после первого запуска — автостарт миграций вне MVP
- Dev-режим (nodemon, hot reload) в Docker не нужен — контейнер для production/staging; локальная разработка по-прежнему через `npm run dev`
- `uploads/` том монтируется для персистентности файлов при пересборке/перезапуске контейнера
