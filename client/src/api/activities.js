import { apiFetch } from './client'

export const listActivities = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/v1/activities${qs ? `?${qs}` : ''}`)
}

export const createActivity = (data) =>
  apiFetch('/api/v1/activities', { method: 'POST', body: JSON.stringify(data) })

export const updateActivity = (id, data) =>
  apiFetch(`/api/v1/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteActivity = (id) =>
  apiFetch(`/api/v1/activities/${id}`, { method: 'DELETE' })
