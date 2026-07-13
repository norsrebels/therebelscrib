import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { BarChart3, Database, ShieldCheck, AlertTriangle, ChevronRight, X } from 'lucide-react'

export const Route = createFileRoute('/admin-tools')({
  component: AdminToolsPage,
})

// Safe, view-only / diagnostic tools — one tap to open.
const SAFE_TOOLS = [
  {
    path: '/admin-dashboard',
    label: 'Executive Dashboard',
    desc: 'Participation, finance, and performance at a glance.',
    icon: BarChart3,
    accent: '#4f46e5',
  },
  {
    path: '/admin-db-check',
    label: 'Schema Check',
    desc: 'Confirm which database tables and columns exist.',
    icon: ShieldCheck,
    accent: '#10b981',
  },
]

function AdminToolsPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [confirmConsole, setConfirmConsole] = useState(false)

  if (loading) return <div className="p-8 text-center text-[rgb(var(--muted-fg))]">Loading…</div>

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-[rgb(var(--muted-fg))]">Sign in as an admin to access these tools.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Admin Tools</h1>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">Operational tools for club administrators.</p>

      {/* Safe tools */}
      <div className="space-y-3">
        {SAFE_TOOLS.map((t) => {
          const Icon = t.icon
          return (
            <Link key={t.path} to={t.path}
              className="flex items-center gap-4 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] p-4 hover:shadow-md hover:border-[rgb(var(--muted-fg))] transition-all">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.accent}18` }}>
                <Icon size={20} style={{ color: t.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{t.label}</p>
                <p className="text-xs text-[rgb(var(--muted-fg))]">{t.desc}</p>
              </div>
              <ChevronRight size={18} className="text-[rgb(var(--muted-fg))] shrink-0" />
            </Link>
          )
        })}
      </div>

      {/* Danger zone — the DB console needs extra confirmation */}
      <div className="mt-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-2 flex items-center gap-1">
          <AlertTriangle size={13} /> Sensitive
        </p>
        <button onClick={() => setConfirmConsole(true)}
          className="w-full flex items-center gap-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 hover:bg-red-500/10 transition-colors text-left">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-red-500/15">
            <Database size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Database Console</p>
            <p className="text-xs text-[rgb(var(--muted-fg))]">Runs SQL directly against the live database. Use with care.</p>
          </div>
          <ChevronRight size={18} className="text-red-500 shrink-0" />
        </button>
      </div>

      {/* Console confirmation modal */}
      {confirmConsole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmConsole(false)}>
          <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border-soft))] w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg flex items-center gap-2 text-red-500"><AlertTriangle size={18} /> Open Database Console?</h3>
              <button onClick={() => setConfirmConsole(false)}><X size={18} /></button>
            </div>
            <p className="text-sm text-[rgb(var(--muted-fg))] mb-2">
              The console runs SQL directly against the live database (<span className="font-mono text-xs">netlifydb</span>). A wrong statement can change or delete real data, and there is no undo.
            </p>
            <p className="text-sm text-[rgb(var(--muted-fg))] mb-4">Only continue if you know exactly what you intend to run.</p>
            <div className="flex gap-2">
              <button onClick={() => navigate({ to: '/admin-db-console' })}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-bold">
                I understand — open console
              </button>
              <button onClick={() => setConfirmConsole(false)}
                className="px-4 rounded-xl border border-[rgb(var(--border-soft))] text-sm font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
