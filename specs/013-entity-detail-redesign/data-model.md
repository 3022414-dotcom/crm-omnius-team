# Data Model: Entity Detail Page Redesign

**Feature**: F-13 | **Date**: 2026-07-10

> No database schema changes. All entity fields are already persisted by F-01/F-12.
> This document describes the **UI component data model** — props, state, and data flow.

---

## Component: InlineField

The core reusable unit for editable fields.

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✓ | English label displayed above/beside value |
| `value` | string \| null | ✓ | Current persisted value |
| `onSave` | (newValue: string \| null) → Promise | ✓ | Called with new value on blur/Enter; must return resolved/rejected Promise |
| `type` | `'text' \| 'select' \| 'date' \| 'textarea' \| 'multiselect' \| 'url' \| 'email' \| 'toggle'` | ✓ | Determines which editor renders |
| `options` | string[] | — | Required when type='select' or 'multiselect'; list of valid option strings |
| `readOnly` | boolean | — | If true, no click interaction; viewer role passes true |
| `required` | boolean | — | If true, empty save is rejected with inline validation error |
| `placeholder` | string | — | Shown when value is null/empty in read mode |
| `multiline` | boolean | — | Only for type='text'; renders textarea instead of input |

**Internal State**:
| State | Type | Description |
|-------|------|-------------|
| `isEditing` | boolean | Whether editor is shown |
| `tempValue` | string \| string[] | Current draft value (not yet saved) |
| `saving` | boolean | True while PATCH request is in flight |
| `error` | string \| null | Inline validation or save error message |

**Behaviour**:
- Click on read-mode value → `isEditing = true`, `tempValue = value`
- Enter / blur → validate → call `onSave(tempValue)` → `saving = true` → field returns to read-mode with spinner
- On Promise resolve → `saving = false`, spinner gone
- On Promise reject → restore original value, `saving = false`, show toast
- Escape → `isEditing = false`, `tempValue = value` (discard)
- type='select': `onChange` fires immediately on selection, triggers save
- type='toggle' (boolean fields): click toggles boolean, triggers save immediately

---

## Component: ContactAvatar

Photo display and upload widget for Contact detail.

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `contactId` | string (UUID) | ✓ | Used to call photo endpoints |
| `photoUrl` | string \| null | ✓ | Current photo URL or null |
| `firstName` | string | ✓ | Used for initials placeholder |
| `lastName` | string | ✓ | Used for initials placeholder |
| `canEdit` | boolean | ✓ | True for admin/bdm; false for viewer |
| `onPhotoChange` | (newUrl: string \| null) → void | ✓ | Called after upload or delete to update parent state |

**Internal State**:
| State | Type | Description |
|-------|------|-------------|
| `uploading` | boolean | True while upload is in progress |
| `error` | string \| null | Upload error message |

---

## Component: DetailLayout

Two-panel wrapper for all entity detail pages.

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `leftPanel` | ReactNode | ✓ | Fields section (entity fields + avatar for contacts) |
| `rightPanel` | ReactNode | ✓ | Tabs section (related entities) |

**Layout**: CSS Grid `grid-cols-[340px_1fr]`, `h-full`. Both panels `overflow-y-auto`.

---

## Component: EntityTabs

Right-panel tab navigation and content for related entities.

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `entityType` | `'account' \| 'contact' \| 'deal'` | ✓ | Determines which tabs to show |
| `entityId` | string (UUID) | ✓ | Passed to tab content queries |
| `tabs` | Array<{ id: string, label: string, component: ReactNode }> | ✓ | Tab definitions |

**Tabs per entity**:
- Account: Contacts, Deals, Notes, Attachments, Activities
- Contact: Deals, Notes, Attachments, Activities
- Deal: Contacts, Notes, Attachments, Activities

---

## Page Components (New)

### AccountDetailPage
- Route: `/accounts/:id`
- Fetches: `GET /api/v1/accounts/:id`
- Left panel: all Account fields as InlineField components
- Right panel: EntityTabs (Contacts, Deals, Notes, Attachments, Activities)

