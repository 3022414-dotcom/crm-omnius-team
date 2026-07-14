import { NavLink } from 'react-router-dom'
import { Building2, Users, Briefcase, Kanban, Activity, LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/accounts', label: 'Accounts', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/deals', label: 'Deals', icon: Briefcase },
  { to: '/kanban', label: 'Sales funnel', icon: Kanban },
  { to: '/activities', label: 'Activities', icon: Activity },
]

export default function Sidebar({ onClose }) {
  const { user } = useAuthStore()

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="flex h-14 items-center px-4 border-b border-border gap-2.5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          <circle cx="14" cy="14" r="14" fill="black" />
          <circle cx="14" cy="14" r="10" stroke="white" strokeWidth="3" fill="none" />
          <circle cx="14" cy="14" r="4" fill="#E8392A" />
        </svg>
        <span className="font-bold text-lg tracking-tight">omnius.team</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 space-y-2">
        {user && (
          <p className="text-xs text-muted-foreground truncate">{user.name}</p>
        )}
        <a
          href="/auth/logout"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={14} />
          Log out
        </a>
      </div>
    </div>
  )
}
