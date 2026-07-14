#!/usr/bin/env bash
# notify-slack.sh [summary-file]
# Posts one Block Kit message to the Slack Incoming Webhook (FR-020..FR-024, FR-026,
# contracts/slack-message.md). A non-2xx response is logged but never fatal — a failed
# notification must not fail a successful deploy (FR-026).
#
# Env: SLACK_WEBHOOK_URL, STATUS (success|failure|...), VERSION, STAND_URL, RUN_URL, COMMIT_RANGE.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$DIR/lib.sh"

SUMMARY_FILE="${1:-}"
STATUS="${STATUS:-unknown}"
VERSION="${VERSION:-unknown}"
STAND_URL="${STAND_URL:-}"
RUN_URL="${RUN_URL:-}"
COMMIT_RANGE="${COMMIT_RANGE:-}"

[ -n "${SLACK_WEBHOOK_URL:-}" ] || { warn "no SLACK_WEBHOOK_URL; skipping notification"; exit 0; }
command -v jq >/dev/null 2>&1 || { warn "jq missing; skipping notification"; exit 0; }

if [ -n "$SUMMARY_FILE" ] && [ -f "$SUMMARY_FILE" ]; then
  SUMMARY="$(cat "$SUMMARY_FILE")"
else
  SUMMARY="(no change summary available)"
fi

if [ "$STATUS" = "success" ]; then
  BADGE=":white_check_mark:"
  HEADER="CRM deployed — v${VERSION}"
  STAND_FIELD="*Stand:*\n<${STAND_URL}|${STAND_URL#https://}>"
else
  BADGE=":x:"
  HEADER="CRM deploy FAILED — v${VERSION}"
  STAND_FIELD="*Stand:*\nprevious version still live"
fi

PAYLOAD="$(jq -n \
  --arg header "${BADGE} ${HEADER}" \
  --arg status "$STATUS" \
  --arg version "$VERSION" \
  --arg stand "$STAND_FIELD" \
  --arg run "*Run:*\n<${RUN_URL}|open>" \
  --arg summary "*Changes:*
${SUMMARY}" \
  --arg ctx "${COMMIT_RANGE}" \
  '{
     blocks: [
       { type: "header", text: { type: "plain_text", text: $header } },
       { type: "section", fields: [
         { type: "mrkdwn", text: ("*Status:*\n" + $status) },
         { type: "mrkdwn", text: ("*Version:*\n" + $version) },
         { type: "mrkdwn", text: $stand },
         { type: "mrkdwn", text: $run }
       ]},
       { type: "section", text: { type: "mrkdwn", text: $summary } },
       { type: "context", elements: [ { type: "mrkdwn", text: $ctx } ] }
     ]
   }')"

code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  -H 'content-type: application/json' \
  -d "$PAYLOAD" "$SLACK_WEBHOOK_URL" 2>/dev/null || echo 000)"

if [ "$code" = "200" ]; then
  log "Slack notification posted (status=${STATUS})"
else
  warn "Slack webhook returned ${code} — notification not delivered (non-fatal)"
fi
exit 0
