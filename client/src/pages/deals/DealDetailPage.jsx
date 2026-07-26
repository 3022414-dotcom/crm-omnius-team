import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Pencil, Plus } from 'lucide-react'
import { getDeal, updateDeal, getDealActivities, updateDealContact, addDealContact } from '../../api/deals'
import { getAccounts } from '../../api/accounts'
import { getContacts } from '../../api/contacts'
import { getUsers } from '../../api/users'
import { formatDate, formatAmount } from '../../lib/date'
import { useAuthStore } from '../../stores/authStore'
import DetailLayout from '../../components/detail/DetailLayout'
import InlineField from '../../components/detail/InlineField'
import InlineMultiSelect from '../../components/detail/InlineMultiSelect'
import EntityTabs from '../../components/detail/EntityTabs'
import NotesTab from '../../components/tabs/NotesTab'
import AttachmentsTab from '../../components/tabs/AttachmentsTab'
import ActivitiesTab from '../../components/tabs/ActivitiesTab'

const STAGES = ['lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost']
const CURRENCIES = ['RUB', 'EUR', 'USD']
const DEAL_TYPES = ['New Client', 'New Project with existing client', 'Upsale']
const SOURCES = ['Founder', 'Marketing', 'Organic', 'BizDev', 'Customer', 'Referral', 'Agent', 'Event', 'Tender Platforms', 'Employee']
const LOCATIONS = ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']
const PROJECT_DOMAINS = ['FinTech', 'MedTech', 'Agro', 'Oil and Gas', 'Commerce', 'HoReCa', 'Customer services', 'Production']
const OUR_SERVICES = ['Workshop', 'Webinar', 'Consulting', 'POC', 'Development', 'Accelerator', 'Performance']

