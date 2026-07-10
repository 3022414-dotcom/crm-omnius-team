import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { getContact, updateContact, getContactActivities, getContactDeals } from '../../api/contacts'
import { getAccounts } from '../../api/accounts'
import { useAuthStore } from '../../stores/authStore'
import DetailLayout from '../../components/detail/DetailLayout'
import InlineField from '../../components/detail/InlineField'
import ContactAvatar from '../../components/detail/ContactAvatar'
import EntityTabs from '../../components/detail/EntityTabs'
import NotesTab from '../../components/tabs/NotesTab'
import AttachmentsTab from '../../components/tabs/AttachmentsTab'
import ActivitiesTab from '../../components/tabs/ActivitiesTab'
import { formatAmount } from '../../lib/date'

const LOCATIONS = ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']
const LANGUAGES = ['Russian', 'English']
const PREFERRED_CHANNELS = ['Telegram', 'WhatsApp', 'Email', 'LinkedIn']
const SOURCES = ['Founder', 'Marketing', 'Organic', 'BizDev', 'Customer', 'Referral', 'Agent', 'Event', 'Employee']

function ContactDealsContent({ contactId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['contactDeals', contactId],
    queryFn: () => getContactDeals(contactId),
  })
  const deals = Array.isArray(data) ? data : []
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

export default function ContactDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const canWrite = user?.role !== 'viewer'

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => getContact(id),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getAccounts(),
    enabled: canWrite,
  })
  const allAccounts = accountsData?.data ?? []

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  if (!contact) return <div className="p-6 text-sm text-destructive">Contact not found</div>

  const save = async (data) => {
    await updateContact(id, data)
    qc.invalidateQueries({ queryKey: ['contact', id] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
  }

  const field = (fieldName) => (val) => save({ [fieldName]: val })

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Contact'

  const tabs = [
    {
      id: 'deals',
      label: 'Deals',
      content: <ContactDealsContent contactId={id} />,
    },
    {
      id: 'notes',
      label: 'Notes',
      content: <NotesTab entityType="contact" entityId={id} />,
    },
    {
      id: 'attachments',
      label: 'Attachments',
      content: <AttachmentsTab entityType="contact" entityId={id} />,
    },
    {
      id: 'activities',
      label: 'Activities',
      content: <ActivitiesTab entityType="contact" entityId={id} fetchFn={getContactActivities} />,
    },
  ]

  const leftPanel = (
    <div className="p-4 space-y-0">
      <ContactAvatar
        contactId={id}
        photoUrl={contact.photo_path ? `/${contact.photo_path}` : null}
        firstName={contact.first_name || ''}
        lastName={contact.last_name || ''}
        canEdit={canWrite}
        onPhotoChange={() => qc.invalidateQueries({ queryKey: ['contact', id] })}
      />
      <InlineField label="First Name" value={contact.first_name} type="text" required readOnly={!canWrite} onSave={field('first_name')} />
      <InlineField label="Last Name" value={contact.last_name} type="text" required readOnly={!canWrite} onSave={field('last_name')} />
      <InlineField label="Position" value={contact.position} type="text" readOnly={!canWrite} onSave={field('position')} />
      <InlineField
        label="Account"
        value={contact.account_id ?? ''}
        displayValue={contact.account_name ?? ''}
        type="select"
        optionObjects={[{ value: '', label: '—' }, ...allAccounts.map((a) => ({ value: a.id, label: a.name }))]}
        readOnly={!canWrite}
        onSave={(val) => save({ account_id: val || null })}
      />
      <div className="h-px bg-border my-2" />
      <InlineField label="Corporate Email" value={contact.email_corp} type="email" readOnly={!canWrite} onSave={field('email_corp')} />
      <InlineField label="Personal Email" value={contact.email_personal} type="email" readOnly={!canWrite} onSave={field('email_personal')} />
      <InlineField label="Phone" value={contact.phone} type="text" readOnly={!canWrite} onSave={field('phone')} />
      <InlineField label="Telegram" value={contact.telegram} type="text" readOnly={!canWrite} onSave={field('telegram')} />
      <InlineField label="LinkedIn" value={contact.linkedin} type="url" readOnly={!canWrite} onSave={field('linkedin')} />
      <InlineField label="Facebook" value={contact.facebook} type="url" readOnly={!canWrite} onSave={field('facebook')} />
      <div className="h-px bg-border my-2" />
      <InlineField label="Location" value={contact.location} type="select" options={LOCATIONS} readOnly={!canWrite} onSave={field('location')} />
      <InlineField label="Language" value={contact.language} type="select" options={LANGUAGES} readOnly={!canWrite} onSave={field('language')} />
      <InlineField label="Preferred Channel" value={contact.preferred_communication} type="select" options={PREFERRED_CHANNELS} readOnly={!canWrite} onSave={field('preferred_communication')} />
      <InlineField label="Birthday" value={contact.birthday} type="date" readOnly={!canWrite} onSave={field('birthday')} />
      <InlineField label="Source" value={contact.source} type="select" options={SOURCES} readOnly={!canWrite} onSave={field('source')} />
      <InlineField label="Comments" value={contact.comments} type="textarea" readOnly={!canWrite} onSave={field('comments')} />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-shrink-0">
        <Link to="/contacts" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={14} /> Contacts
        </Link>
        <span className="text-muted-foreground text-sm">/</span>
        <h1 className="text-sm font-semibold truncate">{fullName}</h1>
      </div>
      <div className="flex-1 min-h-0">
        <DetailLayout leftPanel={leftPanel} rightPanel={<EntityTabs tabs={tabs} />} />
      </div>
    </div>
  )
}
