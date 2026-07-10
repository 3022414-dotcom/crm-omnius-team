import { apiFetch } from './client'

export const getAttachments = (entityType, entityId) =>
  apiFetch(`/api/v1/${entityType}s/${entityId}/attachments`)

export const uploadAttachment = (formData) =>
  apiFetch('/api/v1/attachments', { method: 'POST', body: formData })

export const deleteAttachment = (id) =>
  apiFetch(`/api/v1/attachments/${id}`, { method: 'DELETE' })
