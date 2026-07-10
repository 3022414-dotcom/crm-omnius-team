import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAccount, updateAccount, getAccountContacts, getAccountActivities } from '../../api/accounts'
import { getDeals } from '../../api/deals'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../../components/modals/ConfirmDialog'
import AccountModal from '../../components/modals/AccountModal'
import NotesTab from '../../components/tabs/NotesTab'
import AttachmentsTab from '../../components/tabs/AttachmentsTab'
import ActivitiesTab from '../../components/tabs/ActivitiesTab'
import { ChevronLeft, Pencil, Globe, Phone, MapPin, Building2, Target, Users, Link as LinkIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatAmount } from '../../lib/date'

const TABS = ['Контакты', 'Сделки', 'Заметки', 'Вложения', 'Активности']

export default function AccountDetail() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState('Контакты')
  const [editOpen, setEditOpen] = useState(false)

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => getAccount(id),
  })

  const { data: contactsData } = useQuery({
    queryKey: ['accountContacts', id],
    queryFn: () => getAccountContacts(id),
    enabled: tab === 'Контакты',
  })
  const contacts = contactsData?.data ?? []

  const { data: dealsData } = useQuery({
    queryKey: ['accountDeals', id],
    queryFn: () => getDeals({ account_id: id }),
    enabled: tab === 'Сделки',
  })
  const deals = dealsData?.data ?? []

  const updateMut = useMutation({
    mutationFn: (data) => updateAccount(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['account', id] }); qc.invalidateQueries({ queryKey: ['accounts'] }); setEditOpen(false); toast.success('Аккаунт обновлён') },
    onError: () => toast.error('Не удалось обновить аккаунт'),
  })

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка...</div>
  if (!account) return <div className="p-6 text-sm text-destructive">Аккаунт не найден</div>

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link to="/accounts" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ChevronLeft size={14} />
            Аккаунты
          </Link>
          <h1 className="text-xl font-semibold">{account.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {account.type && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{account.type}</span>}
            {account.is_target && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium"><Target size={11} />Target</span>}
            {account.industry && <span className="flex items-center gap-1"><Building2 size={12} />{account.industry}</span>}
            {account.location && <span className="flex items-center gap-1"><MapPin size={12} />{account.location}</span>}
            {account.size && <span className="text-xs">{account.size} чел.</span>}
            {account.website && <a href={account.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Globe size={12} />{account.website}</a>}
            {account.phone && <span className="flex items-center gap-1"><Phone size={12} />{account.phone}</span>}
            {account.address && <span className="flex items-center gap-1"><MapPin size={12} />{account.address}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            {account.account_manager_name && <span className="flex items-center gap-1"><Users size={12} />Account Manager: {account.account_manager_name}</span>}
            {account.account_storage && <a href={account.account_storage} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><LinkIcon size={12} />Account Storage</a>}
          </div>
        </div>
        {user?.role !== 'viewer' && (
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors"
            onClick={() => setEditOpen(true)}
          >
            <Pencil size={13} />
            Редактировать
          </button>
        )}
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm border-b-2 transition-colors',
                tab === t
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {tab === 'Контакты' && (
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет контактов</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Имя</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Должность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <Link to={`/contacts/${c.id}`} className="font-medium hover:text-primary transition-colors">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.email || '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.position || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'Сделки' && (
          <div className="space-y-2">
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет сделок</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Название</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Стадия</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <Link to={`/deals/${d.id}`} className="font-medium hover:text-primary transition-colors">{d.title}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{d.stage}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatAmount(d.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'Заметки' && <NotesTab entityType="account" entityId={id} />}
        {tab === 'Вложения' && <AttachmentsTab entityType="account" entityId={id} />}
        {tab === 'Активности' && <ActivitiesTab entityType="account" entityId={id} fetchFn={getAccountActivities} />}
      </div>

      <AccountModal
        open={editOpen}
        initial={account}
        onSave={updateMut.mutate}
        onClose={() => setEditOpen(false)}
        loading={updateMut.isPending}
      />
    </div>
  )
}
