// src/routes/join.tsx
// Member self-signup page — public registration with auto "member" role

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { signup, handleAuthCallback, AuthError } from '@netlify/identity'
import { useAuth } from '@/lib/auth-client'
import { Loader2, Users, CheckCircle2, ArrowLeft, Star, Trophy, Image } from 'lucide-react'

export const Route = createFileRoute('/join')({
  component: JoinPage,
})

const MEMBER_PERKS = [
  { icon: Image, label: 'React to gallery photos' },
  { icon: Trophy, label: 'Predict match outcomes' },
  { icon: Star, label: 'Rate players and matches' },
  { icon: Users, label: 'Vote in team polls' },
]

function JoinPage() {
  const { user, isMember, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    handleAuthCallback().catch(() => {})
  }, [])

  // Already a member — redirect to profile
  useEffect(() => {
    if (!loading && user && isMember) {
      window.location.href = '/me'
    }
  }, [loading, user, isMember])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signup(email.trim(), password, {
        full_name: displayName.trim() || email.split('@')[0],
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.status === 422) setError('An account with this email already exists.')
        else setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Check your email!</h2>
          <p className="text-[rgb(var(--muted-fg))] leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and you're in.
          </p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </main>
    )
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
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Join the Rebels</h2>
          <p className="text-[15px] text-[rgb(var(--muted-fg))] leading-relaxed">
            Create a free member account to engage with the team.
          </p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-2 gap-3">
          {MEMBER_PERKS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-sm">
              <Icon size={14} className="text-blue-400 flex-shrink-0" />
              <span className="text-[rgb(var(--muted-fg))]">{label}</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            required
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name (shown publicly)"
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-[15px] transition-colors shadow-sm"
          />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-[15px] transition-colors shadow-sm"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            minLength={8}
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-3.5 text-[15px] transition-colors shadow-sm"
          />

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-[15px] text-red-400 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-3.5 text-[16px] font-medium transition-colors disabled:opacity-60 shadow-sm"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {submitting ? 'Creating account...' : 'Create Member Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[rgb(var(--muted-fg))]">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
