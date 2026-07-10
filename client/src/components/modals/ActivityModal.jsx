import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

const schema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'task']),
  description: z.string().optional(),
  due_date: z.string().optional(),
  completed: z.boolean().optional(),
})

const TYPE_OPTIONS = [
  { value: 'call', label: 'Звонок' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Встреча' },
  { value: 'task', label: 'Задача' },
]

export default function ActivityModal({ open, initial, onSave, onClose, loading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: 'task', description: '', due_date: '', completed: false },
  })

  useEffect(() => {
    if (initial) {
      reset({
        type: initial.type,
        description: initial.description || '',
        due_date: initial.due_date ? initial.due_date.split('T')[0] : '',
        completed: initial.completed,
      })
    } else {
      reset({ type: 'task', description: '', due_date: '', completed: false })
    }
  }, [initial, reset, open])

  const onSubmit = (data) => {
    onSave({
      ...data,
      due_date: data.due_date || null,
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">
              {initial ? 'Редактировать активность' : 'Новая активность'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Тип *</label>
              <select
                {...register('type')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.type && <p className="text-xs text-destructive mt-1">{errors.type.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Описание</label>
              <textarea
                {...register('description')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Срок</label>
              <input
                type="date"
                {...register('due_date')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {initial && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register('completed')} className="rounded" />
                Выполнено
              </label>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