### ContactDetailPage
- Route: `/contacts/:id`
- Fetches: `GET /api/v1/contacts/:id`
- Left panel: ContactAvatar + all Contact fields as InlineField components
- Right panel: EntityTabs (Deals, Notes, Attachments, Activities)

### DealDetailPage
- Route: `/deals/:id`
- Fetches: `GET /api/v1/deals/:id`
- Left panel: all Deal fields as InlineField components (incl. conditional Lost Reason)
- Right panel: EntityTabs (Contacts, Notes, Attachments, Activities)

---

## Routing Changes

| Route | Component | Status |
|-------|-----------|--------|
| `/accounts` | AccountsPage (list only) | Modified — remove inline detail panel |
| `/accounts/:id` | AccountDetailPage | New |
| `/contacts` | ContactsPage (list only) | Modified — remove inline detail panel |
| `/contacts/:id` | ContactDetailPage | New |
| `/deals` | DealsPage (list only) | Modified — remove inline detail panel |
| `/deals/:id` | DealDetailPage | New |

---

## Account Field Registry

| Field | English Label | Type | ENUM Options |
|-------|--------------|------|--------------|
| name | Name | text | — |
| type | Type | select | Company, Individual |
| industry | Industry | select | FinTech, MedTech, Agro, Oil and Gas, Commerce, HoReCa, Customer services, Production |
| size | Size | select | 1-10, 11-50, 51-200, 201-500, 500+ |
| location | Location | select | Russia, Belorussia, Kazakhstan, Armenia |
| is_target | Target Account | toggle | — |
| website | Website | url | — |
| phone | Phone | text | — |
| address | Address | textarea | — |
| notes | Notes | textarea | — |
| account_storage | Storage URL | url | — |
| account_manager_id | Account Manager | select | (users list) |

## Contact Field Registry

| Field | English Label | Type | ENUM Options |
|-------|--------------|------|--------------|
| first_name | First Name | text | — |
| last_name | Last Name | text | — |
| position | Position | text | — |
| account_id | Account | select | (accounts list) |
| email_corp | Corporate Email | email | — |
| email_personal | Personal Email | email | — |
| phone | Phone | text | — |
| telegram | Telegram | text | — |
| linkedin | LinkedIn | url | — |
| facebook | Facebook | url | — |
| location | Location | select | Russia, Belorussia, Kazakhstan, Armenia |
| language | Language | select | Russian, English |
| preferred_communication | Preferred Channel | select | Telegram, WhatsApp, Email, LinkedIn |
| birthday | Birthday | date | — |
| source | Source | select | Founder, Marketing, Organic, BizDev, Customer, Referral, Agent, Event, Employee |
| comments | Comments | textarea | — |

## Deal Field Registry

| Field | English Label | Type | ENUM Options |
|-------|--------------|------|-------------|
| title | Title | text | — |
| stage | Stage | select | lead, qualifying, discovery, proposal, closing, contract, won, lost |
| account_id | Account | select | (accounts list) |
| value | Value | text | — |
| currency | Currency | select | RUB, EUR, USD |
| close_date | Close Date | date | — |
| expected_start_date | Expected Start | date | — |
| deal_type | Deal Type | select | New Client, New Project with existing client, Upsale |
| source | Source | select | Founder, Marketing, Organic, BizDev, Customer, Referral, Agent, Event, Tender Platforms, Employee |
| location | Location | select | Russia, Belorussia, Kazakhstan, Armenia |
| project_domain | Project Domain | select | FinTech, MedTech, Agro, Oil and Gas, Commerce, HoReCa, Customer services, Production |
| our_services | Our Services | multiselect | AI Consulting, AI Outsource, AI Outstaff, AI Course, AI Product |
| description | Description | textarea | — |
| deal_storage | Storage URL | url | — |
| lost_reason | Lost Reason | textarea | — (visible only when stage=lost) |
