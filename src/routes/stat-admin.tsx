// src/routes/stat-admin.tsx
// Stat admin — now uses Netlify Identity for auth
// User management removed (handled by Netlify Identity dashboard)
// Audit log viewer retained

import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getAuditLog } from '@/server/stats.functions'
import { useAuth } from '@/lib/auth-client'
import { useNavigate } from '@tanstack/react-router'
import {
  Shield, ClipboardList, ChevronDown, ChevronUp, ExternalLink,
  Loader2, RefreshCw,
} from 'lucide-react'

export const Route = createFileRoute('/stat-admin')({
  component: StatAdminPage,
})

function StatAdminPage() {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [auditRows, setAuditRows] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate({ to: '/login', search: { redirect: '/stat-admin' } })
    }
  }, [loading, user, isAdmin, navigate])

  const loadAuditLog = async () => {
    setAuditLoading(true)
    try {
      const rows = await getAuditLog({ data: { pageSize: 100 } })
      setAuditRows(rows.rows ?? [])
    } catch (e) {
      console.error('Failed to load audit log', e)
    }
    setAuditLoading(false)
  }

  useEffect(() => {
    if (isAdmin) loadAuditLog()
  }, [isAdmin])

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-[rgb(var(--muted-fg))]" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Stat Admin</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))]">Signed in as {user.email}</p>
          </div>
        </div>
        <a
          href="https://app.netlify.com/projects/therebelscrib/identity"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[rgb(var(--border))] rounded-xl text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
        >
          <ExternalLink size={14} /> Manage Users in Netlify
        </a>
      </div>

      {/* User management note */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
        <Shield size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[rgb(var(--muted-fg))]">
          <p className="font-semibold text-[rgb(var(--fg))] mb-1">User management moved to Netlify Identity</p>
          <p>To invite a statistician: go to <strong>Netlify → Identity → Invite users</strong>, enter their email, then set their role to <code className="px-1 py-0.5 rounded bg-[rgb(var(--surface-hover))] text-xs">statistician</code> in User details → App metadata.</p>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-[rgb(var(--muted-fg))]" />
            <span className="font-semibold text-sm">Audit Log</span>
            <span className="text-xs text-[rgb(var(--muted-fg))]">Last 100 entries</span>
          </div>
          <button
            onClick={loadAuditLog}
            disabled={auditLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={auditLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {auditLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[rgb(var(--muted-fg))]" />
          </div>
        ) : auditRows.length === 0 ? (
          <div className="text-center py-12 text-sm text-[rgb(var(--muted-fg))]">No audit entries yet.</div>
        ) : (
          <div className="divide-y divide-[rgb(var(--border-soft))]">
            {auditRows.map((row: any) => (
              <div key={row.id} className="px-5 py-3">
                <div
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      row.action?.includes('UNDO') ? 'bg-amber-500/15 text-amber-400'
                      : row.action?.includes('FINALIZE') ? 'bg-green-500/15 text-green-400'
                      : row.action?.includes('UNLOCK') ? 'bg-red-500/15 text-red-400'
                      : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {row.action}
                    </span>
                    <span className="text-sm font-medium truncate">{row.username}</span>
                    {row.match_id && (
                      <span className="text-xs text-[rgb(var(--muted-fg))] truncate font-mono">
                        {row.match_id.slice(0, 12)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-[rgb(var(--muted-fg))]">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                    {expandedId === row.id
                      ? <ChevronUp size={14} className="text-[rgb(var(--muted-fg))]" />
                      : <ChevronDown size={14} className="text-[rgb(var(--muted-fg))]" />}
                  </div>
                </div>
                {expandedId === row.id && (
                  <div className="mt-2 pl-2 text-xs text-[rgb(var(--muted-fg))] space-y-1 border-l-2 border-[rgb(var(--border))]">
                    {row.field_name && <p><span className="font-medium">Field:</span> {row.field_name}</p>}
                    {row.old_value && <p><span className="font-medium">From:</span> {row.old_value}</p>}
                    {row.new_value && <p><span className="font-medium">To:</span> {row.new_value}</p>}
                    {row.ip_address && <p><span className="font-medium">IP:</span> {row.ip_address}</p>}
                    {row.user_role && <p><span className="font-medium">Role:</span> {row.user_role}</p>}
                    {row.flagged && <p className="text-amber-400 font-semibold">⚑ Flagged{row.flag_note ? `: ${row.flag_note}` : ''}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
