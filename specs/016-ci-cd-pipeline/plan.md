# Implementation Plan: CI/CD Pipeline (GitHub Actions)

**Branch**: `016-ci-cd-pipeline` | **Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-ci-cd-pipeline/spec.md`

## Summary

Add a version-controlled GitHub Actions CI/CD pipeline with three slices: (1) a **PR check** that builds backend + frontend, lints, runs tests where present, scans for vulnerable dependencies and committed secrets (hard-fail on high/critical), and enforces a `VERSION` bump; (2) a **deploy** workflow on push to `main` that builds Docker images, pushes them to Selectel Container Registry tagged with the `VERSION` value, then over SSH pulls those images on the VPS, runs DB migrations, brings services up behind a TLS-terminating **Caddy** edge proxy (automatic Let's Encrypt), health-checks the public `https://` stand, and auto-rolls-back to the previous tag on failure; (3) a **Slack notification** (Incoming Webhook) with success/failure, version, stand URL, run link, and an LLM-generated change summary (Anthropic Claude API) with a raw-commit-subjects fallback.

Technical approach favors the constitution's "простота прежде всего": plain GitHub Actions YAML + small shell scripts under `scripts/ci/`, one edge-proxy container (Caddy) that auto-manages certificates, and one scanner (Trivy) covering both dependency vulnerabilities and secrets. No new application runtime dependencies; the only app-code change is a tiny public `/healthz` endpoint for the deploy health check.

## Technical Context

**Language/Version**: Node.js 20 (backend + frontend build), Bash for CI glue, GitHub Actions YAML. App: Express (backend), React + Vite (frontend).

**Primary Dependencies**: GitHub Actions; Docker + Buildx; Selectel Container Registry (`cr.selcloud.ru`); Caddy 2 (edge proxy, auto-ACME); Trivy (vuln + secret scan); `oxlint` (frontend lint, already present); OpenRouter API (commit summarization, OpenAI-compatible); Slack Incoming Webhook.

**Storage**: N/A for the pipeline itself. Runtime app uses PostgreSQL 15 on the VPS (unchanged). Release version stored in a committed `VERSION` file.

**Testing**: Frontend has no test suite (skipped/neutral); backend has none (skipped/neutral). Pipeline correctness is validated via a throwaway PR (lint/version-bump failures) and a canary deploy (see quickstart.md). No new unit-test framework is introduced by this feature.

**Target Platform**: Linux VPS running Docker + docker-compose; GitHub-hosted `ubuntu-latest` runners.

**Project Type**: Web application (backend `server/`, frontend `client/`) + infra/CI tooling.

**Performance Goals**: Merge-to-live under 15 min (SC-004); notification within 2 min of run end (SC-005); rollback restores health within 5 min (SC-008).

**Constraints**: No secret values in logs or repo (SC-007); PR checks must not access deployment secrets; single production stand (no staging); auto-TLS with zero manual cert steps (SC-009).

**Scale/Scope**: Team of 4; low deploy frequency (a few per day at most); two images (backend, frontend) + edge proxy + postgres.

### Resolved technical decisions (see research.md)

