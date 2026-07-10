import { apiFetch } from './client'

export const getAccounts = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/v1/accounts${qs ? `?${qs}` : ''}`)
}

export const getAccount = (id) => apiFetch(`/api/v1/accounts/${id}`)

export const createAccount = (data) =>
  apiFetch('/api/v1/accounts', { method: 'POST', body: JSON.stringify(data) })

export const updateAccount = (id, data) =>
  apiFetch(`/api/v1/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteAccount = (id) =>
  apiFetch(`/api/v1/accounts/${id}`, { method: 'DELETE' })

export const getAccountContacts = (id) =>
  apiFetch(`/api/v1/accounts/${id}/contacts`)

export const getAccountActivities = (id) =>
  apiFetch(`/api/v1/accounts/${id}/activities`)
