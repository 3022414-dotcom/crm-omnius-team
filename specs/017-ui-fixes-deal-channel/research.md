# Research: UI Bug Fixes & Deal Channel Field

**Feature**: F-17 | **Branch**: `017-ui-fixes-deal-channel` | **Date**: 2026-07-26

No open `NEEDS CLARIFICATION` markers remain in the Technical Context — all four items are additive changes within the existing stack. This document records the decisions made while auditing the current code, so implementers don't have to re-derive them.

## 1. Hyperlink field edit-vs-open conflict

**Decision**: In `client/src/components/detail/InlineField.jsx`, for `type="url"` in read mode, render the value as plain text (not an `<a>`) and add a small `ExternalLink` icon (lucide-react) next to it, wrapped in its own `<a href target="_blank" rel="noreferrer">` with `onClick={(e) => e.stopPropagation()}`. The rest of the field's click area keeps the existing `onClick={handleClick}` (enters edit mode), unchanged from every other field type.

**Rationale**: Root cause (confirmed by reading the component) is [InlineField.jsx:170-179](client/src/components/detail/InlineField.jsx#L170-L179): the whole value text is currently the `<a>`, so its own `stopPropagation` (only applied when not read-only) plus the browser's native navigation both fire on click — link opens, edit mode never triggers. Isolating "open" to a small icon-only anchor removes the conflict while keeping the exact same `handleClick`/edit-mode code path used by every other field type (text, select, date, textarea, toggle). This matches the answer chosen in `/speckit-clarify` (Option A).

**Alternatives considered**:
- Edit-pencil icon that must be clicked to enter edit mode, text stays the link (Option B) — rejected: inverts the existing interaction model (every other field enters edit on a direct click), more code churn, worse consistency.
- "Open ↗" button inside edit mode only (Option C) — rejected: makes opening a link a two-click operation (enter edit mode, then click open), worse UX than today for the common "just open the link" case.

**Scope of fields affected** (confirmed via grep for `type="url"` across `client/src/pages/**` and `client/src/components/modals/**`):
| Entity | Field | Component |
|---|---|---|
| Account | Website | `AccountDetailPage.jsx` |
| Account | Storage URL (`account_storage`) | `AccountDetailPage.jsx` |
| Deal | Storage URL (`deal_storage`) | `DealDetailPage.jsx` |
| Deal | Deal Channel (`deal_channel`, new) | `DealDetailPage.jsx` |
| Contact | LinkedIn | `ContactDetailPage.jsx` |
| Contact | Facebook | `ContactDetailPage.jsx` |

Contact Telegram is `type="text"` today, not `type="url"` — it renders as plain text already and is unaffected by this bug or this fix.

Because the fix lives entirely inside the shared `InlineField` component, all six fields above (five existing + the new Deal Channel) are fixed by one change with no per-page edits required for this part.

## 2. Full-size photo overlay

**Decision**: Add a lightweight modal directly in `ContactAvatar.jsx` (or a small sibling component it renders), reusing the existing Radix `Dialog` primitive already used elsewhere in the app (`DealModal.jsx`, `ContactModal.jsx`, `ConfirmDialog.jsx`), rather than introducing a new modal library.

**Rationale**: Radix `Dialog` (`@radix-ui/react-dialog`) is already a project dependency and already provides overlay + Escape-to-close + focus trap + outside-click-to-close behavior out of the box, satisfying the Escape-key and click-outside edge cases from the spec without extra code.

**Alternatives considered**:
- Hand-rolled `<div>` overlay with manual Escape/outside-click handling — rejected: reinvents behavior Radix already gives for free, more code, more edge cases to get wrong (constitution: simplicity first).
- Browser-native `<dialog>` element — rejected: inconsistent styling/behavior across the two browsers the team actually uses versus the already-adopted Radix pattern; would introduce a second modal convention into the codebase.

**Trigger**: click on the avatar image itself (not the existing hover-camera-icon upload affordance, which stays as-is for `canEdit` users) opens the overlay; only rendered when `photoUrl` is truthy (FR-010 — no overlay attempt for contacts without a photo).

## 3. Notes textarea auto-grow

**Decision**: Replace the fixed `rows={3}` `<textarea>` in `NotesTab.jsx` (both the new-note composer and the edit-note textarea) with a `max-height: 240px` CSS constraint plus a small `onInput`/`useEffect`-driven auto-resize (set `element.style.height = 'auto'` then `element.style.height = Math.min(scrollHeight, 240) + 'px'`), keeping `overflow-y: auto` so content beyond ~10 lines scrolls inside the box instead of growing further.

**Rationale**: This is the standard "auto-grow textarea" pattern and needs no new dependency — plain DOM `scrollHeight` measurement is sufficient at this scale (single-user typing, not a rich editor). ~240px / ~10 lines was the concrete value agreed in `/speckit-clarify`.

**Alternatives considered**:
- A textarea auto-size library (e.g. `react-textarea-autosize`) — rejected: adds a new dependency for something ~15 lines of vanilla code already covers; violates constitution's "no unnecessary abstractions" for a 4-person internal tool.
- Fixed larger `rows={8}` with no dynamic growth — rejected: wastes vertical space for short one-line notes (the common case), which the spec's User Story 4 explicitly says should "remain easy to use for short notes too."

## 4. Deal Channel field

**Decision**: Add `deal_channel VARCHAR` (nullable) to `deals` via a new `node-pg-migrate` migration, following the exact same pattern as the existing `deal_storage` column (no `NOT NULL`, no default, no FK, no index — it's a free-text URL, not queried/filtered on). Wire it through `dealsController.js` (`UPDATABLE_FIELDS`, `createDeal` INSERT, `getDealById` SELECT) and the frontend (`DealDetailPage.jsx` `InlineField`, `DealModal.jsx` form field + zod schema) exactly the way `deal_storage`/"Storage URL" is already wired, positioned immediately after it in both places.

**Rationale**: `deal_storage` is the closest existing analog (same shape: optional URL field on Deal) — matching its pattern exactly minimizes new decisions and keeps the codebase consistent, per constitution.

**Alternatives considered**:
- A separate `deal_channels` table for multiple links — rejected: spec's Assumptions explicitly scope this to a single URL per deal; a join table would be premature (YAGNI).
- Adding validation/allowlist of channel domains — rejected: not requested, `deal_storage` has no such validation either, would be scope creep.
