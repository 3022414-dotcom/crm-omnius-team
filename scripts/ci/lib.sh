#!/usr/bin/env bash
# scripts/ci/lib.sh — shared helpers for CI scripts. Sourced, not executed directly.
# Keep this dependency-free (bash + coreutils only) so it runs on GitHub runners and the VPS.

set -euo pipefail

log()  { printf '\033[0;36m[ci]\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[0;33m[ci:warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[0;31m[ci:error]\033[0m %s\n' "$*" >&2; exit 1; }

# require_env VAR...  — fail if any named environment variable is empty/unset.
require_env() {
  local missing=0 v
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then warn "missing required env: $v"; missing=1; fi
  done
  [ "$missing" -eq 0 ] || die "one or more required environment variables are missing"
}

# mask <secret>  — print a redacted form safe for logs (never print raw secrets).
mask() {
  local s="${1:-}"
  if [ "${#s}" -le 4 ]; then printf '****'; else printf '%s…****' "${s:0:2}"; fi
}
