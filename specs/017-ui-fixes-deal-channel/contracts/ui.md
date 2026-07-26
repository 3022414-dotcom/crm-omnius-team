# UI Contracts: UI Bug Fixes & Deal Channel Field — F-17

## 1. InlineField — hyperlink edit/open split (applies to all `type="url"` fields)

**Component**: `client/src/components/detail/InlineField.jsx`

**Current read-mode markup** (the bug):
```jsx
type === 'url' && readDisplay ? (
  <a href={readDisplay} target="_blank" rel="noreferrer"
     className="text-primary hover:underline truncate"
     onClick={(e) => !readOnly && e.stopPropagation()}>
    {readDisplay}
  </a>
) : ( ... )
```

**New read-mode markup**:
```jsx
type === 'url' && readDisplay ? (
  <>
    <span className="text-foreground truncate">{readDisplay}</span>
    <a href={readDisplay} target="_blank" rel="noreferrer"
       className="text-muted-foreground hover:text-primary flex-shrink-0"
       onClick={(e) => e.stopPropagation()}
       aria-label={`Open ${label} link`}>
      <ExternalLink size={12} />
    </a>
  </>
) : ( ... )
```

- Import `ExternalLink` from `lucide-react` (already a project dependency).
- Outer container `onClick={handleClick}` is untouched — clicking the text span now correctly bubbles to it and enters edit mode, exactly like every other field type.
- The icon `<a>` always calls `stopPropagation` (both read-only and editable) — for `readOnly` fields the outer `handleClick` is already a no-op (`if (readOnly || saving) return`), so this is safe and simplifies the conditional.
- `readOnly` users: outer click does nothing (as today); the icon is still shown and still opens the link — satisfies spec FR-003 ("link fields remain click-to-open-only").

**Visual**: icon sits at the end of the field value, same row, `flex items-center gap-1.5` container already provides layout.

---

## 2. ContactAvatar — full-size photo overlay

**Component**: `client/src/components/detail/ContactAvatar.jsx`

**Revised during implementation** (see Findings in the implementation report): the originally planned "click the avatar circle opens full view" design turned out to be unreachable for `canEdit` users. The hover camera-icon overlay is `absolute inset-0` — it covers the *entire* avatar circle, not just a small icon — so it always intercepts clicks ahead of any handler on the avatar div beneath it, regardless of visual opacity. Verified live in a browser: clicking the avatar as an admin/bdm user always opened the upload file picker, never the full-size view.

**Actual behavior implemented**: a small dedicated "expand" icon button (`Maximize2` from lucide-react), rendered as a sibling positioned at the avatar's bottom-right corner, always visible whenever `photoUrl` is set (for every role). It is a separate click target from the avatar itself, so it doesn't compete with the existing upload hover-overlay:

```jsx
import * as Dialog from '@radix-ui/react-dialog'
import { X, Maximize2 } from 'lucide-react'

// local state
const [fullView, setFullView] = useState(false)

// avatar click handler — UNCHANGED from before this feature:
onClick={() => canEdit && !uploading && fileInputRef.current?.click()}

// new: dedicated expand-icon button, sibling of the avatar div and the hover camera-overlay div
{photoUrl && !uploading && (
  <button
    type="button"
    aria-label="View full-size photo"
    className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full p-1 text-muted-foreground hover:text-primary shadow-sm"
    onClick={(e) => { e.stopPropagation(); setFullView(true) }}
  >
    <Maximize2 size={11} />
  </button>
)}
```

Uploading a *new* photo still works exactly as before via the hover camera-icon overlay (`onClick={() => fileInputRef.current?.click()}`), completely unchanged — verified live that clicking the avatar center still opens the native file chooser for `canEdit` users.

```jsx
<Dialog.Root open={fullView} onOpenChange={setFullView}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-[90vw] max-h-[90vh]">
      <img src={photoUrl} alt={`${firstName} ${lastName}`} className="max-w-full max-h-[90vh] rounded" />
      <Dialog.Close className="absolute -top-3 -right-3 bg-background rounded-full p-1 border border-border">
        <X size={16} />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

- Radix `Dialog` provides Escape-to-close and click-outside-to-close for free (spec edge cases).
- No photo → `photoUrl` is falsy → click falls through to the existing initials/no-op behavior; overlay never mounts (FR-010).
- No upload/delete controls inside the overlay itself — those remain on the card via the existing hover camera icon / "Delete photo" button (per spec Assumptions).

---

## 3. NotesTab — auto-growing textarea

**Component**: `client/src/components/tabs/NotesTab.jsx` (both the composer `<textarea>` and the edit-note `<textarea>`)

```jsx
const MAX_TEXTAREA_HEIGHT = 240 // ~10 lines

function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'
}
```

```jsx
<textarea
  ref={(el) => autoGrow(el)}
  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary overflow-y-auto"
  style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
  rows={3}
  value={text}
  onChange={(e) => { setText(e.target.value); autoGrow(e.target) }}
  onPaste={handlePaste(setText)}
  placeholder="Добавить заметку..."
/>
```

- Applied identically to the edit-note textarea (`editText` state), so an existing long note opens already sized to its content up to the max (FR-012).
- `resize-none` stays — growth is automatic, not user-draggable, avoiding layout fights with the auto-grow logic.
- `overflow-y-auto` + fixed `maxHeight` gives internal scroll once the cap is hit (FR-011).

---

## 4. DealDetailPage — new "Deal Channel" field

**Component**: `client/src/pages/deals/DealDetailPage.jsx`

Insert immediately after the existing Storage URL line (`~L253`):

```jsx
<InlineField label="Storage URL" value={deal.deal_storage} type="url" readOnly={!canWrite} onSave={field('deal_storage')} />
<InlineField label="Deal Channel" value={deal.deal_channel} type="url" readOnly={!canWrite} onSave={field('deal_channel')} />
```

## 5. DealModal — new "Deal Channel" form field

**Component**: `client/src/components/modals/DealModal.jsx`

- Add `deal_channel: z.string().optional()` to the zod `schema`.
- Add `deal_channel: ''` to `emptyDefaults`.
- Insert immediately after the existing Storage URL `Field` (`~L210-212`):

```jsx
<Field label="Storage URL" error={errors.deal_storage}>
  <input {...register('deal_storage')} type="url" className={inputClass} placeholder="https://drive.google.com/..." />
</Field>

<Field label="Deal Channel" error={errors.deal_channel}>
  <input {...register('deal_channel')} type="url" className={inputClass} placeholder="https://t.me/..." />
</Field>
```

- Any `reset()`/`initial` population logic in the modal that maps existing deal fields into form defaults needs `deal_channel: initial.deal_channel || ''` added alongside the existing `deal_storage` line.
