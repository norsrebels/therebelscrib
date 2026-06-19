import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  listStatUsers,
  createStatUser,
  resetStatUserPassword,
  toggleStatUserActive,
  getAuditLog,
  logoutStatUser,
} from '@/server/stats.functions'
import {
  Users, Shield, Plus, Key, Power, Download,
  ChevronDown, ChevronUp, LogOut, ClipboardList,
} from 'lucide-react'

export const Route = createFileRoute('/stat-admin')({
  component: StatAdminPage,
})

type AdminTab = 'users' | 'audit'

function StatAdminPage() {
  const [tab, setTab] = useState<AdminTab>('users')
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('stat_user')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        if (u.role !== 'admin') {
          window.location.href = '/stat-login'
          return
        }
        setUser(u)
      } catch {
        window.location.href = '/stat-login'
      }
    } else {
      window.location.href = '/stat-login'
    }
  }, [])

  const handleLogout = async () => {
    try { await logoutStatUser() } catch { /* ignore */ }
    document.cookie = 'stat_access=; path=/; max-age=0'
    document.cookie = 'stat_refresh=; path=/; max-age=0'
    localStorage.removeItem('stat_tokens')
    localStorage.removeItem('stat_user')
    window.location.href = '/stat-login'
  }

  if (!user) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Stat Admin</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))]">Logged in as {user.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-red-400 border border-[rgb(var(--border))] rounded-xl hover:border-red-500/30 transition-colors"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl p-1.5">
        {([
          { key: 'users' as AdminTab, label: 'Users', icon: Users },
          { key: 'audit' as AdminTab, label: 'Audit Log', icon: ClipboardList },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersPanel adminId={user.id} />}
      {tab === 'audit' && <AuditPanel />}
    </div>
  )
}

// ─── Users Panel ─────────────────────────────────────────────────

