# Implementation Plan: UI Bug Fixes & Deal Channel Field

**Branch**: `017-ui-fixes-deal-channel` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-ui-fixes-deal-channel/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Four UI fixes/improvements found during manual QA: (1) hyperlink-type `InlineField`s currently can't be edited because the anchor's click both navigates and stops propagation — add a small "open in new tab" icon as the only click target that opens the link, so clicking the rest of the field enters edit mode as it already does for every other field type; (2) add a full-size photo overlay to `ContactAvatar`; (3) auto-grow the Notes `<textarea>` up to ~10 lines (~240px) then scroll; (4) add a new `deal_channel` URL column to `deals`, wired through the same `InlineField`/`DealModal`/`UPDATABLE_FIELDS` pattern already used for `deal_storage`, positioned immediately after Storage URL. All four are additive, same-stack changes — no new dependencies, no schema changes beyond one nullable column.

## Technical Context

**Language/Version**: JavaScript (Node.js LTS backend, React 18 frontend, same as rest of project)

**Primary Dependencies**: Express + pg + node-pg-migrate (backend, unchanged); React + Vite, @tanstack/react-query, react-hook-form + zod, Radix UI Dialog, lucide-react (frontend, unchanged) — `ExternalLink` icon from the already-installed `lucide-react` covers the new "open link" affordance, no new package needed

**Storage**: PostgreSQL 15+ (Docker, `omnius_crm_db`) — one new nullable column: `deals.deal_channel`

**Testing**: No automated test suite in this project (consistent with F-01–F-15); verification is manual via `quickstart.md` scenarios, same as prior features

**Target Platform**: Web (desktop browser), internal tool for 4 users

**Project Type**: Web application (Express backend + React/Vite frontend, existing structure)

**Performance Goals**: N/A — standard internal-tool responsiveness, no new performance-sensitive paths

**Constraints**: Constitution "Простота прежде всего" — reuse existing `InlineField`, `DealModal`, `ContactAvatar`, `NotesTab` components and patterns; no new UI libraries, no new backend abstractions

**Scale/Scope**: 4 users, low data volume; touches Account/Contact/Deal detail pages, Deal create/edit modal, Notes tab, one migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Простота прежде всего**: PASS. All four items reuse existing components/patterns (`InlineField` gets one small icon addition; `deal_channel` mirrors `deal_storage` exactly; photo overlay is a small new component following `ContactAvatar`'s existing conventions; notes textarea change is a CSS/behavior tweak). No new architecture, no new libraries.
- **Spec-First**: PASS. Following `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → (next: `/speckit-tasks` → `/speckit-implement`).
- **Последовательность фич**: N/A for this gate — this is a post-MVP bug-fix/improvement feature (F-17), not part of the original F-01→F-11 dependency chain; it depends only on already-completed F-04–F-07, F-11–F-15 (Accounts, Contacts, Deals, Notes, UI/UX, entity redesign, field fixes), all of which are done.
- **YAGNI**: PASS. Scope is exactly the 4 items requested; no speculative extensions (e.g. no multi-link support for Deal Channel, no zoom/pan on the photo overlay, no configurable max-height for notes).

No violations. Complexity Tracking section not needed.

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md, contracts/, quickstart.md) confirm the implementation stays within existing patterns — one nullable column via the standard `deal_storage`-mirroring approach, no new npm packages (Radix Dialog and lucide-react's `ExternalLink` icon are already dependencies), no new abstractions. Constitution Check still PASSES with no changes.

## Project Structure

### Documentation (this feature)

```text
specs/017-ui-fixes-deal-channel/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── api.md
│   └── ui.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
server/
├── controllers/
│   └── dealsController.js       # add 'deal_channel' to UPDATABLE_FIELDS, createDeal INSERT, getDealById SELECT
├── migrations/
│   └── <timestamp>_deal_channel_field.js   # ALTER TABLE deals ADD COLUMN deal_channel
└── routes/                       # unchanged

client/
├── src/
│   ├── components/
│   │   ├── detail/
│   │   │   ├── InlineField.jsx       # add "open in new tab" icon for type="url", separate from edit click
│   │   │   └── ContactAvatar.jsx     # add full-size photo overlay on click
│   │   ├── modals/
│   │   │   └── DealModal.jsx         # add "Deal Channel" field after "Storage URL"
│   │   └── tabs/
│   │       └── NotesTab.jsx          # auto-grow textarea up to ~10 lines / ~240px
│   ├── pages/
│   │   └── deals/
│   │       └── DealDetailPage.jsx    # add InlineField "Deal Channel" after "Storage URL"
│   └── api/
│       └── deals.js                  # no shape change needed (generic field save already works)
```

**Structure Decision**: Existing web-app layout (`server/` Express backend, `client/` React/Vite frontend) is reused as-is — no new top-level directories, no new services. All changes are localized edits to existing files plus one new migration file.

## Complexity Tracking

*No violations — section not applicable.*
