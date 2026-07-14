# scripts/ci

Shell glue for the CI/CD pipeline (feature 016-ci-cd-pipeline). Every script is
dependency-light (bash + coreutils, plus `curl`/`jq` where noted) and locally runnable.

| Script | Runs in | Purpose |
|--------|---------|---------|
| `lib.sh` | sourced | `log`/`warn`/`die`/`require_env`/`mask` helpers |
| `check-version-bump.sh <base-ref>` | PR check | Fail if deployable code changed without a `VERSION` bump (FR-031) |
| `summarize-commits.sh` | deploy notify | LLM changelog for `BEFORE..AFTER`; falls back to commit subjects (FR-023/FR-025) |
| `notify-slack.sh [summary-file]` | deploy notify | Post one Block Kit message to the Slack webhook (FR-020..FR-026) |
| `deploy-remote.sh` | **the VPS** | Render `.env`, pull, migrate, up, health-check, auto-rollback (FR-013..FR-018) |
| `healthcheck.sh <url>` | VPS / anywhere | Poll a URL until HTTP 200 (FR-017) |

## Local dry-runs

```bash
# Version gate against main
scripts/ci/check-version-bump.sh origin/main

# Change summary (needs OPENROUTER_API_KEY + jq; without the key → fallback subjects)
BEFORE=HEAD~3 AFTER=HEAD scripts/ci/summarize-commits.sh

# Post a test Slack message (needs SLACK_WEBHOOK_URL + jq)
STATUS=success VERSION=$(cat VERSION) STAND_URL=https://crm.omnius.team \
  RUN_URL=https://example/run COMMIT_RANGE=abc..def \
  scripts/ci/notify-slack.sh
```

`deploy-remote.sh` expects to run inside the VPS deploy dir (`$DEPLOY_PATH`) with
`docker-compose.prod.yml` + `Caddyfile` present and the deploy env vars set — the
`deploy.yml` workflow scp's it into `$DEPLOY_PATH/ci/` and invokes it over SSH.
