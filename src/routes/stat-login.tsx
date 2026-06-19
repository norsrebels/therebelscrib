import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { loginStatUser, changePassword } from '@/server/stats.functions'
import { Lock, Eye, EyeOff, AlertTriangle, Shield } from 'lucide-react'

export const Route = createFileRoute('/stat-login')({
  component: StatLoginPage,
})

function StatLoginPage() {
  const [view, setView] = useState<'login' | 'change-password'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockoutMsg, setLockoutMsg] = useState('')

  // Change password state
  const [currentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changePwError, setChangePwError] = useState('')
  const [changePwSuccess, setChangePwSuccess] = useState(false)

  // Token management
  const [, setTokens] = useState<{ access: string; refresh: string } | null>(null)
  const [, setUser] = useState<{ id: string; username: string; role: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('stat_tokens')
    if (stored) {
      try {
        const t = JSON.parse(stored)
        setTokens(t)
        document.cookie = `stat_access=${t.access}; path=/; max-age=900; SameSite=Strict`
      } catch { /* ignore */ }
    }
  }, [])

  const handleLogin = async () => {
    setError('')
    setLockoutMsg('')
    setLoading(true)
    try {
      const result = await loginStatUser({ data: { username, password } })
      const { user: u, accessToken, refreshToken } = result

      document.cookie = `stat_access=${accessToken}; path=/; max-age=900; SameSite=Strict`
      document.cookie = `stat_refresh=${refreshToken}; path=/; max-age=604800; SameSite=Strict`
      localStorage.setItem('stat_tokens', JSON.stringify({ access: accessToken, refresh: refreshToken }))
      localStorage.setItem('stat_user', JSON.stringify(u))

      setUser(u)
      setTokens({ access: accessToken, refresh: refreshToken })

      if (u.mustChangePassword) {
        setView('change-password')
      } else if (u.role === 'admin') {
        window.location.href = '/stat-admin'
      } else {
        window.location.href = '/vis-stats'
      }
    } catch (e: any) {
      const msg = e.message || 'Login failed'
      if (msg.includes('locked')) {
        setLockoutMsg(msg)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    setChangePwError('')
    if (newPw !== confirmPw) {
      setChangePwError('Passwords do not match')
      return
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(newPw)) {
      setChangePwError('Password must be 8+ characters with uppercase, digit, and special character (!@#$%^&*)')
      return
    }
    setLoading(true)
    try {
      await changePassword({ data: { current: currentPw || password, newPassword: newPw } })
      setChangePwSuccess(true)
      setTimeout(() => {
        const u = JSON.parse(localStorage.getItem('stat_user') ?? '{}')
        if (u.role === 'admin') {
          window.location.href = '/stat-admin'
        } else {
          window.location.href = '/vis-stats'
        }
      }, 1500)
    } catch (e: any) {
      setChangePwError(e.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  if (view === 'change-password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold">Change Password</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))] mt-1">You must set a new password before continuing</p>
          </div>

          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New password"
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                placeholder="Confirm password"
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-3 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPw(s => !s)} className="text-xs text-[rgb(var(--muted-fg))]">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <span className="text-[10px] text-[rgb(var(--muted-fg))]">
                Min 8 chars, 1 uppercase, 1 digit, 1 special (!@#$%^&*)
              </span>
            </div>

            {changePwError && <p className="text-red-400 text-xs">{changePwError}</p>}
            {changePwSuccess && <p className="text-green-400 text-xs">Password changed! Redirecting...</p>}

            <button
              onClick={handleChangePassword}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
            >
              {loading ? 'Saving...' : 'Set New Password'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">Statistician Login</h1>
          <p className="text-sm text-[rgb(var(--muted-fg))] mt-1">VIS Stats Access</p>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-1 block">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Username"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-3 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Password"
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-3 pr-10 text-sm"
              />
              <button onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          {lockoutMsg && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-400 text-xs">{lockoutMsg}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !username || !password}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  )
}
