# Contract: Slack Notification Message

**Feature**: 016-ci-cd-pipeline | **Transport**: Slack Incoming Webhook (`POST $SLACK_WEBHOOK_URL`)

One message per delivery run (FR-026). Uses Block Kit for a readable badge + summary. The channel is fixed by the webhook.

## Input fields (from the run)

| Field | Source |
|-------|--------|
| `status` | `success` \| `failure` \| `rolled_back` (deploy job outcome) |
| `version` | `VERSION` file |
| `stand_url` | `$STAND_URL` |
| `run_url` | `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}` |
| `summary` | `summarize-commits.sh` output (bulleted; `fallback` flag if raw subjects) |
| `commit_range` | `before..after` (short SHAs) |

## Rendered payload (shape)

```json
{
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": ":white_check_mark: CRM deployed — v1.1.0" } },
    { "type": "section", "fields": [
      { "type": "mrkdwn", "text": "*Status:*\nSuccess" },
      { "type": "mrkdwn", "text": "*Version:*\n1.1.0" },
      { "type": "mrkdwn", "text": "*Stand:*\n<https://crm.omnius.team|crm.omnius.team>" },
      { "type": "mrkdwn", "text": "*Run:*\n<...|#1234>" }
    ]},
    { "type": "section", "text": { "type": "mrkdwn", "text": "*Changes:*\n• …\n• …" } },
    { "type": "context", "elements": [ { "type": "mrkdwn", "text": "a1b2c3d..e4f5g6h · 3 commits" } ] }
  ]
}
```

## Rules

- **Badge**: `:white_check_mark:` success · `:x:` failure · `:leftwards_arrow_with_hook:` rolled_back.
- **Header text**: `CRM deployed — v<version>` on success; `CRM deploy FAILED — v<version>` on failure.
- **Stand link**: shown only for `success`/`rolled_back` (a healthy stand exists); on hard failure show "previous version still live" instead.
- **Changes**: AI summary; if `fallback`, prefix with `(commit subjects — summary unavailable)`.
- **Truncation**: cap summary at ~15 bullets / Slack block limits; note "+N more" if trimmed.
- **Delivery**: a non-2xx from Slack is logged but does not fail the deploy (FR-026).
