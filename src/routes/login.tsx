import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import {
  login,
  logout,
  handleAuthCallback,
  AuthError,
  MissingIdentityError,
  updateUser,
} from '@netlify/identity'
import { useAuth } from '@/lib/auth-client'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    setup: search.setup === 'true',
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect, setup } = Route.useSearch()
  const { user, isAdmin, isMember, isStatistician, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    handleAuthCallback()
      .then((result) => {
        if (!result) return
        if (result.type === 'confirmation') setInfo('Email confirmed. You are now logged in.')
        else if (result.type === 'recovery') setInfo('Recovery confirmed. Please update your password.')
      })
      .catch((err) => {
        if (err instanceof AuthError) setError(err.message)
      })
  }, [])

  useEffect(() => {
    if (loading) return
    if (user) {
      window.location.href = redirect && redirect.startsWith('/') ? redirect : '/'
    }
  }, [loading, user, isAdmin, redirect])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      window.location.href = redirect && redirect.startsWith('/') ? redirect : '/'
    } catch (err) {
      if (err instanceof MissingIdentityError) {
        setError('Identity is not enabled on this site.')
      } else if (err instanceof AuthError) {
        if (err.status === 401) setError('Invalid email or password.')
        else if (err.status === 422) setError('Invalid email or password format.')
        else setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    setChangingPassword(true)
    try {
      await updateUser({ password: newPassword })
      setInfo('Password successfully updated.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = async () => {
    try { await logout(); setInfo('Signed out.') }
    catch (err) { if (err instanceof AuthError) setError(err.message) }
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-16">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] mb-8 transition-colors"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>

      <div className="glass border border-[rgb(var(--border-soft))] rounded-3xl p-8 sm:p-10 shadow-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign In</h2>
          <p className="text-[15px] text-[rgb(var(--muted-fg))] leading-relaxed">
            Sign in to The Rebels Crib.
          </p>
        </div>

        {user ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-4 text-[15px] text-green-600 dark:text-green-400 text-center space-y-2">
              <p>Signed in as <span className="font-semibold">{user.email}</span></p>
              <div className="flex items-center justify-center gap-2">
                {isAdmin && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Admin</span>}
                {isStatistician && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Statistician</span>}
                {isMember && !isAdmin && !isStatistician && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Member</span>}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-[15px] text-red-600 dark:text-red-400 text-center">{error}</div>
            )}
            {info && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-[15px] text-blue-600 dark:text-blue-400 text-center">{info}</div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 pt-6 border-t border-[rgb(var(--border-soft))]">
              <h3 className="text-[15px] font-medium text-center mb-4">Change Password</h3>
              <div className="space-y-3">
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-[15px] transition-colors shadow-sm" placeholder="New Password" />
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-[15px] transition-colors shadow-sm" placeholder="Confirm New Password" />
              </div>
              <button type="submit" disabled={changingPassword}
                className="w-full flex items-center justify-center gap-2 bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border-soft))] rounded-full px-5 py-3 text-[15px] font-medium transition-colors disabled:opacity-50">
                {changingPassword && <Loader2 size={18} className="animate-spin" />}
                Update Password
              </button>
            </form>

            <button onClick={handleLogout}
              className="w-full px-5 py-3 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full text-[15px] font-medium transition-colors">
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-[15px] transition-colors shadow-sm" placeholder="Email address" />
              <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-[15px] transition-colors shadow-sm" placeholder="Password" />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-[15px] text-red-600 dark:text-red-400 text-center">{error}</div>
            )}
            {info && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-[15px] text-blue-600 dark:text-blue-400 text-center">{info}</div>
            )}

            <button type="submit" disabled={submitting || loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-3.5 text-[16px] font-medium transition-colors disabled:opacity-60 shadow-sm">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {!user && (
          <p className="text-center text-sm text-[rgb(var(--muted-fg))]">
            Not a member yet?{' '}
            <a href="/join" className="text-blue-400 hover:underline font-medium">Join as Member</a>
          </p>
        )}

        {!user && setup && (
          <div className="pt-6 border-t border-[rgb(var(--border-soft))] text-[13px] text-[rgb(var(--muted-fg))] leading-relaxed">
            <p className="font-medium text-[rgb(var(--fg))] mb-2">First time setup:</p>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>Go to Netlify Identity dashboard.</li>
              <li>Invite an admin user by email.</li>
              <li>Add the <code className="px-1.5 py-0.5 rounded bg-[rgb(var(--surface-hover))] font-mono text-[12px] text-[rgb(var(--fg))]">admin</code> role.</li>
              <li>Sign in here.</li>
            </ol>
          </div>
        )}
      </div>
    </main>
  )
}
