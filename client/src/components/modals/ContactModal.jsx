import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { getAccounts } from '../../api/accounts'

const LOCATIONS = ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']
const LANGUAGES = ['Russian', 'English']
const COMM_CHANNELS = ['Telegram', 'WhatsApp', 'Email', 'LinkedIn']
const SOURCES = ['Founder', 'Marketing', 'Organic', 'BizDev', 'Customer', 'Referral', 'Agent', 'Event', 'Employee']

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email_corp: z.string().email('Invalid email').optional().or(z.literal('')),
  email_personal: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  account_id: z.string().optional(),
  telegram: z.string().optional(),
  linkedin: z.string().optional(),
  facebook: z.string().optional(),
  location: z.string().optional(),
  language: z.string().optional(),
  preferred_communication: z.string().optional(),
  birthday: z.string().optional(),
  comments: z.string().optional(),
  source: z.string().optional(),
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
  first_name: '', last_name: '', email_corp: '', email_personal: '',
  phone: '', position: '', account_id: '',
  telegram: '', linkedin: '', facebook: '',
  location: '', language: '', preferred_communication: '',
  birthday: '', comments: '', source: '',
}

export default function ContactModal({ open, initial, onSave, onClose, loading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getAccounts({ limit: 200 }),
    enabled: open,
  })
  const accounts = accountsData?.data ?? []

  useEffect(() => {
    reset(initial ? {
      first_name: initial.first_name || '',
      last_name: initial.last_name || '',
      email_corp: initial.email_corp || '',
      email_personal: initial.email_personal || '',
      phone: initial.phone || '',
      position: initial.position || '',
      account_id: initial.account_id || '',
      telegram: initial.telegram || '',
      linkedin: initial.linkedin || '',
      facebook: initial.facebook || '',
      location: initial.location || '',
      language: initial.language || '',
      preferred_communication: initial.preferred_communication || '',
      birthday: initial.birthday ? initial.birthday.split('T')[0] : '',
      comments: initial.comments || '',
      source: initial.source || '',
    } : emptyDefaults)
  }, [initial, open, reset])

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">
              {initial ? 'Edit Contact' : 'New Contact'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><X size={16} /></button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <Field label="First Name *" error={errors.first_name}>
              <input {...register('first_name')} className={inputClass} />
            </Field>
            <Field label="Last Name *" error={errors.last_name}>
              <input {...register('last_name')} className={inputClass} />
            </Field>
            <Field label="Position" error={errors.position}>
              <input {...register('position')} className={inputClass} />
            </Field>
            <Field label="Account" error={errors.account_id}>
              <select {...register('account_id')} className={inputClass}>
                <option value="">— not selected —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Contact Details</p>
            <Field label="Corporate Email" error={errors.email_corp}>
              <input {...register('email_corp')} type="email" className={inputClass} />
            </Field>
            <Field label="Personal Email" error={errors.email_personal}>
              <input {...register('email_personal')} type="email" className={inputClass} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <input {...register('phone')} className={inputClass} />
            </Field>
            <Field label="Telegram" error={errors.telegram}>
              <input {...register('telegram')} className={inputClass} placeholder="@handle" />
            </Field>
            <Field label="LinkedIn" error={errors.linkedin}>
              <input {...register('linkedin')} className={inputClass} placeholder="https://linkedin.com/in/..." />
            </Field>
            <Field label="Facebook" error={errors.facebook}>
              <input {...register('facebook')} className={inputClass} placeholder="https://facebook.com/..." />
            </Field>
            <Field label="Preferred Channel" error={errors.preferred_communication}>
              <select {...register('preferred_communication')} className={inputClass}>
                <option value="">— not selected —</option>
                {COMM_CHANNELS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Profile</p>
            <Field label="Location" error={errors.location}>
              <select {...register('location')} className={inputClass}>
                <option value="">— not selected —</option>
                {LOCATIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Language" error={errors.language}>
              <select {...register('language')} className={inputClass}>
                <option value="">— not selected —</option>
                {LANGUAGES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Birthday" error={errors.birthday}>
              <input {...register('birthday')} type="date" className={inputClass} />
            </Field>
            <Field label="Source" error={errors.source}>
              <select {...register('source')} className={inputClass}>
                <option value="">— not selected —</option>
                {SOURCES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Comments" error={errors.comments}>
              <textarea {...register('comments')} rows={3} className={inputClass} />
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
