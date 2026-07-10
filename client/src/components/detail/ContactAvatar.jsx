import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { uploadContactPhoto, deleteContactPhoto } from '../../api/contacts'

const MAX_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ContactAvatar({ contactId, photoUrl, firstName = '', lastName = '', canEdit, onPhotoChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || '?'

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('File too large (max 5 MB)')
      return
    }

    setError(null)
    setUploading(true)
    try {
      await uploadContactPhoto(contactId, file)
      onPhotoChange?.()
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    setError(null)
    setUploading(true)
    try {
      await deleteContactPhoto(contactId)
      onPhotoChange?.()
    } catch {
      toast.error('Failed to delete photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      <div className="relative group">
        <div
          className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-primary/10 text-primary font-semibold text-xl select-none ${canEdit ? 'cursor-pointer' : ''}`}
          onClick={() => canEdit && !uploading && fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          ) : photoUrl ? (
            <img src={photoUrl} alt={`${firstName} ${lastName}`} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        {canEdit && !uploading && (
          <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Camera size={18} className="text-white" />
          </div>
        )}
      </div>

      {canEdit && photoUrl && !uploading && (
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 size={11} />
          Delete photo
        </button>
      )}

      {canEdit && !photoUrl && !uploading && (
        <span className="text-xs text-muted-foreground">Click to upload photo</span>
      )}

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
