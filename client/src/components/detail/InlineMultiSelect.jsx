import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function InlineMultiSelect({ label, value = [], options = [], onSave, readOnly = false }) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState([])
  const [saving, setSaving] = useState(false)

  const openEditor = () => {
    if (readOnly || saving) return
    setTempValue([...(value ?? [])])
    setIsEditing(true)
  }

  const toggle = (opt) => {
    setTempValue((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    )
  }

  const save = async () => {
    setSaving(true)
    setIsEditing(false)
    try {
      await onSave(tempValue)
    } catch {
      toast.error(`Failed to save ${label}`)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setIsEditing(false)
    setTempValue([])
  }

  if (isEditing) {
    return (
      <div className="py-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
        <div className="border border-border rounded p-2 bg-background space-y-1">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/30 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={tempValue.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded"
              />
              {opt}
            </label>
          ))}
          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
            <button
              onClick={save}
              className="text-xs px-2 py-1 rounded bg-primary text-white hover:opacity-90"
            >
              Done
            </button>
            <button
              onClick={cancel}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-1.5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
      <div
        className={`flex flex-wrap items-center gap-1 min-h-[22px] ${!readOnly ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={openEditor}
      >
        {(value ?? []).length === 0 ? (
          <span className="text-sm text-muted-foreground italic">—</span>
        ) : (
          (value ?? []).map((s) => (
            <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {s}
            </span>
          ))
        )}
        {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>
    </div>
  )
}