- **CI platform**: GitHub Actions (repo on GitHub).
- **Edge proxy**: Caddy 2 (automatic Let's Encrypt, one-line config) — chosen over Traefik/nginx+certbot for simplicity.
- **Scanner**: Trivy filesystem scan with `--scanners vuln,secret`, `--severity HIGH,CRITICAL`, `--exit-code 1` — one tool covers both required scan types.
- **LLM**: OpenRouter (OpenAI-compatible Chat Completions API), model `anthropic/claude-haiku-4.5`, via a single `curl` — cheap, fast, sufficient for commit summaries. Secret: `OPENROUTER_API_KEY`.
- **Registry layout**: `cr.selcloud.ru/<namespace>/crm-backend:<VERSION>` and `.../crm-frontend:<VERSION>`.
- **Health check**: new unauthenticated `GET /healthz` on backend (DB ping), exposed through nginx; deploy checks `https://<domain>/healthz`.
- **App runtime secrets**: held in GitHub Actions secrets; the deploy job renders the VPS `.env` from them each run (satisfies FR-015/FR-016 without committing anything).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Простота прежде всего | ✅ PASS | Plain Actions YAML + small shell scripts; single scanner (Trivy); single edge proxy (Caddy). No orchestration platform, no multi-env, no bespoke CD tooling. |
| Spec-First (NON-NEGOTIABLE) | ✅ PASS | This plan follows `/speckit-specify` → `/speckit-clarify` → `/speckit-plan`. No implementation before tasks. |
| Последовательность фич | ✅ PASS | MVP features F-01…F-15 are merged (per git history). This is infra tooling atop the completed app, not a reordering of the MVP sequence. |
| YAGNI | ✅ PASS | No staging/prod promotion, no blue-green beyond simple tag rollback, no notification editing/threading, no extra scanners. Everything maps to a spec requirement. |
| Tech stack (Node/Express, PostgreSQL, Docker) | ✅ PASS | Reuses existing Dockerfiles, `docker-compose`, and `npm run migrate`. Adds only CI-side tooling (Caddy, Trivy) that runs as containers/actions, not app dependencies. |
| Секреты через .env / secret store | ✅ PASS | App secrets in GitHub Actions secret store; VPS `.env` rendered at deploy; nothing committed. Extends the existing `.env.example` convention with CI-only secrets. |

**Result**: PASS — no violations. Complexity Tracking section left empty.

**Post-Phase-1 re-check**: PASS (design introduces no new violations; the only app-code change is a trivial public health endpoint required by FR-017).

## Project Structure

### Documentation (this feature)

```text
specs/016-ci-cd-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions
├── data-model.md        # Phase 1 output — pipeline/config entities
├── quickstart.md        # Phase 1 output — setup + validation runbook
├── contracts/           # Phase 1 output — interface contracts
│   ├── secrets-and-variables.md
│   ├── workflows.md
│   ├── slack-message.md
│   └── deploy-compose.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── pr-check.yml            # PR: build, lint, test, scan, version-bump gate
    └── deploy.yml              # push→main: build/push images, deploy, health, rollback, notify

scripts/ci/
├── check-version-bump.sh       # fail if deployable code changed without VERSION bump
├── summarize-commits.sh        # OpenRouter (OpenAI-compatible) → change summary (fallback: commit subjects)
├── notify-slack.sh             # post Block Kit message to Slack Incoming Webhook
├── deploy-remote.sh            # runs ON the VPS: render .env, pull, migrate, up, health, rollback
└── healthcheck.sh              # curl https://<domain>/healthz with retries

deploy/
├── docker-compose.prod.yml     # image: refs (CR) + caddy edge proxy; no build:
└── Caddyfile                   # <domain> { reverse_proxy frontend:80 } — auto TLS

VERSION                         # canonical release version (e.g. 1.1.0)

server/
├── app.js                      # + mount GET /healthz (unauthenticated, before /api/v1 auth guard)
└── routes/health.js            # new: DB ping → 200/503

client/
└── nginx.conf                  # + location /healthz → proxy_pass backend

Dockerfile, client/Dockerfile   # reused as-is for image builds
docker-compose.yml              # unchanged (local dev); prod uses deploy/docker-compose.prod.yml
```

**Structure Decision**: Web application (existing `server/` + `client/`) plus new infra directories `.github/workflows/`, `scripts/ci/`, and `deploy/`. Pipeline logic lives in small, testable shell scripts invoked by thin workflow YAML, keeping Actions files readable and the logic reusable/locally runnable (constitution: simplicity). The prod topology is a separate `deploy/docker-compose.prod.yml` so local `docker-compose.yml` (which builds locally) stays untouched.

## Complexity Tracking

> No constitution violations — section intentionally empty.