function DealContactRow({ dealId, contact, canWrite }) {
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(contact.role || '')
  const [comment, setComment] = useState(contact.comment || '')
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: (data) => updateDealContact(dealId, contact.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deal', dealId] }); setEditing(false) },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2.5">
        <Link to={`/contacts/${contact.id}`} className="text-sm font-medium hover:text-primary">
          {[contact.first_name, contact.last_name].filter(Boolean).join(' ')}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground">
        {editing
          ? <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full text-sm border border-border rounded px-2 py-1 bg-background" placeholder="Role" />
          : contact.role || '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground">
        {editing
          ? <input value={comment} onChange={(e) => setComment(e.target.value)} className="w-full text-sm border border-border rounded px-2 py-1 bg-background" placeholder="Comment" />
          : contact.comment || '—'}
      </td>
      {canWrite && (
        <td className="px-4 py-2.5">
          {editing ? (
            <div className="flex gap-1 justify-end">
              <button className="text-xs px-2 py-1 rounded bg-primary text-white" onClick={() => updateMut.mutate({ role: role || null, comment: comment || null })} disabled={updateMut.isPending}>Save</button>
              <button className="text-xs px-2 py-1 rounded border border-border" onClick={() => { setEditing(false); setRole(contact.role || ''); setComment(contact.comment || '') }}>Cancel</button>
            </div>
          ) : (
            <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent ml-auto flex" onClick={() => setEditing(true)}>
              <Pencil size={13} />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

function DealContactsContent({ deal, canWrite }) {
  const qc = useQueryClient()
  const contacts = deal.contacts ?? []
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const { data: allContactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
    enabled: canWrite && addOpen,
  })
  const allContacts = allContactsData?.data ?? []
  const available = allContacts.filter((c) => !contacts.some((dc) => dc.id === c.id))

  const addMut = useMutation({
    mutationFn: (contactId) => addDealContact(deal.id, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal', deal.id] })
      setSelectedId('')
      setAddOpen(false)
      toast.success('Contact added')
    },
    onError: () => toast.error('Failed to add contact'),
  })

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !addOpen && (
        <p className="text-sm text-muted-foreground italic">No contacts yet</p>
      )}
      {contacts.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Contact</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Comment</th>
                {canWrite && <th className="px-4 py-2.5 w-24" />}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <DealContactRow key={c.id} dealId={deal.id} contact={c} canWrite={canWrite} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canWrite && (
        addOpen ? (
          <div className="flex gap-2 items-center">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-sm border border-border rounded px-2 py-1.5 bg-background flex-1"
            >
              <option value="">Select contact...</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
            <button
              className="px-3 py-1.5 text-sm rounded bg-primary text-white disabled:opacity-50"
              disabled={!selectedId || addMut.isPending}
              onClick={() => addMut.mutate(selectedId)}
            >
              Add
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded border border-border"
              onClick={() => { setAddOpen(false); setSelectedId('') }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={14} /> Add contact
          </button>
        )
      )}
    </div>
  )
}

export default function DealDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const canWrite = user?.role !== 'viewer'

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDeal(id),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getAccounts(),
    enabled: canWrite,
  })
  const allAccounts = accountsData?.data ?? []

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: canWrite,
  })
  const allUsers = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
  const userLabel = (u) => u.name || u.email || u.id

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  if (!deal) return <div className="p-6 text-sm text-destructive">Deal not found</div>

  const save = async (data) => {
    await updateDeal(id, data)
    qc.invalidateQueries({ queryKey: ['deal', id] })
    qc.invalidateQueries({ queryKey: ['deals'] })
  }

  const field = (fieldName) => (val) => save({ [fieldName]: val })

  const tabs = [
    {
      id: 'contacts',
      label: 'Contacts',
      content: <DealContactsContent deal={deal} canWrite={canWrite} />,
    },
    {
      id: 'notes',
      label: 'Notes',
      content: <NotesTab entityType="deal" entityId={id} />,
    },
    {
      id: 'attachments',
      label: 'Attachments',
      content: <AttachmentsTab entityType="deal" entityId={id} />,
    },
    {
      id: 'activities',
      label: 'Activities',
      content: <ActivitiesTab entityType="deal" entityId={id} fetchFn={getDealActivities} />,
    },
  ]

  const leftPanel = (
    <div className="p-4 space-y-0">
      <InlineField label="Deal Name" value={deal.title} type="text" required readOnly={!canWrite} onSave={field('title')} />
      <InlineField label="Stage" value={deal.stage} type="select" options={STAGES} readOnly={!canWrite} onSave={field('stage')} />
      <InlineField
        label="Account"
        value={deal.account_id ?? ''}
        displayValue={deal.account?.name ?? deal.account_name ?? ''}
        type="select"
        optionObjects={[{ value: '', label: '—' }, ...allAccounts.map((a) => ({ value: a.id, label: a.name }))]}
        readOnly={!canWrite}
        onSave={(val) => save({ account_id: val || null })}
      />
      <InlineField label="Location" value={deal.location} type="select" options={LOCATIONS} readOnly={!canWrite} onSave={field('location')} />
      <InlineField label="Deal Type" value={deal.deal_type} type="select" options={DEAL_TYPES} readOnly={!canWrite} onSave={field('deal_type')} />
      <InlineField label="Source" value={deal.source} type="select" options={SOURCES} readOnly={!canWrite} onSave={field('source')} />
      <InlineField label="Project Domain" value={deal.project_domain} type="select" options={PROJECT_DOMAINS} readOnly={!canWrite} onSave={field('project_domain')} />
      <InlineField label="Description" value={deal.description} type="textarea" readOnly={!canWrite} onSave={field('description')} />
      <InlineMultiSelect label="Our Services" value={deal.our_services ?? []} options={OUR_SERVICES} readOnly={!canWrite} onSave={field('our_services')} />
      <InlineField
        label="Amount"
        value={deal.value != null ? formatAmount(deal.value) : null}
        type="text"
        readOnly={!canWrite}
        onSave={(val) => save({ value: val ? Number(String(val).replace(/[\s ]/g, '')) : null })}
      />
      <InlineField label="Currency" value={deal.currency} type="select" options={CURRENCIES} readOnly={!canWrite} onSave={field('currency')} />
      <InlineField label="Storage URL" value={deal.deal_storage} type="url" readOnly={!canWrite} onSave={field('deal_storage')} />
      <InlineField label="Deal Channel" value={deal.deal_channel} type="url" readOnly={!canWrite} onSave={field('deal_channel')} />
      <InlineField
        label="Deal Owner"
        value={deal.owner_id ?? ''}
        displayValue={deal.owner?.name ?? '—'}
        type="select"
        optionObjects={[{ value: '', label: '—' }, ...allUsers.map((u) => ({ value: u.id, label: userLabel(u) }))]}
        readOnly={!canWrite}
        onSave={(val) => save({ owner_id: val || null })}
      />
      <InlineField label="Created By" value={deal.created_by?.name ?? '—'} type="text" readOnly={true} />
      <InlineField label="Created Date" value={deal.created_at ? formatDate(deal.created_at) : '—'} type="text" readOnly={true} />
      <InlineField label="Expected Start Date" value={deal.expected_start_date} type="date" readOnly={!canWrite} onSave={field('expected_start_date')} />
      <InlineField label="Close Date" value={deal.close_date} type="date" readOnly={!canWrite} onSave={field('close_date')} />
      {deal.stage === 'lost' && (
        <InlineField label="Lost Reason" value={deal.lost_reason} type="textarea" readOnly={!canWrite} onSave={field('lost_reason')} />
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0">
        <Link to="/deals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={14} /> Deals
        </Link>
        <span className="text-muted-foreground text-sm">/</span>
        <h1 className="text-sm font-semibold truncate">{deal.title}</h1>
      </div>
      <div className="flex-1 min-h-0">
        <DetailLayout leftPanel={leftPanel} rightPanel={<EntityTabs tabs={tabs} />} />
      </div>
    </div>
  )
}
