import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { listActivities, updateActivity, deleteActivity } from '../../api/activities'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../../components/modals/ConfirmDialog'
import ActivityModal from '../../components/modals/ActivityModal'
import { formatDate } from '../../lib/date'
import { Pencil, Trash2, CheckCircle, Circle, Filter } from 'lucide-react'
import { cn } from '../../lib/utils'

const TYPE_LABELS = { call: 'Call', email: 'Email', meeting: 'Meeting', task: 'Task' }
const ENTITY_LABELS = { account: 'Account', contact: 'Contact', deal: 'Deal' }
const ENTITY_PATHS = { account: 'accounts', contact: 'contacts', deal: 'deals' }

export default function ActivitiesPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState('')
  const [completedFilter, setCompletedFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const params = {}
  if (typeFilter) params.type = typeFilter
  if (completedFilter !== '') params.completed = completedFilter

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities-global', typeFilter, completedFilter],
    queryFn: () => listActivities(params),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => updateActivity(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities-global'] }); setEditing(null); toast.success('Активность обновлена') },
    onError: () => toast.error('Не удалось обновить активность'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteActivity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities-global'] }); setDeleteId(null); toast.success('Активность удалена') },
    onError: () => toast.error('Не удалось удалить активность'),
  })

  const toggleComplete = (act) => updateMut.mutate({ id: act.id, completed: !act.completed })

  const canWrite = user?.role !== 'viewer'

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Activities</h1>

      <div className="flex gap-3 flex-wrap items-center">
        <Filter size={14} className="text-muted-foreground" />
        <select className="px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={completedFilter} onChange={(e) => setCompletedFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="false">Active</option>
          <option value="true">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activities yet</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 w-8" />
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Related to</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due date</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Owner</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr key={act.id} className={cn('border-b border-border last:border-0 hover:bg-muted/20', act.overdue && 'bg-destructive/5')}>
                  <td className="px-4 py-2.5">
                    <button className="text-muted-foreground hover:text-primary" onClick={() => canWrite && toggleComplete(act)} disabled={!canWrite}>
                      {act.completed ? <CheckCircle size={15} className="text-green-500" /> : <Circle size={15} />}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{TYPE_LABELS[act.type]}</td>
                  <td className="px-4 py-2.5 max-w-xs truncate">{act.description || '—'}</td>
                  <td className="px-4 py-2.5">
                    {act.entity_id ? (
                      <Link to={`/${ENTITY_PATHS[act.entity_type]}/${act.entity_id}`} className="text-muted-foreground hover:text-primary transition-colors">
                        {ENTITY_LABELS[act.entity_type]}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className={cn('px-4 py-2.5', act.overdue ? 'text-destructive' : 'text-muted-foreground')}>
                    {formatDate(act.due_date)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{act.owner?.name}</td>
                  <td className="px-4 py-2.5">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => setEditing(act)}><Pencil size={13} /></button>
                        {user?.role === 'admin' && <button className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent" onClick={() => setDeleteId(act.id)}><Trash2 size={13} /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ActivityModal
        open={editing !== null}
        initial={editing}
        onSave={(data) => updateMut.mutate({ id: editing.id, ...data })}
        onClose={() => setEditing(null)}
        loading={updateMut.isPending}
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
