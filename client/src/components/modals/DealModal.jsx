import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { getAccounts } from '../../api/accounts'
import { getUsers } from '../../api/users'

const STAGES = ['lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost']
const DEAL_TYPES = ['New Client', 'New Project with existing client', 'Upsale']
const DEAL_SOURCES = ['Founder', 'Marketing', 'Organic', 'BizDev', 'Customer', 'Referral', 'Agent', 'Event', 'Tender Platforms', 'Employee']
const LOCATIONS = ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']
const CURRENCIES = ['RUB', 'EUR', 'USD']
const PROJECT_DOMAINS = ['FinTech', 'MedTech', 'Agro', 'Oil and Gas', 'Commerce', 'HoReCa', 'Customer services', 'Production']
const OUR_SERVICES = ['Workshop', 'Webinar', 'Consulting', 'POC', 'Development', 'Accelerator', 'Performance']

const schema = z.object({
  title: z.string().min(1, 'Required'),
  value: z.coerce.number().min(0).optional(),
  stage: z.enum(['lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost']),
  close_date: z.string().optional(),
  expected_start_date: z.string().optional(),
  account_id: z.string().optional(),
  owner_id: z.string().optional(),
  location: z.string().optional(),
  deal_type: z.string().optional(),
  source: z.string().optional(),
  project_domain: z.string().optional(),
  description: z.string().optional(),
  our_services: z.array(z.string()).optional(),
  deal_storage: z.string().optional(),
  currency: z.string().optional(),
  lost_reason: z.string().optional(),
})

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
    </div>
  )
}

const emptyDefaults = {
  title: '', value: '', stage: 'lead', close_date: '', expected_start_date: '',
  account_id: '', owner_id: '', location: '', deal_type: '', source: '',
  project_domain: '', description: '', our_services: [],
  deal_storage: '', currency: 'RUB', lost_reason: '',
}

export default function DealModal({ open, initial, onSave, onClose, loading }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults,
  })

  const stage = useWatch({ control, name: 'stage' })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getAccounts({ limit: 200 }),
    enabled: open,
  })
  const accounts = accountsData?.data ?? []

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: open,
  })
  const users = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
  const userLabel = (u) => u.name || u.email || u.id

  useEffect(() => {
    reset(initial ? {
      title: initial.title || '',
      value: initial.value || '',
      stage: initial.stage || 'lead',
      close_date: initial.close_date ? initial.close_date.split('T')[0] : '',
      expected_start_date: initial.expected_start_date ? initial.expected_start_date.split('T')[0] : '',
      account_id: initial.account_id || '',
      owner_id: initial.owner_id || '',
      location: initial.location || '',
      deal_type: initial.deal_type || '',
      source: initial.source || '',
      project_domain: initial.project_domain || '',
      description: initial.description || '',
      our_services: initial.our_services || [],
      deal_storage: initial.deal_storage || '',
      currency: initial.currency || 'RUB',
      lost_reason: initial.lost_reason || '',
    } : emptyDefaults)
  }, [initial, open, reset])

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">{initial ? 'Edit Deal' : 'New Deal'}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><X size={16} /></button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <Field label="Deal Name *" error={errors.title}>
              <input {...register('title')} className={inputClass} />
            </Field>

            <Field label="Stage *" error={errors.stage}>
              <select {...register('stage')} className={inputClass}>
                {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>

            {stage === 'lost' && (
              <Field label="Lost Reason" error={errors.lost_reason}>
                <textarea {...register('lost_reason')} rows={2} className={inputClass} placeholder="Describe the reason..." />
              </Field>
            )}

            <Field label="Account" error={errors.account_id}>
              <select {...register('account_id')} className={inputClass}>
                <option value="">— not selected —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>

            <Field label="Deal Owner" error={errors.owner_id}>
              <select {...register('owner_id')} className={inputClass}>
                <option value="">— not selected —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
              </select>
            </Field>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Deal Parameters</p>

            <Field label="Location" error={errors.location}>
              <select {...register('location')} className={inputClass}>
                <option value="">— not selected —</option>
                {LOCATIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Deal Type" error={errors.deal_type}>
              <select {...register('deal_type')} className={inputClass}>
                <option value="">— not selected —</option>
                {DEAL_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Source" error={errors.source}>
              <select {...register('source')} className={inputClass}>
                <option value="">— not selected —</option>
                {DEAL_SOURCES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Project Domain" error={errors.project_domain}>
              <select {...register('project_domain')} className={inputClass}>
                <option value="">— not selected —</option>
                {PROJECT_DOMAINS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Description" error={errors.description}>
              <textarea {...register('description')} rows={3} className={inputClass} />
            </Field>

            <Field label="Our Services" error={errors.our_services}>
              <div className="space-y-1">
                {OUR_SERVICES.map(svc => (
                  <label key={svc} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input {...register('our_services')} type="checkbox" value={svc} className="h-3.5 w-3.5 rounded border-border" />
                    {svc}
                  </label>
                ))}
              </div>
            </Field>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Financials & Dates</p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" error={errors.value}>
                <input {...register('value')} type="number" min="0" className={inputClass} />
              </Field>
              <Field label="Currency" error={errors.currency}>
                <select {...register('currency')} className={inputClass}>
                  {CURRENCIES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Expected Start Date" error={errors.expected_start_date}>
              <input {...register('expected_start_date')} type="date" className={inputClass} />
            </Field>

            <Field label="Close Date" error={errors.close_date}>
              <input {...register('close_date')} type="date" className={inputClass} />
            </Field>

            <Field label="Storage URL" error={errors.deal_storage}>
              <input {...register('deal_storage')} type="url" className={inputClass} placeholder="https://drive.google.com/..." />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
