# Contract: GitHub Secrets & Variables

**Feature**: 016-ci-cd-pipeline

All values are referenced by name in workflows; nothing is committed (FR-028). Set under **Repo → Settings → Secrets and variables → Actions**.

## Secrets (encrypted, masked in logs)

| Name | Scope | Used by | Purpose |
|------|-------|---------|---------|
| `SELECTEL_CR_USERNAME` | deploy | build-push | Login to `cr.selcloud.ru` |
| `SELECTEL_CR_PASSWORD` | deploy | build-push | Registry password/token |
| `SSH_PRIVATE_KEY` | deploy | deploy | Key-based SSH to the VPS |
| `SSH_KNOWN_HOSTS` | deploy | deploy | Pin VPS host key (avoid MITM / prompt) |
| `OPENROUTER_API_KEY` | notify | notify | OpenRouter API (OpenAI-compatible) for the LLM change summary |
| `SLACK_WEBHOOK_URL` | notify | notify | Slack Incoming Webhook endpoint |
| `POSTGRES_USER` | deploy | deploy (`.env`) | App DB user |
| `POSTGRES_PASSWORD` | deploy | deploy (`.env`) | App DB password |
| `POSTGRES_DB` | deploy | deploy (`.env`) | App DB name |
| `SESSION_SECRET` | deploy | deploy (`.env`) | Express session secret |
| `GOOGLE_CLIENT_ID` | deploy | deploy (`.env`) | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | deploy | deploy (`.env`) | Google OAuth |

> `DATABASE_URL` is derived on the VPS from `POSTGRES_*` (as in the current `docker-compose.yml`), so it need not be stored separately.

## Variables (non-sensitive, may appear in logs)

| Name | Example | Used by | Purpose |
|------|---------|---------|---------|
| `REGISTRY_HOST` | `cr.selcloud.ru` | build-push, deploy | Registry host |
| `REGISTRY_NAMESPACE` | `omnius-crm` | build-push, deploy | Registry namespace/project |
| `DEPLOY_HOST` | `203.0.113.10` | deploy | VPS host/IP |
| `DEPLOY_USER` | `deploy` | deploy | SSH user |
| `DEPLOY_PATH` | `/opt/crm` | deploy | Dir holding prod compose on VPS |
| `DOMAIN` | `crm.omnius.team` | deploy, caddy | Public domain (TLS + health) |
| `STAND_URL` | `https://crm.omnius.team` | deploy, notify | Health target + Slack link |
| `GOOGLE_CALLBACK_URL` | `https://crm.omnius.team/auth/google/callback` | deploy (`.env`) | OAuth callback |
| `FRONTEND_URL` | `https://crm.omnius.team` | deploy (`.env`) | App CORS/redirects |

## Scope rules (FR-008)

- **PR-check workflow** references **none** of the above secrets. It runs on `pull_request` and must function for forked PRs; GitHub does not expose secrets to fork PRs by default, which is the desired behavior.
- **deploy/notify workflows** run only on `push` to `main` (trusted context) and may read all secrets.
