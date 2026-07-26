import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getNotes, createNote, updateNote, deleteNote } from '../../api/notes'
import { uploadAttachment } from '../../api/attachments'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from '../../lib/date'

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 50 * 1024 * 1024
const MAX_TEXTAREA_HEIGHT = 240 // ~10 lines

function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'
}

function renderNoteContent(content) {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const segments = []
  let lastIndex = 0
  let match
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'image', alt: match[1], src: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }
  return segments.map((seg, i) =>
    seg.type === 'text'
      ? <span key={i} className="whitespace-pre-wrap">{seg.value}</span>
      : <img key={i} src={seg.src} alt={seg.alt} className="max-w-full rounded border border-border my-1" style={{ maxHeight: '400px' }} />
  )
}

function ThumbnailStrip({ pendingImages }) {
  if (!pendingImages.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {pendingImages.map(img => (
        <div key={img.localId} className="relative w-16 h-16 rounded border border-border overflow-hidden bg-muted">
          {img.status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {img.status === 'done' && (
            <img src={img.url} className="w-full h-full object-cover" alt="" />
          )}
          {img.status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center p-1">
              <span className="text-xs text-destructive text-center">{img.errorMessage}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function NotesTab({ entityType, entityId }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const key = ['notes', entityType, entityId]

  const [text, setText] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [pendingImages, setPendingImages] = useState([])

  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: () => getNotes(entityType, entityId),
  })

  const createMut = useMutation({
    mutationFn: () => createNote({ entity_type: entityType, entity_id: entityId, content: text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setText(''); setPendingImages([]) },
    onError: () => toast.error('Не удалось добавить заметку'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => updateNote(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setEditId(null); setPendingImages([]) },
    onError: () => toast.error('Не удалось обновить заметку'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteNote(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setDeleteId(null); toast.success('Заметка удалена') },
    onError: () => toast.error('Не удалось удалить заметку'),
  })

  const canWrite = user?.role !== 'viewer'
  const canDelete = (note) => user?.role === 'admin'

  const handlePaste = (setTextFn) => (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imgItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (!imgItem) return

    const file = imgItem.getAsFile()

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setPendingImages(prev => [...prev, { localId: crypto.randomUUID(), status: 'error', errorMessage: 'Unsupported format' }])
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPendingImages(prev => [...prev, { localId: crypto.randomUUID(), status: 'error', errorMessage: 'Image too large (max 50 MB)' }])
      return
    }

    e.preventDefault()
    const localId = crypto.randomUUID()
    setPendingImages(prev => [...prev, { localId, status: 'uploading' }])

    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity_type', entityType)
    formData.append('entity_id', entityId)

    uploadAttachment(formData)
      .then(att => {
        setPendingImages(prev => prev.map(p =>
          p.localId === localId ? { ...p, status: 'done', url: att.url } : p
        ))
        setTextFn(prev => prev + `![image](${att.url})\n`)
      })
      .catch(err => {
        setPendingImages(prev => prev.map(p =>
          p.localId === localId ? { ...p, status: 'error', errorMessage: err.message || 'Upload failed' } : p
        ))
      })
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="space-y-2">
          <textarea
            ref={autoGrow}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary overflow-y-auto"
            style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
            rows={3}
            placeholder="Добавить заметку..."
            value={text}
            onChange={(e) => { setText(e.target.value); autoGrow(e.target) }}
            onPaste={handlePaste(setText)}
          />
          <ThumbnailStrip pendingImages={pendingImages} />
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            disabled={!text.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            Добавить
          </button>
        </div>
      )}

      <div className="space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет заметок</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="rounded-md border border-border p-3 space-y-1">
            {editId === note.id ? (
              <div className="space-y-2">
                <textarea
                  ref={autoGrow}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary overflow-y-auto"
                  style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
                  rows={3}
                  value={editText}
                  onChange={(e) => { setEditText(e.target.value); autoGrow(e.target) }}
                  onPaste={handlePaste(setEditText)}
                />
                <ThumbnailStrip pendingImages={pendingImages} />
                <div className="flex gap-2">
                  <button
                    className="p-1 rounded text-green-600 hover:bg-accent"
                    onClick={() => updateMut.mutate({ id: note.id, body: editText })}
                    disabled={updateMut.isPending}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="p-1 rounded text-muted-foreground hover:bg-accent"
                    onClick={() => { setEditId(null); setPendingImages([]) }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm">{renderNoteContent(note.content)}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {note.author?.name} · {formatDistanceToNow(note.created_at)}
                  </span>
                  {canWrite && (
                    <div className="flex gap-1">
                      <button
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                        onClick={() => { setEditId(note.id); setEditText(note.content) }}
                      >
                        <Pencil size={13} />
                      </button>
                      {canDelete(note) && (
                        <button
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                          onClick={() => setDeleteId(note.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Удалить заметку?"
        description="Это действие необратимо."
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
