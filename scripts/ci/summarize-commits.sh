#!/usr/bin/env bash
# summarize-commits.sh
# Prints a short, human-readable change summary for the deployed commit range to stdout.
# Uses OpenRouter (OpenAI-compatible Chat Completions API), model anthropic/claude-3.5-haiku;
# falls back to raw commit subjects on any error, missing key, or empty output (FR-023, FR-025, research D4).
#
# Env: BEFORE, AFTER (commit range), OPENROUTER_API_KEY, optional MAX_COMMITS.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$DIR/lib.sh"

BEFORE="${BEFORE:-}"
AFTER="${AFTER:-HEAD}"
MAX_COMMITS="${MAX_COMMITS:-30}"
ZERO_SHA="0000000000000000000000000000000000000000"

# Resolve a usable log range; handle the first-push / unknown-before case (U2).
if [ -n "$BEFORE" ] && [ "$BEFORE" != "$ZERO_SHA" ] && git rev-parse --verify "$BEFORE" >/dev/null 2>&1; then
  SUBJECTS="$(git log --no-merges --pretty=format:'- %s' "${BEFORE}..${AFTER}" 2>/dev/null | head -n "$MAX_COMMITS" || true)"
else
  warn "no valid BEFORE ref — using last ${MAX_COMMITS} commits"
  SUBJECTS="$(git log --no-merges --pretty=format:'- %s' -n "$MAX_COMMITS" 2>/dev/null || true)"
fi
[ -n "$SUBJECTS" ] || SUBJECTS="- (no commits found for range)"

fallback() {
  printf '(commit subjects — AI summary unavailable)\n%s\n' "$SUBJECTS"
}

if [ -z "${OPENROUTER_API_KEY:-}" ]; then warn "no OPENROUTER_API_KEY; using fallback"; fallback; exit 0; fi
command -v curl >/dev/null 2>&1 || { warn "curl missing; fallback"; fallback; exit 0; }
command -v jq   >/dev/null 2>&1 || { warn "jq missing; fallback"; fallback; exit 0; }

PROMPT="Summarize these git commits into a short, human-readable changelog for a Slack deploy notification. Use 3-8 concise bullet points grouped by theme. Focus on user-facing and notable changes. Respond with only the bullet list.

Commits:
${SUBJECTS}"

REQ="$(jq -n --arg m "anthropic/claude-3.5-haiku" --arg p "$PROMPT" \
  '{model:$m, max_tokens:400, messages:[{role:"user", content:$p}]}')"

# OpenRouter is OpenAI-compatible: Bearer auth, /chat/completions, .choices[0].message.content
RESP="$(curl -sS --max-time 30 https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
  -H "content-type: application/json" \
  -d "$REQ" 2>/dev/null || echo '')"

TEXT="$(printf '%s' "$RESP" | jq -r '.choices[0].message.content // empty' 2>/dev/null || true)"

if [ -n "$TEXT" ]; then
  printf '%s\n' "$TEXT"
else
  warn "LLM returned no usable text; using fallback"
  fallback
fi
