# CI/CD (GitHub Actions)

Automated PR gating, delivery, and Slack notification for the omnius.team CRM.
Spec: [`specs/016-ci-cd-pipeline/`](../specs/016-ci-cd-pipeline/).

## Workflows

- **`.github/workflows/pr-check.yml`** — on every PR to `main`: builds backend + frontend,
  runs `oxlint`, runs tests where configured, Trivy vuln+secret scan (**hard-fails** on
  HIGH/CRITICAL), and enforces a `VERSION` bump when deployable code changes. Uses no
  deployment secrets.
- **`.github/workflows/deploy.yml`** — on push/merge to `main`: builds Docker images, pushes
  them to Selectel CR tagged with `VERSION`, deploys to the VPS over SSH (pull + migrate +
  `up -d`), health-checks `https://<domain>/healthz`, **auto-rolls-back** on failure, then
  posts one Slack message (status, version, stand URL, run link, AI change summary).

## Releasing

1. Make your change on a branch.
2. **Bump `VERSION`** (repo root, SemVer `X.Y.Z`) — the PR check fails otherwise for deployable
   changes. Never lower it; the registry rejects re-pushing an existing tag.
3. Open a PR → all four checks must be green.
4. Merge to `main` → `deploy.yml` builds, deploys, and notifies automatically.

## Configuration

Set GitHub **Secrets** and **Variables** per
[`specs/016-ci-cd-pipeline/contracts/secrets-and-variables.md`](../specs/016-ci-cd-pipeline/contracts/secrets-and-variables.md).
First-time VPS/registry setup: [`quickstart.md`](../specs/016-ci-cd-pipeline/quickstart.md).

## Operator notes

- **Migrations must be backward-compatible (FR-034).** Rollback restores the previous *image*
  but does **not** revert DB migrations. Write expand-then-contract migrations so a rolled-back
  image still works against the migrated schema. A breaking migration needs a coordinated manual
  release. If a rollback stays unhealthy, `deploy-remote.sh` exits with a
  "MANUAL INTERVENTION REQUIRED" message.
- **TLS** is automatic via Caddy + Let's Encrypt (`deploy/Caddyfile`). Keep the `caddy_data`
  volume intact across deploys to avoid ACME rate limits.
- **Secrets** live only in the GitHub secret store; the VPS `.env` is rendered fresh (mode 600)
  on each deploy and is never committed.
