---
description: "Task list for CI/CD Pipeline (GitHub Actions)"
---

# Tasks: CI/CD Pipeline (GitHub Actions)

**Input**: Design documents from `specs/016-ci-cd-pipeline/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No automated test suite is requested by this feature (backend/frontend have none; pipeline is validated via the quickstart canary + PR drills). No TDD tasks are generated. Validation tasks reference [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story (US1 PR-check → US2 deploy → US3 notify) so each slice is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (omitted for Setup, Foundational, Polish)
- Paths are repo-relative from `/Users/nivanov/Development/crm-omnius-team/`

## Path Conventions

Web app + infra: backend `server/`, frontend `client/`, CI `.github/workflows/`, glue `scripts/ci/`, prod topology `deploy/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the version-controlled scaffolding every slice references.

- [X] T001 Create CI/infra directory scaffolding: `.github/workflows/`, `scripts/ci/`, `deploy/` (add a `.gitkeep` where empty) per plan.md Project Structure
- [X] T002 [P] Create `VERSION` file at repo root seeded to `1.0.0` (aligns with `package.json`), single line, no leading `v` (FR-030, data-model.md → VERSION)
- [X] T003 [P] Create `.trivyignore` at repo root with a header comment explaining time-boxed, documented CVE exceptions (research.md D3)
- [X] T004 [P] Create `scripts/ci/lib.sh` with shared helpers: `log()`, `die()`, and a secret-masking guard; `chmod +x` all future `scripts/ci/*.sh`

**Checkpoint**: Repo has the empty pipeline skeleton and a canonical VERSION.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One-time GitHub/infra configuration required before deploy (US2) and notify (US3) can run. **US1 (PR-check) does NOT depend on this phase** and can proceed in parallel.

