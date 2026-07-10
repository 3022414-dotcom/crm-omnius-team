import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import AccountsPage from '../../pages/accounts/AccountsPage'
import ContactsPage from '../../pages/contacts/ContactsPage'
import DealsPage from '../../pages/deals/DealsPage'
import KanbanPage from '../../pages/kanban/KanbanPage'
import ActivitiesPage from '../../pages/activities/ActivitiesPage'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-56 flex-shrink-0">
        <div className="w-full">
          <Sidebar />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-56 z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 flex-shrink-0">
          <button
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<Navigate to="/accounts" replace />} />
            <Route path="accounts/*" element={<AccountsPage />} />
            <Route path="contacts/*" element={<ContactsPage />} />
            <Route path="deals/*" element={<DealsPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
