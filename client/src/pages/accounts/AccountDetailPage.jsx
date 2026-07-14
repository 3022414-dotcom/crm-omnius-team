import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { getAccount, updateAccount, getAccountContacts, getAccountActivities } from '../../api/accounts'
import { getDeals } from '../../api/deals'
import { getUsers } from '../../api/users'
import { useAuthStore } from '../../stores/authStore'
import DetailLayout from '../../components/detail/DetailLayout'
import InlineField from '../../components/detail/InlineField'
import EntityTabs from '../../components/detail/EntityTabs'
import NotesTab from '../../components/tabs/NotesTab'
import AttachmentsTab from '../../components/tabs/AttachmentsTab'
import ActivitiesTab from '../../components/tabs/ActivitiesTab'
import { formatAmount } from '../../lib/date'

const ACCOUNT_TYPES = ['Prospect', 'Client', 'Partner', 'Vendor']
const INDUSTRIES = ['FinTech', 'MedTech', 'Agro', 'Oil and Gas', 'Commerce', 'HoReCa', 'Customer services', 'Production']
const SIZES = ['1-50', '51-200', '201-1000', '1000+']
const LOCATIONS = ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']

function AccountContactsContent({ accountId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['accountContacts', accountId],
    queryFn: () => getAccountContacts(accountId),
  })
  const contacts = data?.data ?? []
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (contacts.length === 0) return <p className="text-sm text-muted-foreground italic">No contacts yet</p>
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Position</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-2.5">
                <Link to={`/contacts/${c.id}`} className="font-medium hover:text-primary">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{c.position || '—'}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{c.email || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccountDealsContent({ accountId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['accountDeals', accountId],
    queryFn: () => getDeals({ account_id: accountId }),
  })
  const deals = data?.data ?? []
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (deals.length === 0) return <p className="text-sm text-muted-foreground italic">No deals yet</p>
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Stage</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Value</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-2.5">
                <Link to={`/deals/${d.id}`} className="font-medium hover:text-primary">
                  {d.title}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground capitalize">{d.stage}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatAmount(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AccountDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const canWrite = user?.role !== 'viewer'

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => getAccount(id),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: canWrite,
  })
  const users = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
  const userLabel = (u) => u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  if (!account) return <div className="p-6 text-sm text-destructive">Account not found</div>

  const save = async (data) => {
    await updateAccount(id, data)
    qc.invalidateQueries({ queryKey: ['account', id] })
    qc.invalidateQueries({ queryKey: ['accounts'] })
  }

  const field = (fieldName) => (val) => save({ [fieldName]: val })

  const tabs = [
    {
      id: 'contacts',
      label: 'Contacts',
      content: <AccountContactsContent accountId={id} />,
    },
    {
      id: 'deals',
      label: 'Deals',
      content: <AccountDealsContent accountId={id} />,
    },
    {
      id: 'notes',
      label: 'Notes',
      content: <NotesTab entityType="account" entityId={id} />,
    },
    {
      id: 'attachments',
      label: 'Attachments',
      content: <AttachmentsTab entityType="account" entityId={id} />,
    },
    {
      id: 'activities',
      label: 'Activities',
      content: <ActivitiesTab entityType="account" entityId={id} fetchFn={getAccountActivities} />,
    },
  ]

  const leftPanel = (
    <div className="p-4 space-y-0">
      <InlineField label="Name" value={account.name} type="text" required readOnly={!canWrite} onSave={field('name')} />
      <InlineField label="Type" value={account.type} type="select" options={ACCOUNT_TYPES} readOnly={!canWrite} onSave={field('type')} />
      <InlineField label="Industry" value={account.industry} type="select" options={INDUSTRIES} readOnly={!canWrite} onSave={field('industry')} />
      <InlineField label="Size" value={account.size} type="select" options={SIZES} readOnly={!canWrite} onSave={field('size')} />
      <InlineField label="Location" value={account.location} type="select" options={LOCATIONS} readOnly={!canWrite} onSave={field('location')} />
      <InlineField label="Target Account" value={account.is_target} type="toggle" readOnly={!canWrite} onSave={field('is_target')} />
      <div className="h-px bg-border my-2" />
      <InlineField label="Website" value={account.website} type="url" readOnly={!canWrite} onSave={field('website')} />
      <InlineField label="Phone" value={account.phone} type="text" readOnly={!canWrite} onSave={field('phone')} />
      <InlineField label="Address" value={account.address} type="textarea" readOnly={!canWrite} onSave={field('address')} />
      <div className="h-px bg-border my-2" />
      <InlineField label="Storage URL" value={account.account_storage} type="url" readOnly={!canWrite} onSave={field('account_storage')} />
      <InlineField
        label="Account Manager"
        value={account.account_manager_id ?? ''}
        displayValue={account.account_manager_name ?? ''}
        type="select"
        optionObjects={[{ value: '', label: '—' }, ...users.map((u) => ({ value: u.id, label: userLabel(u) }))]}
        readOnly={!canWrite}
        onSave={(val) => save({ account_manager_id: val || null })}
      />
      <InlineField label="Created By" value={account.created_by?.name ?? '—'} type="text" readOnly={true} />
      <InlineField label="Notes" value={account.notes} type="textarea" readOnly={!canWrite} onSave={field('notes')} />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0">
        <Link to="/accounts" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={14} /> Accounts
        </Link>
        <span className="text-muted-foreground text-sm">/</span>
        <h1 className="text-sm font-semibold truncate">{account.name}</h1>
      </div>
      <div className="flex-1 min-h-0">
        <DetailLayout leftPanel={leftPanel} rightPanel={<EntityTabs tabs={tabs} />} />
      </div>
    </div>
  )
}
