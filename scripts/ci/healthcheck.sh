#!/usr/bin/env bash
# healthcheck.sh <url>
# Polls <url> until it returns HTTP 200, or fails after HEALTHCHECK_RETRIES attempts (FR-017).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
[ -f "$DIR/lib.sh" ] && . "$DIR/lib.sh" || {
  log()  { printf '[ci] %s\n' "$*" >&2; }
  warn() { printf '[ci:warn] %s\n' "$*" >&2; }
  die()  { printf '[ci:error] %s\n' "$*" >&2; exit 1; }
}

URL="${1:?usage: healthcheck.sh <url>}"
RETRIES="${HEALTHCHECK_RETRIES:-30}"
DELAY="${HEALTHCHECK_DELAY:-5}"

i=1
while [ "$i" -le "$RETRIES" ]; do
  code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$URL" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    log "healthy: $URL ($code) after $i attempt(s)"
    exit 0
  fi
  warn "attempt $i/$RETRIES: $URL → $code"
  i=$((i + 1))
  sleep "$DELAY"
done

die "unhealthy after $RETRIES attempts: $URL"
