# Research: CI/CD Pipeline

**Feature**: 016-ci-cd-pipeline | **Date**: 2026-07-14

Resolves the open technical choices left as assumptions in the spec. Each decision favors the constitution's "простота прежде всего" and YAGNI.

---

## D1. CI/CD platform

- **Decision**: GitHub Actions, workflows in `.github/workflows/`.
- **Rationale**: Repo is hosted on GitHub ("на базе github"); native PR checks, `push` triggers, encrypted secrets/variables, and `concurrency` groups cover every requirement with zero extra infra.
- **Alternatives**: GitLab CI / Drone / self-hosted Jenkins — rejected (not where the code lives; more ops for a 4-person team).

## D2. Edge reverse proxy + automatic TLS

- **Decision**: **Caddy 2** as an edge container in `deploy/docker-compose.prod.yml`, reverse-proxying the domain to `frontend:80`. A two-line `Caddyfile` gives automatic Let's Encrypt issuance + renewal.
- **Rationale**: Caddy auto-manages certs (HTTP/TLS-ALPN challenge) with no cron, no certbot, no manual renewal — directly satisfies FR-032/FR-033 and SC-009 with the least config. The existing frontend nginx already routes `/api`, `/auth`, `/uploads` to the backend, so Caddy only needs one upstream.
- **Alternatives**:
  - *Traefik* — powerful but label/config-heavy; overkill for one domain, one upstream.
  - *nginx + certbot* — requires a renewal cron and reload wiring; more moving parts.
  - *nginx-proxy + acme-companion* — two extra containers vs. Caddy's one.
- **Cert persistence**: Caddy's `/data` volume is a named Docker volume so certs survive redeploys (avoids Let's Encrypt rate limits — see Edge Case "TLS renewal fails").

## D3. Security scanning tool

- **Decision**: **Trivy** filesystem scan: `trivy fs --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 .` in the PR check.
- **Rationale**: One tool covers both required scan types (dependency vulnerabilities via lockfiles + committed-secret detection). Hard-fails on HIGH/CRITICAL per the clarification. Optional second pass `trivy image` on built images where time allows.
- **Alternatives**: `npm audit` (deps only, noisy, no secret scan) + `gitleaks` (secrets only) — two tools for what Trivy does in one. `npm audit` may still be run as a cheap first signal but is not the gate.
- **Config**: A `.trivyignore` file allows documented, time-boxed exceptions so an unfixable transitive CVE doesn't permanently block merges (keeps the hard-fail gate practical).

## D4. LLM for commit summarization

