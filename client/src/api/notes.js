import { apiFetch } from './client'

export const getNotes = (entityType, entityId) =>
  apiFetch(`/api/v1/${entityType}s/${entityId}/notes`)

export const createNote = (data) =>
  apiFetch('/api/v1/notes', { method: 'POST', body: JSON.stringify(data) })

export const updateNote = (id, content) =>
  apiFetch(`/api/v1/notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) })

export const deleteNote = (id) =>
  apiFetch(`/api/v1/notes/${id}`, { method: 'DELETE' })
