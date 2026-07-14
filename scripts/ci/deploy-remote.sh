#!/usr/bin/env bash
# deploy-remote.sh — runs ON the VPS (invoked over SSH by .github/workflows/deploy.yml).
# Renders .env from injected env, pulls the release images, runs migrations before cutover,
# brings the stack up, health-checks the public stand, and auto-rolls-back on failure.
# (FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-034, SC-008)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
[ -f "$SCRIPT_DIR/lib.sh" ] && . "$SCRIPT_DIR/lib.sh" || {
  log()  { printf '[ci] %s\n' "$*" >&2; }
  warn() { printf '[ci:warn] %s\n' "$*" >&2; }
  die()  { printf '[ci:error] %s\n' "$*" >&2; exit 1; }
}

# The deploy dir holds docker-compose.prod.yml + Caddyfile; this script lives in ./ci.
DEPLOY_PATH="${DEPLOY_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$DEPLOY_PATH"

COMPOSE="docker compose -f docker-compose.prod.yml"

REQUIRED=(IMAGE_TAG REGISTRY_HOST REGISTRY_NAMESPACE DOMAIN STAND_URL \
  POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SESSION_SECRET \
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_CALLBACK_URL FRONTEND_URL)
for v in "${REQUIRED[@]}"; do [ -n "${!v:-}" ] || die "missing required env: $v"; done

# 1. Render .env (0600 — never world-readable, never committed) (FR-015/FR-016).
log "Rendering .env"
umask 077
cat > .env <<EOF
NODE_ENV=production
PORT=${PORT:-3000}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
SESSION_SECRET=${SESSION_SECRET}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL}
FRONTEND_URL=${FRONTEND_URL}
REGISTRY_HOST=${REGISTRY_HOST}
REGISTRY_NAMESPACE=${REGISTRY_NAMESPACE}
DOMAIN=${DOMAIN}
IMAGE_TAG=${IMAGE_TAG}
EOF

# 2. Record the currently deployed tag (rollback target).
PREVIOUS_TAG=""
[ -f .deployed_tag ] && PREVIOUS_TAG="$(cat .deployed_tag)"
log "Deploying ${IMAGE_TAG} (previous: ${PREVIOUS_TAG:-<none>})"

HEALTH_URL="${STAND_URL%/}/healthz"

# 3. Pull → migrate (before cutover) → up.
IMAGE_TAG="$IMAGE_TAG" $COMPOSE pull || die "image pull failed for ${IMAGE_TAG}"
# Migrations run against the NEW image before it serves traffic (FR-014). Halt on failure.
IMAGE_TAG="$IMAGE_TAG" $COMPOSE run --rm backend npm run migrate \
  || die "database migration failed for ${IMAGE_TAG} — deploy halted before cutover"
IMAGE_TAG="$IMAGE_TAG" $COMPOSE up -d || die "compose up failed for ${IMAGE_TAG}"

# 4. Post-deploy health check.
if bash "$SCRIPT_DIR/healthcheck.sh" "$HEALTH_URL"; then
  echo "$IMAGE_TAG" > .deployed_tag
  log "Deploy OK: ${IMAGE_TAG} is healthy at ${HEALTH_URL}"
  exit 0
fi

warn "Health check FAILED for ${IMAGE_TAG} — attempting rollback"

# 5. Auto-rollback to the previous release tag (FR-018, SC-008).
if [ -z "$PREVIOUS_TAG" ] || [ "$PREVIOUS_TAG" = "$IMAGE_TAG" ]; then
  die "No previous tag to roll back to (first deploy?). MANUAL INTERVENTION REQUIRED."
fi

warn "Rolling back to ${PREVIOUS_TAG}"
# Note: DB migrations are NOT reverted — this only works if migrations are
# backward-compatible with ${PREVIOUS_TAG}'s image (FR-034).
IMAGE_TAG="$PREVIOUS_TAG" $COMPOSE up -d \
  || die "rollback 'up' failed for ${PREVIOUS_TAG}. MANUAL INTERVENTION REQUIRED."

if bash "$SCRIPT_DIR/healthcheck.sh" "$HEALTH_URL"; then
  echo "$PREVIOUS_TAG" > .deployed_tag
  die "Deploy of ${IMAGE_TAG} failed; rolled back to ${PREVIOUS_TAG} (healthy). Run marked FAILED."
else
  die "Deploy of ${IMAGE_TAG} failed AND rollback to ${PREVIOUS_TAG} stayed unhealthy (incompatible migration? FR-034). MANUAL INTERVENTION REQUIRED."
fi
