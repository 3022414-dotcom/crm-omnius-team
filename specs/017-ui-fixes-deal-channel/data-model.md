# Data Model: UI Bug Fixes & Deal Channel Field

**Feature**: F-17 | **Branch**: `017-ui-fixes-deal-channel` | **Date**: 2026-07-26

## Schema Changes

### New column: deals.deal_channel

```sql
ALTER TABLE deals ADD COLUMN deal_channel VARCHAR;
```

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| deal_channel | VARCHAR | YES | NULL | Free-text URL, same shape as existing `deal_storage`. No FK, no index (not filtered/searched on), no `NOT NULL`. |

**Behavior**:
- Optional on create and update (FR-006) — omitting it or sending `null`/`''` is valid.
- Editable via the same `InlineField` + `UPDATABLE_FIELDS` mechanism as every other free-text Deal field.
- No migration of existing rows needed — all existing deals get `NULL`, displayed as empty (consistent with `deal_storage` on old rows).

No other schema changes. No changes to `accounts`, `contacts`, `notes`, or any other table — items 1–3 (hyperlink edit fix, photo overlay, notes auto-grow) are frontend-only.

## API Response Shape Changes

### GET /api/v1/deals/:id (non-breaking extension)

Before:
```json
{ "id": "...", "deal_storage": "https://drive.google.com/...", "..." : "..." }
```

After:
```json
{
  "id": "...",
  "deal_storage": "https://drive.google.com/...",
  "deal_channel": "https://t.me/some_channel",
  "...": "..."
}
```

`deal_channel` is `null` when not set (including for all pre-existing deals).

### POST /api/v1/deals, PUT /api/v1/deals/:id

- `deal_channel` accepted as an optional string field in the request body, same as `deal_storage`.
- No validation beyond what `deal_storage` already has (i.e. none server-side; `type="url"` on the client input provides basic browser-level format hinting only).

## Frontend Data Mapping

### DealDetailPage.jsx — new field

| DB column | UI label | Position | Type | Edit mode |
|-----------|----------|----------|------|-----------|
| `deal_channel` | Deal Channel | Immediately after "Storage URL" | `InlineField type="url"` | Same as Storage URL |

### DealModal.jsx — new field

| Form field | zod schema | Position | Placeholder |
|---|---|---|---|
| `deal_channel` | `z.string().optional()` | Immediately after "Storage URL" `Field` | e.g. `https://t.me/...` |

### InlineField.jsx — behavior change (no new fields, no new props)

No new props are introduced. The `type="url"` read-mode branch changes internally:

| Before | After |
|---|---|
| Entire value text is an `<a href>` with a click-guard that both navigates and blocks edit-mode entry | Value renders as plain text (click → edit mode, same as every other type); a small `ExternalLink` icon anchor sits next to it and is the only element that opens the link in a new tab |

Applies uniformly to every `InlineField type="url"` instance app-wide (Account Website, Account Storage URL, Deal Storage URL, Deal Channel, Contact LinkedIn, Contact Facebook) — no per-page changes required beyond adding the new Deal Channel field itself.

### ContactAvatar.jsx — new local state, no new props required from callers

| New behavior | Trigger | Notes |
|---|---|---|
| Full-size photo overlay (Radix Dialog) | Click on the avatar image (when `photoUrl` is set) | Existing hover-camera "upload" affordance (`canEdit` only) is unaffected — overlay trigger is the image click itself, camera icon overlay still opens the file picker as today |

`ContactDetailPage.jsx` requires no changes — it already passes `photoUrl`, `firstName`, `lastName` into `ContactAvatar`, which is everything the overlay needs.

### NotesTab.jsx — behavior change, no new fields

| Before | After |
|---|---|
| `<textarea rows={3}>` fixed height, both composer and edit-note inputs | Auto-growing `<textarea>`, min height ~3 lines (unchanged starting point), max height ~240px (~10 lines), then internal scroll |

## Entities — no changes

`accounts`, `contacts`, `notes`, `attachments`, `activities`, `deal_contacts`, `users`, `session` — untouched. FK/CASCADE/SET NULL policies from the constitution remain as-is.
