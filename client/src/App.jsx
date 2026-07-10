import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { getMe } from './api/users'
import Login from './pages/Login'
import AppShell from './components/layout/AppShell'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    window.location.href = '/login'
    return null
  }

  return children
}

export default function App() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    getMe()
      .then((data) => setUser(data))
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }, [setUser, setLoading])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
