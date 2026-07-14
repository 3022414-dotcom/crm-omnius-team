#!/usr/bin/env bash
# check-version-bump.sh <base-ref>
# Fails when a PR changes deployable code without incrementing the root VERSION file (FR-031).
# Docs/spec-only PRs are exempt. Requires full history (actions/checkout fetch-depth: 0).

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$DIR/lib.sh"

BASE_REF="${1:-origin/main}"

git rev-parse --verify "$BASE_REF" >/dev/null 2>&1 \
  || die "base ref '$BASE_REF' not found (ensure full history is fetched: fetch-depth: 0)"

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD 2>/dev/null || echo "$BASE_REF")"

# Paths whose change requires a VERSION bump (deployable code). VERSION itself is excluded.
DEPLOYABLE_REGEX='^(server/|client/|deploy/|Dockerfile$|package\.json$|package-lock\.json$)'

CHANGED="$(git diff --name-only "$MERGE_BASE"...HEAD || true)"
DEPLOYABLE_CHANGED="$(printf '%s\n' "$CHANGED" | grep -E "$DEPLOYABLE_REGEX" || true)"

if [ -z "$DEPLOYABLE_CHANGED" ]; then
  log "No deployable code changed — VERSION bump not required. OK."
  exit 0
fi

is_semver() { printf '%s' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; }

NEW_VERSION="$(tr -d ' \t\r\n' < VERSION 2>/dev/null || true)"
[ -n "$NEW_VERSION" ] || die "VERSION file missing or empty at repo root"
is_semver "$NEW_VERSION" || die "VERSION '$NEW_VERSION' is not valid SemVer (expected X.Y.Z)"

OLD_VERSION="$(git show "$MERGE_BASE:VERSION" 2>/dev/null | tr -d ' \t\r\n' || echo '')"
if [ -z "$OLD_VERSION" ]; then
  log "No previous VERSION on base — treating '$NEW_VERSION' as initial release. OK."
  exit 0
fi

# strictly-greater semver comparison via version sort
greater() {
  [ "$1" = "$2" ] && return 1
  local hi
  hi="$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n1)"
  [ "$hi" = "$1" ]
}

if greater "$NEW_VERSION" "$OLD_VERSION"; then
  log "VERSION bumped: $OLD_VERSION → $NEW_VERSION. OK."
  exit 0
fi

die "Deployable code changed but VERSION was not incremented (base=$OLD_VERSION, current=$NEW_VERSION). Bump the VERSION file (e.g. to a higher X.Y.Z)."
