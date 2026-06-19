import { Link, useLocation } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  Home,
  Users,
  Trophy,
  Image,
  Share2,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  LogIn,
  LogOut,
  ClipboardList,
  ListOrdered,
  BarChart2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-client'
import { logout } from '@netlify/identity'

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/player-dex', label: 'Player Dex', icon: Users },
  { path: '/tournaments', label: 'Tournaments', icon: Trophy },
  { path: '/tournament-format', label: 'Format', icon: ListOrdered },
  { path: '/gallery', label: 'Gallery', icon: Image },
  { path: '/social', label: 'Social Media', icon: Share2 },
  { path: '/vis-stats', label: 'VIS Stats', icon: ClipboardList },
  { path: '/leaderboard', label: 'Player Statistics', icon: BarChart2 },
]

const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 4)

export function Sidebar() {
  const location = useLocation()
  const { isAdmin, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('tr_theme') || 'dark'
    setTheme(saved as 'light' | 'dark')
  }, [])

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('tr_sidebar_collapsed')
    if (savedCollapsed === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('tr_sidebar_collapsed', String(next))
      window.dispatchEvent(new CustomEvent('tr_sidebar_collapsed_change', { detail: next }))
      return next
    })
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('tr_theme', next)
  }

  const handleSignOut = async () => {
    try {
      await logout()
    } catch {}
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const moreIsActive = !BOTTOM_NAV_ITEMS.some(item => isActive(item.path))

  const allItems = [
    ...NAV_ITEMS,
    ...(isAdmin
      ? [{ path: '/configuration', label: 'Config', icon: Settings }]
      : []),
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden md:flex fixed left-0 top-0 bottom-0 flex-col bg-[rgb(var(--surface))] border-r border-[rgb(var(--border-soft))] z-40 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}>
        <div className="p-5 mb-1">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Rebels"
              className="h-10 w-10 rounded-xl object-cover border border-[rgb(var(--border-soft))] shrink-0"
            />
            {!collapsed && (
              <div>
                <div className="font-bold text-sm text-[rgb(var(--fg))] leading-tight">
                  Rebels
                </div>
                <div className="text-[11px] text-[rgb(var(--muted-fg))] leading-tight">
                  Volleyball
                </div>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {allItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))]'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[rgb(var(--border-soft))] space-y-1">
          <button
            onClick={toggleTheme}
            title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors',
              collapsed && 'justify-center',
            )}
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {!collapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
          </button>
          {user ? (
            <button
              onClick={handleSignOut}
              title={collapsed ? 'Sign Out' : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors',
                collapsed && 'justify-center',
              )}
            >
              <LogOut size={18} className="shrink-0" /> {!collapsed && 'Sign Out'}
            </button>
          ) : (
            <Link
              to="/login"
              title={collapsed ? 'Admin Sign In' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors',
                collapsed && 'justify-center',
              )}
            >
              <LogIn size={18} className="shrink-0" /> {!collapsed && 'Admin Sign In'}
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors',
              collapsed && 'justify-center',
            )}
          >
            {collapsed ? <ChevronRight size={18} className="shrink-0" /> : <ChevronLeft size={18} className="shrink-0" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[rgb(var(--surface))] border-t border-[rgb(var(--border-soft))] z-50 flex items-center justify-around px-1 safe-area-bottom">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] transition-colors ${
                active ? 'text-blue-500' : 'text-[rgb(var(--muted-fg))]'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-semibold leading-tight">
                {item.label === 'Player Dex' ? 'Dex' : item.label.split(' ')[0]}
              </span>
            </Link>
          )
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[56px] transition-colors relative ${
            moreIsActive ? 'text-blue-500' : 'text-[rgb(var(--muted-fg))]'
          }`}
        >
          <Menu size={20} />
          {isAdmin && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-[rgb(var(--surface))]" />
          )}
          <span className="text-[10px] font-semibold leading-tight">More</span>
        </button>
      </nav>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[rgb(var(--surface))] flex flex-col shadow-2xl sidebar-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border-soft))]">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Rebels"
                  className="h-9 w-9 rounded-xl object-cover"
                />
                <div className="font-bold text-sm">Rebels Volleyball</div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {allItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))]'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-3 border-t border-[rgb(var(--border-soft))] space-y-1">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              {user ? (
                <>
                  <div className="px-3 py-2 text-xs text-[rgb(var(--muted-fg))] truncate">{user.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                >
                  <LogIn size={18} /> Admin Sign In
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
