# Contract: GitHub Actions Workflows

**Feature**: 016-ci-cd-pipeline

Two workflows. Thin YAML that calls `scripts/ci/*` so logic is locally runnable.

---

## `pr-check.yml`

- **Trigger**: `pull_request` → `[main]` (types: opened, synchronize, reopened).
- **Concurrency**: `group: pr-${{ github.ref }}`, `cancel-in-progress: true`.
- **Permissions**: `contents: read`, `pull-requests: write` (for status/annotations). No deployment secrets.
- **Jobs** (parallel where possible):

| Job | Steps (contract) | Fails when |
|-----|------------------|------------|
| `frontend` | `npm ci` (client) → `npm run lint` (oxlint) → `npm run build` (vite) → `docker build client/` | lint violation, build error |
| `backend` | `npm ci` → *lint if script exists else skip-log* → *test if script exists else skip-log* → `docker build .` | build/test/lint error where configured |
| `security` | `trivy fs --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 .` (honors `.trivyignore`) | any HIGH/CRITICAL vuln or committed secret (FR-005) |
| `version-gate` | `scripts/ci/check-version-bump.sh origin/main` | deployable paths changed without a strictly-greater `VERSION` (FR-031) |

- **Exit contract**: PR is mergeable only when all four jobs are green (FR-006). Skipped-by-absence steps are neutral, not failures (FR-007).

---

## `deploy.yml`

- **Trigger**: `push` → `[main]`.
- **Concurrency**: `group: deploy-main`, `cancel-in-progress: false` (serialize deployments — FR-019).
- **Permissions**: `contents: read`.
- **Jobs** (sequential; `notify` runs `if: always()`):

### `build-push`
- Read `VERSION` → `IMAGE_TAG`.
- Duplicate-tag guard: query registry; fail if `crm-backend:$IMAGE_TAG` already exists.
- `docker login $REGISTRY_HOST`.
- Build + push `crm-backend:$IMAGE_TAG` and `crm-frontend:$IMAGE_TAG`.
- **Outputs**: `image_tag`.

### `deploy` (needs build-push)
- `webfactory/ssh-agent`-style key load from `SSH_PRIVATE_KEY` + `SSH_KNOWN_HOSTS`.
- `scp` `deploy/` files to `$DEPLOY_PATH`.
- `ssh $DEPLOY_USER@$DEPLOY_HOST` → run `deploy-remote.sh` with env: `IMAGE_TAG`, `REGISTRY_*`, `DOMAIN`, and all app `.env` secrets.
- `deploy-remote.sh` sequence: render `.env` → record `PREVIOUS_TAG` → `compose pull` → `compose run --rm backend npm run migrate` → `compose up -d` → `healthcheck.sh $STAND_URL/healthz` → on failure roll back to `PREVIOUS_TAG` + re-check, then exit non-zero.
- **Outputs**: `deploy_status` (success|failure|rolled_back).

### `notify` (needs deploy, `if: always()`)
- Compute range `${{ github.event.before }}..${{ github.sha }}`.
- `summarize-commits.sh` → summary (or fallback subjects).
- `notify-slack.sh` posts one message with status, `VERSION`, `STAND_URL`, run URL, summary (contract in slack-message.md).
- Notify failure does **not** fail a successful deploy (FR-026).

---

## Local-run contract

Every `scripts/ci/*.sh` MUST be runnable locally with the same env vars (documented in quickstart.md), so pipeline logic can be tested without pushing.
