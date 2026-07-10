const BASE = import.meta.env.VITE_API_URL || ''

export async function apiFetch(path, options = {}) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return
  }

  if (res.status === 204) return null

  const data = await res.json()

  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Ошибка сервера')
    err.status = res.status
    throw err
  }

  return data
}
