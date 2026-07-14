# Contract: Production Deploy Topology

**Feature**: 016-ci-cd-pipeline | **Files**: `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`

Defines the runtime topology on the VPS. App services use `image:` (pulled from CR) — never `build:` (FR-013).

## Services

| Service | Image / Build | Ports (host) | Notes |
|---------|---------------|--------------|-------|
| `caddy` | `caddy:2-alpine` | `80`, `443` | Edge TLS via Let's Encrypt; reverse_proxy → `frontend:80`. Volumes: `caddy_data:/data`, `caddy_config:/config`, `./Caddyfile:/etc/caddy/Caddyfile`. |
| `frontend` | `${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/crm-frontend:${IMAGE_TAG}` | — (internal) | nginx SPA + proxy to backend (existing `client/nginx.conf` + `/healthz` passthrough). |
| `backend` | `${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/crm-backend:${IMAGE_TAG}` | — (internal) | Express; reads `.env`; `uploads` volume. |
| `postgres` | `postgres:15-alpine` | — (internal) | Named volume `postgres_data`; healthcheck `pg_isready`. |

## Caddyfile (shape)

```
{$DOMAIN} {
    reverse_proxy frontend:80
}
```

Caddy obtains + renews the certificate automatically (FR-033). `caddy_data` volume persists certs across redeploys to avoid ACME rate limits.

## Environment contract

- `IMAGE_TAG` (= VERSION), `REGISTRY_HOST`, `REGISTRY_NAMESPACE`, `DOMAIN` come from the deploy job env / VPS `.env`.
- App runtime `.env` (rendered by `deploy-remote.sh`) provides `DATABASE_URL` (from `POSTGRES_*`), `GOOGLE_*`, `SESSION_SECRET`, `PORT`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL`.

## Health contract (FR-017)

- `GET https://${DOMAIN}/healthz` → `200 {"status":"ok"}` when backend + DB are up; `503` otherwise.
- Path routing: Caddy → nginx (`location /healthz`) → `backend:3000/healthz` (unauthenticated, mounted before the `/api/v1` auth guard).

## Rollback contract (FR-018)

- `deploy-remote.sh` keeps `PREVIOUS_TAG`. On health failure it re-runs `up -d` with `IMAGE_TAG=$PREVIOUS_TAG`. DB migrations are **not** reverted (migrations must be backward-compatible — see quickstart operator note).