function UsersPanel({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('statistician')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [resetModal, setResetModal] = useState<{ id: string; username: string } | null>(null)
  const [resetPw, setResetPw] = useState('')

  const loadUsers = async () => {
    try {
      const data = await listStatUsers()
      setUsers(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async () => {
    setError('')
    if (!newUsername.trim() || !newPassword.trim()) {
      setError('Username and password are required')
      return
    }
    setCreating(true)
    try {
      await createStatUser({ data: { username: newUsername.trim(), tempPassword: newPassword, role: newRole } })
      setShowCreate(false)
      setNewUsername('')
      setNewPassword('')
      loadUsers()
    } catch (e: any) {
      setError(e.message || 'Failed to create user')
    }
    setCreating(false)
  }

  const handleToggle = async (userId: string, isActive: boolean) => {
    try {
      await toggleStatUserActive({ data: { userId, isActive } })
      loadUsers()
    } catch { /* ignore */ }
  }

  const handleReset = async () => {
    if (!resetModal || !resetPw) return
    try {
      await resetStatUserPassword({ data: { userId: resetModal.id, tempPassword: resetPw } })
      setResetModal(null)
      setResetPw('')
      loadUsers()
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wider">Stat Users</h2>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
        >
          <Plus size={14} /> Create User
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Username</label>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Temp Password</label>
              <input
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Role</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm"
              >
                <option value="statistician">Statistician</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-[rgb(var(--border))] rounded-xl text-xs text-[rgb(var(--muted-fg))]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-fg))]">Username</th>
                <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-fg))]">Role</th>
                <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-fg))]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[rgb(var(--muted-fg))]">Last Login</th>
                <th className="text-right px-4 py-3 font-medium text-[rgb(var(--muted-fg))]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-[rgb(var(--muted-fg))]">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-[rgb(var(--muted-fg))]">No users yet</td></tr>
              ) : users.map((u, i) => (
                <tr key={u.id} className={`border-b border-[rgb(var(--border-soft))] ${i % 2 !== 0 ? 'bg-[rgb(var(--surface-hover))]' : ''}`}>
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'admin' ? 'bg-purple-500/15 text-purple-400'
                      : u.role === 'statistician' ? 'bg-blue-500/15 text-blue-400'
                      : 'bg-gray-500/15 text-gray-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.lockoutUntil && new Date(u.lockoutUntil) > new Date() ? (
                      <span className="text-red-400 text-[10px] font-bold">LOCKED</span>
                    ) : u.isActive ? (
                      <span className="text-green-400 text-[10px] font-bold">Active</span>
                    ) : (
                      <span className="text-red-400 text-[10px] font-bold">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[rgb(var(--muted-fg))]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== adminId && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggle(u.id, !u.isActive)}
                          className={`p-1.5 rounded-lg text-xs ${u.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                          title={u.isActive ? 'Disable' : 'Enable'}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => setResetModal({ id: u.id, username: u.username })}
                          className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10"
                          title="Reset password"
                        >
                          <Key size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset password modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetModal(null)} />
          <div className="relative bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-sm font-bold mb-3">Reset Password for {resetModal.username}</h3>
            <input
              type="text"
              value={resetPw}
              onChange={e => setResetPw(e.target.value)}
              placeholder="New temporary password"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-3 text-sm mb-3"
            />
            <p className="text-[10px] text-[rgb(var(--muted-fg))] mb-4">User will be required to change this on next login.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetModal(null)}
                className="px-4 py-2 border border-[rgb(var(--border))] rounded-xl text-xs text-[rgb(var(--muted-fg))]">
                Cancel
              </button>
              <button onClick={handleReset} disabled={!resetPw}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold">
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Audit Panel ─────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  STAT_DELETE: 'bg-red-500/15 text-red-400',
  STAT_UNDO: 'bg-red-500/15 text-red-400',
  STAT_UPDATE: 'bg-amber-500/15 text-amber-400',
  STAT_CREATE: 'bg-green-500/15 text-green-400',
  LOGIN: 'bg-gray-500/15 text-gray-400',
  LOGOUT: 'bg-gray-500/15 text-gray-400',
  USER_CREATE: 'bg-blue-500/15 text-blue-400',
  PASSWORD_RESET: 'bg-blue-500/15 text-blue-400',
  USER_UPDATE: 'bg-blue-500/15 text-blue-400',
  ACCOUNT_LOCK: 'bg-red-500/15 text-red-400',
  ROSTER_UPDATE: 'bg-purple-500/15 text-purple-400',
}

function AuditPanel() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Filters
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const loadLogs = async () => {
    setLoading(true)
    try {
      const result = await getAuditLog({
        data: {
          action: filterAction || undefined,
          from: filterFrom || undefined,
          to: filterTo || undefined,
          page,
          pageSize: 50,
        }
      })
      setLogs(result.rows)
      setTotal(result.total)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadLogs() }, [page, filterAction, filterFrom, filterTo])

  const exportCSV = () => {
    const header = 'Timestamp,User,Role,Action,Entity,Match,Field,Old Value,New Value\n'
    const rows = logs.map(l =>
      [
        new Date(l.createdAt).toISOString(),
        l.username,
        l.userRole,
        l.action,
        l.entityType ?? '',
        l.matchId ?? '',
        l.fieldName ?? '',
        l.oldValue ?? '',
        l.newValue ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Action</label>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className="bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-xs"
          >
            <option value="">All actions</option>
            {['STAT_CREATE', 'STAT_UPDATE', 'STAT_DELETE', 'STAT_UNDO', 'LOGIN', 'LOGOUT', 'USER_CREATE', 'USER_UPDATE', 'PASSWORD_RESET', 'ACCOUNT_LOCK', 'ROSTER_UPDATE'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">From</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
            className="bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">To</label>
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1) }}
            className="bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-xs"
          />
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-medium"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">Timestamp</th>
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">User</th>
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">Role</th>
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">Action</th>
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">Entity</th>
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">Match</th>
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))]">Change</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-[rgb(var(--muted-fg))]">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[rgb(var(--muted-fg))]">No audit log entries</td></tr>
              ) : logs.map((l, i) => (
                <>
                  <tr
                    key={l.id}
                    onClick={() => l.fieldName && setExpandedRow(expandedRow === l.id ? null : l.id)}
                    className={`border-b border-[rgb(var(--border-soft))] ${i % 2 !== 0 ? 'bg-[rgb(var(--surface-hover))]' : ''} ${l.fieldName ? 'cursor-pointer hover:bg-[rgb(var(--bg))]' : ''}`}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-[rgb(var(--muted-fg))]">
                      {new Date(l.createdAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{l.username}</td>
                    <td className="px-3 py-2.5 text-[rgb(var(--muted-fg))]">{l.userRole}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ACTION_COLORS[l.action] ?? 'bg-gray-500/15 text-gray-400'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[rgb(var(--muted-fg))]">{l.entityType ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[rgb(var(--muted-fg))]">{l.matchId ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {l.fieldName ? (
                        <span className="flex items-center gap-1 text-[rgb(var(--muted-fg))]">
                          {l.fieldName}
                          {expandedRow === l.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                  {expandedRow === l.id && l.fieldName && (
                    <tr key={`${l.id}-detail`} className="bg-[rgb(var(--bg))]">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="font-medium">{l.fieldName}:</span>
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded font-mono">{l.oldValue ?? 'null'}</span>
                          <span className="text-[rgb(var(--muted-fg))]">&rarr;</span>
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded font-mono">{l.newValue ?? 'null'}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[rgb(var(--muted-fg))]">{total} total entries</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-[rgb(var(--border))] rounded-lg text-xs disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1.5 text-xs text-[rgb(var(--muted-fg))]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-[rgb(var(--border))] rounded-lg text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
