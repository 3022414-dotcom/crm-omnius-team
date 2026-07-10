import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getContacts, createContact, deleteContact } from '../../api/contacts'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../../components/modals/ConfirmDialog'
import ContactModal from '../../components/modals/ContactModal'
import ContactDetailPage from './ContactDetailPage'
import { Plus, Search, Trash2 } from 'lucide-react'

function ContactsList() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => getContacts(search ? { search } : {}),
  })
  const contacts = data?.data ?? []

  const createMut = useMutation({
    mutationFn: createContact,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setModalOpen(false); toast.success('Contact created') },
    onError: () => toast.error('Failed to create contact'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteContact(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setDeleteId(null); toast.success('Contact deleted') },
    onError: () => toast.error('Failed to delete contact'),
  })

  const canWrite = user?.role !== 'viewer'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contacts</h1>
        {canWrite && (
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors" onClick={() => setModalOpen(true)}>
            <Plus size={14} />New Contact
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input className="w-full max-w-xs pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Position</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5"><Link to={`/contacts/${c.id}`} className="font-medium hover:text-primary transition-colors">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</Link></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.account_name ? <Link to={`/accounts/${c.account_id}`} className="hover:text-primary">{c.account_name}</Link> : '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.position || '—'}</td>
                  <td className="px-4 py-2.5">
                    {user?.role === 'admin' && (
                      <div className="flex justify-end">
                        <button className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent" onClick={() => setDeleteId(c.id)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContactModal
        open={modalOpen}
        initial={null}
        onSave={createMut.mutate}
        onClose={() => setModalOpen(false)}
        loading={createMut.isPending}
      />
      <ConfirmDialog open={deleteId !== null} title="Delete contact?" description="This action cannot be undone." loading={deleteMut.isPending} onConfirm={() => deleteMut.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Routes>
      <Route index element={<ContactsList />} />
      <Route path=":id" element={<ContactDetailPage />} />
    </Routes>
  )
}
