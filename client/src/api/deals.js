import { apiFetch } from './client'

export const getDeals = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/v1/deals${qs ? `?${qs}` : ''}`)
}

export const getDeal = (id) => apiFetch(`/api/v1/deals/${id}`)

export const createDeal = (data) =>
  apiFetch('/api/v1/deals', { method: 'POST', body: JSON.stringify(data) })

export const updateDeal = (id, data) =>
  apiFetch(`/api/v1/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteDeal = (id) =>
  apiFetch(`/api/v1/deals/${id}`, { method: 'DELETE' })

export const getDealActivities = (id) =>
  apiFetch(`/api/v1/deals/${id}/activities`)

export const getKanbanDeals = () => apiFetch('/api/v1/deals/kanban')

export const moveDealStage = (id, stage) =>
  apiFetch(`/api/v1/deals/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) })

export const updateDealContact = (dealId, contactId, data) =>
  apiFetch(`/api/v1/deals/${dealId}/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(data) })

export const addDealContact = (dealId, contactId) =>
  apiFetch(`/api/v1/deals/${dealId}/contacts`, { method: 'POST', body: JSON.stringify({ contact_id: contactId }) })
