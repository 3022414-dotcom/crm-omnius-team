import { apiFetch } from './client'

export const getContacts = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/v1/contacts${qs ? `?${qs}` : ''}`)
}

export const getContact = (id) => apiFetch(`/api/v1/contacts/${id}`)

export const createContact = (data) =>
  apiFetch('/api/v1/contacts', { method: 'POST', body: JSON.stringify(data) })

export const updateContact = (id, data) =>
  apiFetch(`/api/v1/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteContact = (id) =>
  apiFetch(`/api/v1/contacts/${id}`, { method: 'DELETE' })

export const getContactActivities = (id) =>
  apiFetch(`/api/v1/contacts/${id}/activities`)

export const getContactDeals = (id) =>
  apiFetch(`/api/v1/contacts/${id}/deals`)

export const uploadContactPhoto = (id, file) => {
  const formData = new FormData()
  formData.append('photo', file)
  return apiFetch(`/api/v1/contacts/${id}/photo`, { method: 'POST', body: formData })
}

export const deleteContactPhoto = (id) =>
  apiFetch(`/api/v1/contacts/${id}/photo`, { method: 'DELETE' })
