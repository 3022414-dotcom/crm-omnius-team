import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAttachments, uploadAttachment, deleteAttachment } from '../../api/attachments'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import { Paperclip, Trash2, Download } from 'lucide-react'

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export default function AttachmentsTab({ entityType, entityId }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const key = ['attachments', entityType, entityId]
  const inputRef = useRef(null)
  const [deleteId, setDeleteId] = useState(null)

  const { data: attachments = [] } = useQuery({
    queryKey: key,
    queryFn: () => getAttachments(entityType, entityId),
  })

  const uploadMut = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('entity_type', entityType)
      fd.append('entity_id', entityId)
      return uploadAttachment(fd)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Файл загружен') },
    onError: () => toast.error('Не удалось загрузить файл'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAttachment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setDeleteId(null); toast.success('Файл удалён') },
    onError: () => toast.error('Не удалось удалить файл'),
  })

  const canWrite = user?.role !== 'viewer'

  return (
    <div className="space-y-4">
      {canWrite && (
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) uploadMut.mutate(e.target.files[0]); e.target.value = '' }}
          />
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
            disabled={uploadMut.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip size={14} />
            {uploadMut.isPending ? 'Загрузка...' : 'Прикрепить файл'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет вложений</p>
        )}
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{att.file_name}</span>
              {att.file_size && <span className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(att.file_size)}</span>}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <a
                href={`/api/v1/attachments/${att.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <Download size={13} />
              </a>
              {user?.role === 'admin' && (
                <button
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                  onClick={() => setDeleteId(att.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Удалить файл?"
        description="Это действие необратимо."
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
