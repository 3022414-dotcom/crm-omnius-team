import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

function formatDateDisplay(val) {
  if (!val) return null
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toDateInput(val) {
  if (!val) return ''
  return val.split('T')[0]
}

export default function InlineField({
  label,
  value,
  displayValue,
  onSave,
  type = 'text',
  options = [],
  optionObjects,
  readOnly = false,
  required = false,
  placeholder = '—',
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (type !== 'date') inputRef.current.select?.()
    }
  }, [isEditing, type])

  const doSave = async (val) => {
    if (savingRef.current) return
    savingRef.current = true
    const finalVal = (val === '' || val == null) ? null : val
    if (required && !finalVal) {
      setError(`${label} is required`)
      savingRef.current = false
      return
    }
    setIsEditing(false)
    setError(null)
    setSaving(true)
    try {
      await onSave(finalVal)
    } catch {
      toast.error(`Failed to save ${label}`)
    } finally {
      setSaving(false)
      savingRef.current = false
    }
  }

  const handleClick = () => {
    if (readOnly || saving) return
    if (type === 'toggle') {
      doSave(!value)
      return
    }
    setTempValue(type === 'date' ? toDateInput(value) : (value ?? ''))
    setIsEditing(true)
    setError(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      doSave(tempValue)
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setError(null)
    }
  }

  const handleBlur = () => {
    if (isEditing) doSave(tempValue)
  }

  const handleSelectChange = (e) => {
    const val = e.target.value
    setTempValue(val)
    doSave(val)
  }

  // Computed display value in read mode
  const readDisplay = displayValue !== undefined ? displayValue : (
    type === 'date' ? formatDateDisplay(value) : (
      type === 'toggle' ? null : (value ?? null)
    )
  )

  const inputClass = 'w-full text-sm border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary'

  if (isEditing) {
    return (
      <div className="py-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
        {type === 'select' ? (
          <select
            ref={inputRef}
            value={tempValue}
            onChange={handleSelectChange}
            onBlur={() => {
              if (!savingRef.current) {
                setIsEditing(false)
                setError(null)
              }
            }}
            className={inputClass}
          >
            <option value="">—</option>
            {optionObjects
              ? optionObjects.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
              : options.map((o) => <option key={o} value={o}>{o}</option>)
            }
          </select>
        ) : type === 'textarea' ? (
          <textarea
            ref={inputRef}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={3}
            className={cn(inputClass, 'resize-none')}
          />
        ) : (
          <input
            ref={inputRef}
            type={type === 'url' ? 'url' : type === 'email' ? 'email' : type === 'date' ? 'date' : 'text'}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        )}
        {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      </div>
    )
  }

  return (
    <div className="py-1.5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
      <div
        className={cn(
          'flex items-center gap-1.5 min-h-[22px] text-sm',
          !readOnly && 'cursor-pointer hover:text-primary'
        )}
        onClick={handleClick}
      >
        {type === 'toggle' ? (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
            value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {value ? 'Yes' : 'No'}
          </span>
        ) : type === 'url' && readDisplay ? (
          <a
            href={readDisplay}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline truncate"
            onClick={(e) => !readOnly && e.stopPropagation()}
          >
            {readDisplay}
          </a>
        ) : (
          <span className={readDisplay ? 'text-foreground' : 'text-muted-foreground italic'}>
            {readDisplay || placeholder}
          </span>
        )}
        {saving && <Loader2 size={12} className="animate-spin text-muted-foreground flex-shrink-0" />}
      </div>
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  )
}
