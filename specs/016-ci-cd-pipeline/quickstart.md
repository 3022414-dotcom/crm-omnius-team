# Quickstart: CI/CD Pipeline

**Feature**: 016-ci-cd-pipeline — setup + validation runbook.

## 1. One-time setup

### 1.1 Selectel Container Registry
- Create/confirm a registry namespace (e.g. `omnius-crm`) at `cr.selcloud.ru`.
- Create a registry user/token → set `SELECTEL_CR_USERNAME` / `SELECTEL_CR_PASSWORD` secrets.

### 1.2 VPS
- Ensure Docker + docker-compose plugin installed, ports 80/443 open (Caddy needs both for ACME).
- Create a deploy user + dir `DEPLOY_PATH` (e.g. `/opt/crm`), authorize the CI public key.
- DNS `A` record for `DOMAIN` → VPS IP (already provisioned per spec).

### 1.3 GitHub secrets & variables
Set every entry from [contracts/secrets-and-variables.md](contracts/secrets-and-variables.md). Verify:
```bash
gh secret list && gh variable list
```

### 1.4 Seed VERSION
```bash
echo "1.0.0" > VERSION   # align with package.json; bump on every deployable PR thereafter
```

## 2. Files this feature adds

- `.github/workflows/pr-check.yml`, `.github/workflows/deploy.yml`
- `scripts/ci/{check-version-bump,summarize-commits,notify-slack,deploy-remote,healthcheck}.sh`
- `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`
- `VERSION`
- `server/routes/health.js` + `/healthz` mount in `server/app.js`; `/healthz` passthrough in `client/nginx.conf`

## 3. Validate PR check (User Story 1)

1. Branch, introduce a deliberate `oxlint` error in `client/` → open PR → **frontend** job red.
2. Change deployable code without bumping `VERSION` → **version-gate** red with a bump hint.
3. Add a fake AWS key to a file → **security** (Trivy secret scan) red.
4. Revert all, bump `VERSION` → all four jobs green, PR mergeable.
5. Docs-only PR (touch `specs/`) → green fast, no version bump required.

## 4. Validate deploy (User Story 2) — canary

1. Merge a trivial visible change + `VERSION` bump to `main`.
2. Watch `deploy.yml`: images pushed to CR tagged with the new `VERSION`; VPS pulls; migrations run; `up -d`; `https://<domain>/healthz` returns 200.
3. Browse `https://<domain>` — valid cert (no warning, SC-009), new version live.
4. **Rollback drill**: temporarily point health at a failing path (or deploy a knowingly-broken image tag in a scratch test) → confirm auto-rollback to previous tag restores health and the run is marked failed.

## 5. Validate notification (User Story 3)

1. After the canary deploy, confirm exactly one Slack message: ✅ badge, correct version, clickable stand URL, run link, and a bulleted AI summary of the commits.
2. Temporarily unset `OPENROUTER_API_KEY` (in a test run) → confirm the message still arrives with raw commit subjects (fallback, FR-025).
3. Force a deploy failure → confirm ❌ badge and "previous version still live".

## 6. Local dry-runs

All CI scripts run locally with the same env:
```bash
# version gate
scripts/ci/check-version-bump.sh origin/main

# change summary (needs OPENROUTER_API_KEY; without it → fallback)
BEFORE=HEAD~3 AFTER=HEAD scripts/ci/summarize-commits.sh

# slack (needs SLACK_WEBHOOK_URL) — post a test message
STATUS=success VERSION=$(cat VERSION) STAND_URL=https://crm.omnius.team scripts/ci/notify-slack.sh
```

## Operator notes

- **Migrations are not auto-reverted on rollback.** Write backward-compatible (expand-then-contract) migrations so a code rollback stays compatible with the migrated schema. If a release needs a breaking migration, coordinate manually.
- **Never lower `VERSION`.** The duplicate-tag guard rejects re-pushing an existing tag; bump forward to redeploy.
- **Cert rate limits**: keep the `caddy_data` volume; don't wipe it between deploys.
- **Secrets hygiene**: rotate `SSH_PRIVATE_KEY`, registry token, and `OPENROUTER_API_KEY` periodically; they exist only in GitHub's secret store.
