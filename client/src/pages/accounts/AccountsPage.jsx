import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAccounts, createAccount, deleteAccount } from '../../api/accounts'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../../components/modals/ConfirmDialog'
import AccountModal from '../../components/modals/AccountModal'
import AccountDetailPage from './AccountDetailPage'
import { Plus, Search, Trash2 } from 'lucide-react'

function AccountsList() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', search],
    queryFn: () => getAccounts(search ? { search } : {}),
  })

  const accounts = data?.data ?? []

  const createMut = useMutation({
    mutationFn: createAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setModalOpen(false); toast.success('Account created') },
    onError: () => toast.error('Failed to create account'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAccount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setDeleteId(null); toast.success('Account deleted') },
    onError: () => toast.error('Failed to delete account'),
  })

  const canWrite = user?.role !== 'viewer'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Accounts</h1>
        {canWrite && (
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={14} />
            New Account
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full max-w-xs pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Industry</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Contacts</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Deals</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link to={`/accounts/${acc.id}`} className="font-medium hover:text-primary transition-colors">
                      {acc.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{acc.industry || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{acc.contactsCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{acc.dealsCount ?? 0}</td>
                  <td className="px-4 py-2.5">
                    {user?.role === 'admin' && (
                      <div className="flex justify-end">
                        <button
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                          onClick={() => setDeleteId(acc.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountModal
        open={modalOpen}
        initial={null}
        onSave={createMut.mutate}
        onClose={() => setModalOpen(false)}
        loading={createMut.isPending}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete account?"
        description="All related data (contacts, deals, notes) will be deleted."
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

export default function AccountsPage() {
  return (
    <Routes>
      <Route index element={<AccountsList />} />
      <Route path=":id" element={<AccountDetailPage />} />
    </Routes>
  )
}
