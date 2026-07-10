# UI Contracts: Notes — Image Paste

**Feature**: F-14 | **Branch**: `014-notes-image-paste`
**Component**: `client/src/components/tabs/NotesTab.jsx`

---

## New State

Added to the note creation/editing flow:

```js
const [pendingImages, setPendingImages] = useState([])
// Shape: Array<{ localId: string, status: 'uploading'|'done'|'error', url?: string, errorMessage?: string }>
```

Cleared on note save or cancel.

---

## Paste Handler

Attached to the note `<textarea>` via `onPaste`:

```
handlePaste(event):
  1. Find first item in event.clipboardData.items where:
       item.kind === 'file' && item.type.startsWith('image/')
  2. If not found: return (normal paste proceeds unchanged)
  3. file = item.getAsFile()
  4. If !SUPPORTED_TYPES.includes(file.type): show inline error, return
     SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  5. event.preventDefault()
  6. localId = crypto.randomUUID()
  7. setPendingImages(prev => [...prev, { localId, status: 'uploading' }])
  8. formData = new FormData()
     formData.append('file', file)
     formData.append('entity_type', entityType)
     formData.append('entity_id', entityId)
  9. uploadAttachment(formData)
       .then(att => {
         setPendingImages(prev => prev.map(p =>
           p.localId === localId ? { ...p, status: 'done', url: att.url } : p
         ))
         setText(prev => prev + `![image](${att.url})\n`)
       })
       .catch(err => {
         setPendingImages(prev => prev.map(p =>
           p.localId === localId ? { ...p, status: 'error', errorMessage: err.message || 'Upload failed' } : p
         ))
       })
```

---

## Thumbnail Strip (edit mode only)

Rendered below the `<textarea>` when `pendingImages.length > 0`:

```
<div className="flex flex-wrap gap-2 mt-2">
  {pendingImages.map(img => (
    <div key={img.localId} className="relative w-16 h-16 rounded border border-border overflow-hidden bg-muted">
      if img.status === 'uploading':
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin w-4 h-4 text-muted-foreground" />
        </div>
      if img.status === 'done':
        <img src={img.url} className="w-full h-full object-cover" />
      if img.status === 'error':
        <div className="absolute inset-0 flex items-center justify-center p-1">
          <span className="text-xs text-destructive text-center">{img.errorMessage}</span>
        </div>
    </div>
  ))}
</div>
```

---

## Inline Image Renderer (view mode)

Used when displaying saved notes (not in edit mode). Replaces the `<p>{note.content}</p>` text-only render:

```
renderNoteContent(content):
  regex = /!\[([^\]]*)\]\(([^)]+)\)/g
  segments = []
  lastIndex = 0
  
  for each match in content.matchAll(regex):
    if match.index > lastIndex:
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    segments.push({ type: 'image', alt: match[1], src: match[2] })
    lastIndex = match.index + match[0].length
  
  if lastIndex < content.length:
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  
  return segments.map(seg => {
    if seg.type === 'text':
      return <span className="whitespace-pre-wrap">{seg.value}</span>
    if seg.type === 'image':
      return <img src={seg.src} alt={seg.alt}
               className="max-w-full rounded border border-border my-1"
               style={{ maxHeight: '400px' }} />
  })
```

---

## Constraints

- `pendingImages` is reset to `[]` on: save success, cancel (click away), switch to different note
- The thumbnail strip is NOT rendered in view mode — only during create/edit
- Viewer-role users never see the note editor, so the paste handler is never accessible to them
- If the same note editor is closed and reopened, pending images from the previous session are discarded (they remain as orphaned attachments — acceptable per spec)
- No maximum number of images per paste session enforced client-side (backend multer handles file size)
