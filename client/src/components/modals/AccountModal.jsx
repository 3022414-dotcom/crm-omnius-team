import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { getUsers } from '../../api/users'

const ACCOUNT_TYPES = ['Prospect', 'Client', 'Partner', 'Vendor']
const LOCATIONS = ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']
const INDUSTRIES = ['FinTech', 'MedTech', 'Agro', 'Oil and Gas', 'Commerce', 'HoReCa', 'Customer services', 'Production']
const SIZES = ['1-50', '51-200', '201-1000', '1000+']

const schema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  is_target: z.boolean().default(false),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  account_storage: z.string().optional(),
  account_manager_id: z.string().optional(),
})

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
    </div>
  )
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

const emptyDefaults = {
  name: '', type: '', location: '', industry: '', size: '',
  is_target: false, website: '', phone: '', address: '', notes: '',
  account_storage: '', account_manager_id: '',
}

export default function AccountModal({ open, initial, onSave, onClose, loading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults,
  })

  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: getUsers, enabled: open })
  const users = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
  const userLabel = (u) => u.name || u.email || u.id

  useEffect(() => {
    reset(initial ? {
      name: initial.name || '',
      type: initial.type || '',
      location: initial.location || '',
      industry: initial.industry || '',
      size: initial.size || '',
      is_target: initial.is_target ?? false,
      website: initial.website || '',
      phone: initial.phone || '',
      address: initial.address || '',
      notes: initial.notes || '',
      account_storage: initial.account_storage || '',
      account_manager_id: initial.account_manager_id || '',
    } : emptyDefaults)
  }, [initial, open, reset])

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">
              {initial ? 'Edit Account' : 'New Account'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <Field label="Name *" error={errors.name}>
              <input {...register('name')} className={inputClass} />
            </Field>

            <Field label="Type" error={errors.type}>
              <select {...register('type')} className={inputClass}>
                <option value="">— not selected —</option>
                {ACCOUNT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Industry" error={errors.industry}>
              <select {...register('industry')} className={inputClass}>
                <option value="">— not selected —</option>
                {INDUSTRIES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Size" error={errors.size}>
              <select {...register('size')} className={inputClass}>
                <option value="">— not selected —</option>
                {SIZES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Location" error={errors.location}>
              <select {...register('location')} className={inputClass}>
                <option value="">— not selected —</option>
                {LOCATIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <div className="flex items-center gap-2">
              <input {...register('is_target')} type="checkbox" id="is_target" className="h-4 w-4 rounded border-border" />
              <label htmlFor="is_target" className="text-sm font-medium">Target Account</label>
            </div>

            <Field label="Website" error={errors.website}>
              <input {...register('website')} type="url" className={inputClass} placeholder="https://..." />
            </Field>

            <Field label="Phone" error={errors.phone}>
              <input {...register('phone')} className={inputClass} />
            </Field>

            <Field label="Address" error={errors.address}>
              <input {...register('address')} className={inputClass} />
            </Field>

            <Field label="Storage URL" error={errors.account_storage}>
              <input {...register('account_storage')} type="url" className={inputClass} placeholder="https://drive.google.com/..." />
            </Field>

            <Field label="Account Manager" error={errors.account_manager_id}>
              <select {...register('account_manager_id')} className={inputClass}>
                <option value="">— not selected —</option>
                {users.map(u => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
              </select>
            </Field>

            <Field label="Notes" error={errors.notes}>
              <textarea {...register('notes')} rows={3} className={inputClass} />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors" onClick={onClose}>
                Cancel
              </button>
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