- **Decision**: **OpenRouter** (the team's standard for such tasks), OpenAI-compatible Chat Completions API, model `anthropic/claude-haiku-4.5`, called via a single `curl` to `https://openrouter.ai/api/v1/chat/completions` from `scripts/ci/summarize-commits.sh`. Input = commit subjects for the deployed range; output = a short bulleted change summary. `OPENROUTER_API_KEY` stored as a GitHub secret.
- **Rationale**: The team already provisions an OpenRouter key for LLM tasks — one billing/relationship to manage. OpenRouter is OpenAI-compatible (`Authorization: Bearer`, `.choices[0].message.content`); Haiku via OpenRouter is fast and cheap. No SDK/runtime added — just `curl` + `jq`.
- **Fallback (FR-025)**: On any non-200, timeout, missing key, or empty output, the script emits the raw commit subject list so the notification is never dropped.
- **Commit range**: `git log <before>..<after>` where `before`/`after` come from the push event (`github.event.before` / `github.sha`); for the first push or a forced range, fall back to the last N commits. Large ranges are truncated (cap on commits) before sending to the LLM.
- **Alternatives**: Anthropic API directly — rejected (team standardizes LLM access on OpenRouter). GitHub "generate release notes" — no natural-language summary, just PR titles.

## D5. Registry layout & image tagging

- **Decision**: Selectel CR host `cr.selcloud.ru`; images `cr.selcloud.ru/<namespace>/crm-backend:<VERSION>` and `crm-frontend:<VERSION>`. Also push a moving `:latest`-style pointer is **not** required; the prod compose pins the exact `<VERSION>` tag via an env var. Login via `docker login cr.selcloud.ru` using `SELECTEL_CR_USERNAME`/`SELECTEL_CR_PASSWORD` secrets.
- **Rationale**: `VERSION`-file tag is the single source of truth (FR-011/FR-030); because `VERSION` is bumped every release, tags are immutable and the previous tag is always available as a rollback target.
- **Duplicate-tag guard (Edge Case)**: before push, query the registry for the tag; if it already exists, fail the deploy with a clear message rather than overwriting a prior release image.
- **Alternatives**: commit-SHA tags — rejected by clarification in favor of the `VERSION` file. `latest`-only — rejected (no rollback/traceability).

## D6. Deploy mechanism, migrations, rollback

- **Decision**: `deploy.yml` SSHes to the VPS and runs `scripts/ci/deploy-remote.sh` with `IMAGE_TAG=<VERSION>`:
  1. Render `.env` on the VPS from GitHub secrets (idempotent).
  2. Record current tag as `PREVIOUS_TAG` (from the running compose/`.env`).
  3. `docker compose -f docker-compose.prod.yml pull`.
  4. Run migrations: `docker compose run --rm backend npm run migrate` (uses the new image against the DB) — **before** cutover.
  5. `docker compose up -d` (cutover).
  6. Health check `https://<domain>/healthz` with retries.
  7. On health failure: set `IMAGE_TAG=$PREVIOUS_TAG`, `docker compose up -d` (rollback), re-check, then exit non-zero.
- **Rationale**: Matches the clarified pull-based deploy + auto-rollback. Migrations run against the new image before cutover so schema and code move together; a migration failure halts before cutover (Edge Case "Migration failure").
- **Concurrency (FR-019)**: `deploy.yml` uses `concurrency: { group: deploy-main, cancel-in-progress: false }` so overlapping merges serialize; the last completed run defines final state.
- **Migration-rollback caveat**: DB migrations are **not** auto-reverted on rollback (destructive down-migrations are risky). The image rolls back; migrations are expected to be backward-compatible. This is documented in quickstart.md as an operator note. *(Acceptable for a 4-person internal tool; revisit if expand-contract migrations become necessary.)*
- **Alternatives**: build-on-VPS (rejected by clarification); Kubernetes/Swarm (violates simplicity/YAGNI); blue-green with two live stacks (overkill for one small stand).

## D7. Health endpoint

- **Decision**: Add unauthenticated `GET /healthz` to the backend (mounted **before** the `/api/v1` auth guard) that pings the DB (`SELECT 1`) and returns `200 {status:"ok"}` or `503`. Expose it through nginx (`location /healthz → backend`). Deploy health check curls `https://<domain>/healthz`.
- **Rationale**: `/api/v1/*` is behind `ensureAuthenticated`, so it can't serve an anonymous health probe. A dedicated `/healthz` gives a meaningful end-to-end signal (edge TLS → nginx → backend → DB). Minimal, standard.
- **Alternatives**: probing `/` (frontend only — doesn't prove backend/DB); relying on a `401` from `/api/v1/...` as "alive" (hacky, conflates auth with health).

## D8. App runtime secret delivery

- **Decision**: App runtime secrets (`DATABASE_URL`/`POSTGRES_*`, `GOOGLE_*`, `SESSION_SECRET`, `FRONTEND_URL`) live in GitHub Actions secrets. The deploy job passes them over SSH and `deploy-remote.sh` writes/overwrites the VPS `.env` each deploy.
- **Rationale**: Satisfies FR-015 (injected from a secure store) and FR-016 (nothing in repo) with a single source of truth. Re-rendering each deploy keeps the VPS in sync and avoids drift.
- **Alternatives**: pre-provision `.env` once on the VPS by hand (drifts, not "from secure store"); a secrets manager like Vault (over-engineered for 4 people).

## D9. PR-check graceful degradation & version-bump gate

- **Decision**: PR check uses path filters. Lint/test steps run only when config/scripts exist (frontend `oxlint`/`vite build` always; backend lint/test steps are `if`-guarded and log "skipped: no config"). `check-version-bump.sh` compares `VERSION` against `origin/main`; it **requires** a strictly-greater semver bump when the PR touches deployable paths (`server/`, `client/`, `Dockerfile*`, `deploy/`, `package*.json`), and is a no-op for docs/spec-only PRs.
- **Rationale**: Implements FR-007 (neutral skips) and FR-031 (bump enforcement) without failing on the current absence of backend tests/linters.
- **Alternatives**: mandatory bump on every PR (annoys on docs-only changes); auto-bumping VERSION in CI (hides the decision, races on concurrent PRs).

---

## Open items deferred to implementation/tasks (non-blocking)

- Exact Selectel CR `<namespace>` and VPS `DOMAIN`/`DEPLOY_*` values → provided as GitHub **variables** at setup time (quickstart.md), not hard-coded.
- Whether to also run `trivy image` on built images (nice-to-have; gated on runtime budget for SC-004).
- Initial `VERSION` value seeding (e.g., `1.0.0` matching `package.json`).
