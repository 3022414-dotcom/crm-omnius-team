# Tasks: Контейнеризация бэкенда

**Branch**: `001-1-backend-docker` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: Ручное тестирование — `docker-compose up -d` + curl

## Phase 1: Setup

- [X] T001 Verify project root contains `package.json`, `server/index.js`, `docker-compose.yml` with postgres service — всё подтверждено

## Phase 2: Foundational (нет зависимостей — пропускается)

## Phase 3: User Story 1 — Запуск системы через docker-compose (Priority: P1) 🎯

**Goal**: `docker-compose up -d` → бэкенд + postgres; `curl localhost:3000/api/v1/deals` → HTTP-ответ

**Independent Test**: docker-compose up -d → оба контейнера Up → curl 200/401 (не connection refused)

### Implementation for User Story 1

- [X] T002 [US1] Create `Dockerfile` in project root: FROM node:20-alpine; WORKDIR /app; COPY package*.json ./; RUN npm ci --omit=dev; COPY server/ ./server/; RUN mkdir -p uploads; EXPOSE 3000; CMD ["node", "server/index.js"]
- [X] T003 [US1] Create `.dockerignore` in project root: node_modules/, .git/, .env, .env.*, uploads/, specs/, .claude/, .specify/, *.log
- [X] T004 [US1] Update `docker-compose.yml` — добавить сервис `backend`: build: .; container_name: omnius_crm_backend; ports: "${PORT:-3000}:3000"; env_file: .env; environment: DATABASE_URL override с hostname postgres; depends_on: postgres (condition: service_healthy); volumes: ./uploads:/app/uploads; добавить restart: unless-stopped для обоих сервисов

**Checkpoint**: `docker-compose build` без ошибок; `docker-compose up -d` → оба Up; `curl localhost:3000/api/v1/deals` → не connection refused

## Phase 4: Polish

- [ ] T005 Verify `npm start` и `npm run dev` продолжают работать локально без Docker (env vars из .env); убедиться что .dockerignore не сломал build context
- [ ] T006 Smoke test по quickstart.md (если требует сервер — с Docker): docker-compose up -d → curl /api/v1/deals

## Dependencies

- T002 → T003 → T004 (строго последовательно — разные файлы, но логически зависят)
- T005, T006 — после T004

## Notes

- `--omit=dev` эквивалент `--only=production` для npm 7+; исключает nodemon из образа
- DATABASE_URL в docker-compose environment: `postgresql://${POSTGRES_USER:-omnius}:${POSTGRES_PASSWORD:-omnius_secret}@postgres:5432/${POSTGRES_DB:-omnius_crm}` — использует имя сервиса `postgres` вместо `localhost`
- `uploads/` на хосте создаётся Docker автоматически при первом volume mount
- Миграции: `docker-compose exec backend npm run migrate` после первого запуска
