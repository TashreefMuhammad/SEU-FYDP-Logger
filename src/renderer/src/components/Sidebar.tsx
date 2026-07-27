import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  ArrowLeftRight,
  Settings,
  GraduationCap,
  RefreshCw
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/groups', label: 'Groups & Students', icon: Users },
  { to: '/log', label: 'Log Session', icon: ClipboardList },
  { to: '/analysis', label: 'Analysis Portal', icon: BarChart3 },
  { to: '/reports', label: 'AI Reports', icon: FileText },
  { to: '/transfer', label: 'Import / Export', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const faculty = useStore((s) => s.faculty)
  const refresh = useStore((s) => s.refresh)
  const refreshedAt = useStore((s) => s.refreshedAt)
  const [spinning, setSpinning] = useState(false)

  const doRefresh = () => {
    setSpinning(true)
    refresh()
    toast.info('Reloaded from the database.')
    setTimeout(() => setSpinning(false), 600)
  }

  return (
    <aside className="w-56 shrink-0 bg-blue-900 text-white flex flex-col h-full">
      {/* Logo / App name */}
      <div className="px-4 py-5 border-b border-blue-800">
        <div className="flex items-center gap-2">
          <GraduationCap size={22} className="text-blue-300" />
          <div>
            <p className="text-sm font-bold leading-tight">FYDP Logger</p>
            <p className="text-xs text-blue-300 leading-tight">Southeast University</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-700 text-white font-medium'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Global refresh — re-queries every page from the database on demand */}
      <div className="px-2 pb-2">
        <button
          onClick={doRefresh}
          title="Reload all data from the database"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-blue-200 transition-colors hover:bg-blue-800 hover:text-white"
        >
          <RefreshCw size={16} className={spinning ? 'animate-spin' : undefined} />
          Refresh data
        </button>
        {refreshedAt && (
          <p className="px-3 pt-1 text-[10px] text-blue-400">
            Last refreshed{' '}
            {new Date(refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Faculty info at bottom */}
      {faculty && (
        <div className="px-4 py-4 border-t border-blue-800">
          <p className="text-xs font-semibold text-white truncate">{faculty.name}</p>
          <p className="text-xs text-blue-300 truncate">{faculty.designation}</p>
          <p className="text-xs text-blue-400 truncate">{faculty.department}</p>
        </div>
      )}
    </aside>
  )
}
