import { apiFetch } from './client'

export const getMe = () => apiFetch('/api/v1/users/me')
export const getUsers = () => apiFetch('/api/v1/users')
