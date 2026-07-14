import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createActivity, updateActivity, deleteActivity } from '../../api/activities'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import ActivityModal from '../modals/ActivityModal'
import { formatDate } from '../../lib/date'
import { Plus, Pencil, Trash2, CheckCircle, Circle } from 'lucide-react'
import { cn } from '../../lib/utils'

const TYPE_LABELS = { call: 'Call', email: 'Email', meeting: 'Meeting', task: 'Task' }

export default function ActivitiesTab({ entityType, entityId, fetchFn }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const key = ['activities', entityType, entityId]

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const { data: activities = [] } = useQuery({
    queryKey: key,
    queryFn: () => fetchFn(entityId),
  })

  const createMut = useMutation({
    mutationFn: (data) => createActivity({ ...data, entity_type: entityType, entity_id: entityId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setModalOpen(false); toast.success('Activity created') },
    onError: () => toast.error('Failed to create activity'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => updateActivity(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setEditing(null); toast.success('Activity updated') },
    onError: () => toast.error('Failed to update activity'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteActivity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setDeleteId(null); toast.success('Activity deleted') },
    onError: () => toast.error('Failed to delete activity'),
  })

  const toggleComplete = (act) =>
    updateMut.mutate({ id: act.id, completed: !act.completed })

  const canWrite = user?.role !== 'viewer'

  return (
    <div className="space-y-4">
      {canWrite && (
        <button
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={14} />
          Add activity
        </button>
      )}

      <div className="space-y-2">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No activities yet</p>
        )}
        {activities.map((act) => (
          <div
            key={act.id}
            className={cn(
              'flex items-start gap-3 rounded-md border px-3 py-2',
              act.overdue ? 'border-destructive/40 bg-destructive/5' : 'border-border'
            )}
          >
            <button
              className="mt-0.5 text-muted-foreground hover:text-primary flex-shrink-0"
              onClick={() => canWrite && toggleComplete(act)}
              disabled={!canWrite}
            >
              {act.completed ? <CheckCircle size={16} className="text-green-500" /> : <Circle size={16} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[act.type]}</span>
                {act.due_date && (
                  <span className={cn('text-xs', act.overdue ? 'text-destructive' : 'text-muted-foreground')}>
                    {formatDate(act.due_date)}
                  </span>
                )}
              </div>
              {act.description && <p className="text-sm mt-0.5 truncate">{act.description}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">{act.owner?.name}</p>
            </div>
            {canWrite && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => setEditing(act)}
                >
                  <Pencil size={13} />
                </button>
                {user?.role === 'admin' && (
                  <button
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                    onClick={() => setDeleteId(act.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <ActivityModal
        open={modalOpen || editing !== null}
        initial={editing}
        onSave={(data) => editing ? updateMut.mutate({ id: editing.id, ...data }) : createMut.mutate(data)}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        loading={createMut.isPending || updateMut.isPending}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete activity?"
        description="This action cannot be undone."
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