- [ ] T005 Configure GitHub Actions **variables** (`REGISTRY_HOST`, `REGISTRY_NAMESPACE`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DOMAIN`, `STAND_URL`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`) per contracts/secrets-and-variables.md (verify with `gh variable list`)
- [ ] T006 Configure GitHub Actions **secrets** (`SELECTEL_CR_USERNAME/PASSWORD`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `OPENROUTER_API_KEY`, `SLACK_WEBHOOK_URL`, `POSTGRES_USER/PASSWORD/DB`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`) per contracts/secrets-and-variables.md (verify with `gh secret list`)
- [ ] T007 [P] Provision VPS prerequisites (research.md D6, quickstart.md §1.2): deploy user + `DEPLOY_PATH`, authorized CI public key, ports 80/443 open, DNS A-record for `DOMAIN` → VPS IP (document only; no repo change)

**Checkpoint**: Secrets/variables exist and the VPS accepts the CI key. US2/US3 unblocked.

---

## Phase 3: User Story 1 — Automated PR validation (Priority: P1) 🎯 MVP

**Goal**: Every PR to `main` auto-builds backend+frontend, lints, runs tests-if-present, scans (hard-fail HIGH/CRITICAL vuln + committed secrets), and enforces a `VERSION` bump — results visible on the PR.

**Independent Test** (quickstart.md §3): open PRs that (a) fail oxlint, (b) change code without a VERSION bump, (c) commit a fake secret → each turns the right check red; a clean, bumped PR goes all-green; a docs-only PR is green without a bump.

**Depends on**: Phase 1 (VERSION, `.trivyignore`, `scripts/ci/lib.sh`). Independent of Phase 2.

- [X] T008 [P] [US1] Implement `scripts/ci/check-version-bump.sh <base-ref>`: compare root `VERSION` vs `origin/main`; require strictly-greater SemVer when deployable paths (`server/`, `client/`, `Dockerfile*`, `deploy/`, `package*.json`) changed; no-op for docs/spec-only; clear failure hint (FR-031, research.md D9)
- [X] T009 [US1] Create `.github/workflows/pr-check.yml` triggered on `pull_request → [main]` (opened/synchronize/reopened), `concurrency: pr-${{ github.ref }}` cancel-in-progress, permissions `contents: read` + `pull-requests: write`, NO deployment secrets (contracts/workflows.md, FR-001, FR-008)
- [X] T010 [P] [US1] Add `frontend` job to pr-check.yml: `npm ci` (client) → `npm run lint` (oxlint) → `npm run build` (vite) → `docker build client/` (FR-002, FR-003)
- [X] T011 [P] [US1] Add `backend` job to pr-check.yml: `npm ci` → lint step `if` script exists else log "skipped: no config" → test step `if` script exists else log "skipped" → `docker build .` (FR-002, FR-004, FR-007)
- [X] T012 [P] [US1] Add `security` job to pr-check.yml running `trivy fs --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 .` honoring `.trivyignore` (FR-005, research.md D3)
- [X] T013 [US1] Add `version-gate` job to pr-check.yml invoking `scripts/ci/check-version-bump.sh origin/main` with `fetch-depth: 0` checkout (FR-031)
- [ ] T014 [US1] Verify all four jobs surface pass/fail on the PR and configure branch protection on `main` to require them (FR-006); validate end-to-end per quickstart.md §3

**Checkpoint**: US1 is a shippable MVP — `main` is protected by automated PR gates, no deploy needed.

---

## Phase 4: User Story 2 — Automatic build & deploy on merge to main (Priority: P1)

**Goal**: Push to `main` builds+pushes images to Selectel CR tagged `VERSION`, then over SSH pulls on the VPS behind Caddy TLS, runs migrations, cuts over, health-checks `https://<domain>/healthz`, and auto-rolls-back on failure.

**Independent Test** (quickstart.md §4): merge a trivial change + VERSION bump → images in CR at that tag, VPS runs new version, valid HTTPS cert, `/healthz` 200; a knowingly-broken image auto-rolls-back and the run is marked failed.

**Depends on**: Phase 1 + Phase 2 (secrets/variables, VPS). Independent of US1 and US3.

### Health endpoint (prerequisite for the deploy health check — FR-017)

- [X] T015 [P] [US2] Create `server/routes/health.js`: unauthenticated `GET /healthz` doing a DB ping (`SELECT 1`) → `200 {"status":"ok"}` or `503` (research.md D7)
- [X] T016 [US2] Mount `/healthz` in `server/app.js` **before** the `app.use('/api/v1', ensureAuthenticated)` guard (research.md D7, contracts/deploy-compose.md)
- [X] T017 [P] [US2] Add `location /healthz { proxy_pass http://backend:3000; }` to `client/nginx.conf` so the edge can reach it (contracts/deploy-compose.md)

### Deploy topology (edge proxy + prod compose)

- [X] T018 [P] [US2] Create `deploy/Caddyfile`: `{$DOMAIN} { reverse_proxy frontend:80 }` for automatic Let's Encrypt (FR-032, FR-033)
- [X] T019 [US2] Create `deploy/docker-compose.prod.yml`: services `caddy` (ports 80/443, volumes `caddy_data:/data`,`caddy_config:/config`, Caddyfile mount), `frontend`/`backend` using `image: ${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/crm-*:${IMAGE_TAG}` (no `build:`), `postgres:15-alpine` with `postgres_data` + `pg_isready` healthcheck, `uploads` volume. Wire `backend.environment.DATABASE_URL` derived from `POSTGRES_*` (mirror root `docker-compose.yml`) and `env_file: .env` (FR-013, U1, contracts/deploy-compose.md)

### Remote deploy script (runs ON the VPS)

- [X] T020 [P] [US2] Implement `scripts/ci/healthcheck.sh <url>`: curl with ret/backoff retries, non-zero on persistent non-2xx (FR-017)
- [X] T021 [US2] Implement `scripts/ci/deploy-remote.sh`: render `.env` from injected env (FR-015/FR-016), record `PREVIOUS_TAG`, `compose pull`, `compose run --rm backend npm run migrate` (FR-014, halt on failure), `compose up -d`, call `healthcheck.sh $STAND_URL/healthz`; on failure re-`up -d` with `PREVIOUS_TAG` + re-check then exit non-zero. If the rollback re-check is **still unhealthy** (incompatible migration, FR-034), exit non-zero with a distinct "manual intervention required" message (FR-018, SC-008, research.md D6)

### Deploy workflow

- [X] T022 [US2] Create `.github/workflows/deploy.yml` on `push → [main]`, `concurrency: { group: deploy-main, cancel-in-progress: false }`, permissions `contents: read` (FR-009, FR-019)
- [X] T023 [US2] Add `build-push` job: read `VERSION`→`IMAGE_TAG` (output), duplicate-tag guard against the registry (fail if tag exists — Edge Case), `docker login $REGISTRY_HOST`, buildx build+push `crm-backend`/`crm-frontend:$IMAGE_TAG` (FR-010, FR-011, FR-012)
- [X] T024 [US2] Add `deploy` job (needs build-push): load `SSH_PRIVATE_KEY`+`SSH_KNOWN_HOSTS`, `scp deploy/` to `$DEPLOY_PATH`, `ssh` run `deploy-remote.sh` passing `IMAGE_TAG`, `REGISTRY_*`, `DOMAIN`, `STAND_URL` and all app `.env` secrets; expose `deploy_status` output (FR-013, FR-015, contracts/workflows.md)
- [ ] T025 [US2] Validate deploy + rollback end-to-end per quickstart.md §4 (canary deploy, cert check SC-009, rollback drill SC-008)

**Checkpoint**: Merges to `main` auto-deploy to a healthy HTTPS stand with rollback safety.

---

## Phase 5: User Story 3 — Slack notification with AI change summary (Priority: P2)

**Goal**: After each `main` delivery run, post exactly one Slack message (Incoming Webhook) with success/failure badge, version, stand URL, run link, and an LLM-generated change summary (fallback to commit subjects).

**Independent Test** (quickstart.md §5): a canary deploy yields one message with ✅, correct version, clickable stand URL, and a bulleted summary; unsetting `OPENROUTER_API_KEY` still delivers with raw subjects; a forced failure shows ❌.

**Depends on**: Phase 2 (secrets) + US2 (the `deploy.yml` run + its `deploy_status`/commit range). Independent of US1.

- [X] T026 [P] [US3] Implement `scripts/ci/summarize-commits.sh` using `BEFORE..AFTER`: `git log` → single `curl` to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`, OpenAI-compatible, model `anthropic/claude-haiku-4.5`) via `OPENROUTER_API_KEY`, parse `.choices[0].message.content`, truncate large ranges; **handle the first-push case where `BEFORE` is the all-zero SHA / invalid range by falling back to the last N commits** (U2); on any error/missing key/empty output emit raw commit subjects with a `fallback` marker (FR-023, FR-025, research.md D4)
- [X] T027 [P] [US3] Implement `scripts/ci/notify-slack.sh`: build Block Kit payload (badge/version/stand/run/summary) per contracts/slack-message.md and `POST $SLACK_WEBHOOK_URL`; non-2xx is logged, never fatal (FR-020, FR-021, FR-022, FR-024, FR-026)
- [X] T028 [US3] Add `notify` job to `.github/workflows/deploy.yml` (needs `deploy`, `if: always()`): compute `${{ github.event.before }}..${{ github.sha }}`, run `summarize-commits.sh` then `notify-slack.sh` with the deploy status; exactly one message, does not fail a green deploy (FR-026)
- [ ] T029 [US3] Validate notification paths end-to-end per quickstart.md §5 (success, fallback, failure)

**Checkpoint**: The team channel reflects every deployment with a readable AI summary.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, docs, and full-flow verification.

- [X] T030 [P] Add a CI/CD section to project docs (`docs/` or `README`): how to bump `VERSION`, secrets/variables list, deploy/rollback flow, and the **FR-034** "migrations MUST be backward-compatible (expand-then-contract) / not auto-reverted on rollback" operator rule (quickstart.md Operator notes)
- [X] T031 [P] Confirm no secret leakage: review workflow logs use masking, `set -x` avoided around secret rendering, `.env` written with `600` on the VPS (FR-016, SC-007)
- [X] T032 [P] Ensure `scripts/ci/*.sh` are all executable and locally runnable with documented env (quickstart.md §6) — add a short `scripts/ci/README.md`
- [ ] T033 Full end-to-end verification: run the complete quickstart (§3 PR drills, §4 canary+rollback, §5 notification) and confirm SC-001…SC-009 hold; **record the merge→live wall-clock and assert it is under 15 min (SC-004)** and the notification arrival under 2 min (SC-005); record results

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Ph1)** → blocks everything (VERSION, dirs, lib).
- **Foundational (Ph2)** → blocks US2 + US3 (secrets/VPS). **Does NOT block US1.**
- **US1 (Ph3)** → depends only on Ph1. Ship independently (MVP).
- **US2 (Ph4)** → depends on Ph1 + Ph2.
- **US3 (Ph5)** → depends on Ph2 + US2 (`deploy.yml` + commit range/status).
- **Polish (Ph6)** → after the stories it documents/verifies.

### Story completion order

```
Setup ─┬─────────────► US1 (PR-check)  ──► shippable MVP
       │
Foundational ─┬──────► US2 (deploy) ──► US3 (notify) ──► Polish
              └ (VPS/secrets)
```

### Parallel opportunities

- **Within Setup**: T002, T003, T004 in parallel [P].
- **US1 jobs**: T010, T011, T012 in parallel [P] after T009 scaffolds the workflow; T008 in parallel with T009.
- **US2**: health tasks T015/T017 and topology T018 in parallel [P]; T020 parallel with topology; then T021 → T019/topology feeds T024.
- **US3**: T026 and T027 in parallel [P], then T028 wires them.
- **Cross-story**: US1 (Ph3) can be built entirely in parallel with Ph2 setup for US2/US3.
- **Polish**: T030, T031, T032 in parallel [P]; T033 last.

---

## Implementation Strategy

### MVP first

1. Complete **Phase 1 (Setup)** + **Phase 3 (US1)** → deliver PR gating on `main`. This alone protects the branch and is independently valuable (no prod credentials needed).
2. Complete **Phase 2 (Foundational)** + **Phase 4 (US2)** → automated deploy on merge with rollback + HTTPS.
3. Add **Phase 5 (US3)** → team notifications.
4. **Phase 6 (Polish)** → docs, leakage review, full SC verification.

### Independent test criteria (recap)

- **US1**: PR drills (lint fail, version-gate fail, secret scan fail, clean-green, docs-only green) — quickstart §3.
- **US2**: canary deploy live over HTTPS + rollback drill — quickstart §4.
- **US3**: one Slack message (success), fallback summary, failure badge — quickstart §5.

**Total tasks**: 33 (Setup 4 · Foundational 3 · US1 7 · US2 11 · US3 4 · Polish 4).
