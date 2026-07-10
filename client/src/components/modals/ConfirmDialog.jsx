import * as AlertDialog from '@radix-ui/react-alert-dialog'

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, loading }) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => !v && onCancel?.()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-6 w-full max-w-md">
          <AlertDialog.Title className="text-lg font-semibold mb-2">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="text-sm text-muted-foreground mb-6">
              {description}
            </AlertDialog.Description>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                onClick={onCancel}
              >
                Отмена
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-red-600 transition-colors disabled:opacity-50"
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? 'Удаление...' : 'Удалить'}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
