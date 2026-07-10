import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getDeals, createDeal, deleteDeal } from '../../api/deals'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../../components/modals/ConfirmDialog'
import DealModal from '../../components/modals/DealModal'
import DealDetailPage from './DealDetailPage'
import { Plus, Search, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatAmount, formatDate } from '../../lib/date'

const STAGE_LABELS = {
  lead: 'Lead', qualifying: 'Qualifying', discovery: 'Discovery',
  proposal: 'Proposal', closing: 'Closing', contract: 'Contract',
  won: 'Won', lost: 'Lost',
}

const STAGE_COLORS = {
  lead: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  qualifying: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  discovery: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  proposal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  closing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  contract: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  won: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function DealsList() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['deals', search, stageFilter],
    queryFn: () => getDeals({ ...(search && { search }), ...(stageFilter && { stage: stageFilter }) }),
  })
  const deals = data?.data ?? []

  const createMut = useMutation({
    mutationFn: createDeal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setModalOpen(false); toast.success('Deal created') },
    onError: () => toast.error('Failed to create deal'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteDeal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setDeleteId(null); toast.success('Deal deleted') },
    onError: () => toast.error('Failed to delete deal'),
  })

  const canWrite = user?.role !== 'viewer'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Deals</h1>
        {canWrite && (
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors" onClick={() => setModalOpen(true)}>
            <Plus size={14} />New Deal
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-56" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : deals.length === 0 ? <p className="text-sm text-muted-foreground">No deals</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Stage</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Value</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Close Date</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5"><Link to={`/deals/${d.id}`} className="font-medium hover:text-primary transition-colors">{d.title}</Link></td>
                  <td className="px-4 py-2.5"><span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', STAGE_COLORS[d.stage])}>{STAGE_LABELS[d.stage] || d.stage}</span></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.account?.name ? <Link to={`/accounts/${d.account_id}`} className="hover:text-primary">{d.account.name}</Link> : '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatAmount(d.value)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.close_date)}</td>
                  <td className="px-4 py-2.5">
                    {user?.role === 'admin' && (
                      <div className="flex justify-end">
                        <button className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent" onClick={() => setDeleteId(d.id)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DealModal
        open={modalOpen}
        initial={null}
        onSave={createMut.mutate}
        onClose={() => setModalOpen(false)}
        loading={createMut.isPending}
      />
      <ConfirmDialog open={deleteId !== null} title="Delete deal?" description="This action cannot be undone." loading={deleteMut.isPending} onConfirm={() => deleteMut.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  )
}

export default function DealsPage() {
  return (
    <Routes>
      <Route index element={<DealsList />} />
      <Route path=":id" element={<DealDetailPage />} />
    </Routes>
  )
}
