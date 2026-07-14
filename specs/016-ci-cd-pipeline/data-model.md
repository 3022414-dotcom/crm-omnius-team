# Data Model: CI/CD Pipeline

**Feature**: 016-ci-cd-pipeline | **Date**: 2026-07-14

This feature has no database schema. Its "data" is pipeline/config state that flows between workflow steps and lives in version-controlled files. Entities below map the spec's Key Entities to concrete files/values.

---

## Persistent / version-controlled entities

### VERSION (Release Version)
- **Location**: `VERSION` file at repo root.
- **Format**: SemVer string, single line, no leading `v` (e.g. `1.1.0`).
- **Fields**: `version` (string).
- **Rules**:
  - MUST be a valid SemVer.
  - On a PR touching deployable paths, the value MUST be strictly greater than `origin/main`'s (FR-031).
  - Is the image tag and the Slack "version" (FR-011, FR-022, FR-030).
- **Transitions**: manually bumped per release → merged to main → becomes the deploy's `IMAGE_TAG`.

### Deploy Compose (Deployment topology)
- **Location**: `deploy/docker-compose.prod.yml` + `deploy/Caddyfile`.
- **Fields**: services `caddy`, `frontend`, `backend`, `postgres`; `image:` references (no `build:`) pinned by `${IMAGE_TAG}`; volumes for caddy `/data` (certs) and postgres data; `uploads` volume.
- **Rules**: app services reference `cr.selcloud.ru/<namespace>/crm-*:${IMAGE_TAG}`; caddy exposes `80` + `443`; backend/postgres not published to host.

### Workflow definitions (Pipeline)
- **Location**: `.github/workflows/pr-check.yml`, `.github/workflows/deploy.yml`.
- **Fields**: triggers, jobs, steps, `concurrency` group, secret/variable references.

---

## Runtime (ephemeral) entities

### Pipeline Run
- **Source**: a GitHub Actions run.
- **Fields**: `trigger` (pull_request | push-to-main), `status` (success | failure), `commit_range` (`before..after`), `version` (from VERSION), `run_url`, `started_at`, `ended_at`.
- **State**: queued → running → (success | failure). Failure is terminal for that run; deploy failures may include a rollback sub-state.

### Container Image
- **Fields**: `service` (crm-backend | crm-frontend), `tag` (= VERSION), `registry` (`cr.selcloud.ru/<namespace>`), `digest`.
- **Rules**: one image per service per release; tag immutable (duplicate-tag push is rejected).

### Deployment
- **Fields**: `version_deployed`, `previous_version` (rollback target), `stand_url` (`https://<domain>`), `migration_status` (applied | failed | none), `health_result` (healthy | unhealthy), `rollback_performed` (bool), `timestamp`.
- **Transitions**: render-env → pull → migrate → cutover(up) → health-check → (healthy ⇒ success | unhealthy ⇒ rollback → re-check → failure).

### Change Summary
- **Fields**: `commit_range`, `summary_text` (bulleted), `fallback` (bool — true when LLM path failed and commit subjects were used), `commit_count`.
- **Rules**: always produced (LLM or fallback); truncated for very large ranges.

### Notification
- **Fields**: `status_badge` (✅/❌), `version`, `stand_url`, `run_url`, `summary_body`, `channel` (bound to webhook).
- **Rules**: exactly one per delivery run (FR-026); notification failure never rolls back a successful deploy.

### Secret / Variable (see contracts/secrets-and-variables.md)
- **Fields**: `name`, `kind` (secret | variable), `scope` (pr | deploy | notify), `sensitivity`.

---

## Relationships

```
VERSION ──tag──> Container Image ──deployed as──> Deployment ──fronted by──> Edge Proxy (Caddy/TLS)
Pipeline Run ──produces──> {Container Image*, Deployment?, Change Summary, Notification}
Deployment ──previous_version──> (prior Container Image)   # rollback target
Change Summary ──derived from──> commit_range of Pipeline Run
```

## Validation rules summary

| Rule | Enforced by | Requirement |
|------|-------------|-------------|
| VERSION is valid SemVer & bumped on deployable change | `check-version-bump.sh` (PR check) | FR-031 |
| No HIGH/CRITICAL vuln or committed secret | Trivy (PR check) | FR-005 |
| Image tag == VERSION, immutable | build-push job + duplicate-tag guard | FR-011 |
| Migrations applied before cutover | `deploy-remote.sh` | FR-014 |
| Healthy `https://` stand before success | `healthcheck.sh` | FR-017, SC-009 |
| Auto-rollback on post-cutover health failure | `deploy-remote.sh` | FR-018, SC-008 |
| Exactly one Slack message per run | `notify` job (`if: always()`) | FR-026 |
| No secrets in logs/repo | secret store + masking | FR-016, SC-007 |
