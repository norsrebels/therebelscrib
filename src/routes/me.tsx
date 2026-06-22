// src/routes/me.tsx
// Member profile page — activity, predictions, ratings, poll votes

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth, getUserDisplayName } from '@/lib/auth-client'
import { getMyActivity } from '@/server/member.functions'
import {
  Loader2, Star, Trophy, Image, Users, LogOut,
  CheckCircle2, XCircle, ArrowLeft, KeyRound, Check,
} from 'lucide-react'
import { logout, updateUser } from '@netlify/identity'

export const Route = createFileRoute('/me')({
  component: MePage,
})

const FAN_LEVEL_COLORS: Record<string, string> = {
  'Rookie':   'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  'Fan':      'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Regular':  'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'Die-Hard': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={12}
          className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-[rgb(var(--border))]'}
        />
      ))}
    </span>
  )
}

function MePage() {
  const { user, isMember, isAdmin, loading } = useAuth()
  const [activity, setActivity] = useState<any>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [showPwChange, setShowPwChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwChanging, setPwChanging] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/join'
    }
  }, [loading, user])

  useEffect(() => {
    if (!user) return
    setActivityLoading(true)
    getMyActivity()
      .then(setActivity)
      .catch(console.error)
      .finally(() => setActivityLoading(false))
  }, [user])

  const handleSignOut = async () => {
    try { await logout() } catch { /* ignore */ }
    window.location.href = '/'
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMessage(null)
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    setPwChanging(true)
    try {
      await updateUser({ password: newPassword })
      setPwMessage({ type: 'success', text: 'Password updated successfully.' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => { setShowPwChange(false); setPwMessage(null) }, 2000)
    } catch (err: any) {
      setPwMessage({ type: 'error', text: err?.message || 'Failed to update password.' })
    } finally {
      setPwChanging(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-[rgb(var(--muted-fg))]" />
      </div>
    )
  }

  const displayName = getUserDisplayName(user)
  const fanLevel = activity?.fanLevel ?? 'Rookie'
  const levelColor = FAN_LEVEL_COLORS[fanLevel] ?? FAN_LEVEL_COLORS['Rookie']

  const correctPredictions = (activity?.predictions ?? []).filter((p: any) => p.was_correct === true).length
  const totalPredictions = activity?.predictions?.length ?? 0

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      {/* Profile header */}
      <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))]">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${levelColor}`}>
                {fanLevel}
              </span>
              {isAdmin && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowPwChange(v => !v); setPwMessage(null) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-blue-400 hover:border-blue-500/30 transition-colors"
          >
            <KeyRound size={14} /> Password
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-red-400 hover:border-red-500/30 transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Change password panel */}
      {showPwChange && (
        <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={15} className="text-blue-400" />
            <h3 className="font-semibold text-sm">Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              minLength={6}
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-2.5 text-sm transition-colors"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              minLength={6}
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-4 py-2.5 text-sm transition-colors"
            />
            {pwMessage && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${
                pwMessage.type === 'success'
                  ? 'border border-green-500/20 bg-green-500/10 text-green-400'
                  : 'border border-red-500/20 bg-red-500/10 text-red-400'
              }`}>
                {pwMessage.type === 'success' && <Check size={14} />}
                {pwMessage.text}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowPwChange(false); setPwMessage(null); setNewPassword(''); setConfirmPassword('') }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pwChanging}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {pwChanging && <Loader2 size={15} className="animate-spin" />}
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity stats */}
      {activityLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[rgb(var(--muted-fg))]" />
        </div>
      ) : activity ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Reactions', value: activity.reactions.length, icon: Image, color: 'text-pink-400' },
              { label: 'Predictions', value: totalPredictions, icon: Trophy, color: 'text-amber-400' },
              { label: 'Ratings', value: activity.ratings.length, icon: Star, color: 'text-yellow-400' },
              { label: 'Poll votes', value: activity.pollVotes.length, icon: Users, color: 'text-blue-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass border border-[rgb(var(--border-soft))] rounded-xl p-4 text-center">
                <Icon size={18} className={`${color} mx-auto mb-2`} />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-[rgb(var(--muted-fg))]">{label}</div>
              </div>
            ))}
          </div>

          {/* Predictions history */}
          {activity.predictions.length > 0 && (
            <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgb(var(--border-soft))] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-amber-400" />
                  <span className="font-semibold text-sm">Match Predictions</span>
                </div>
                {totalPredictions > 0 && (
                  <span className="text-xs text-[rgb(var(--muted-fg))]">
                    {correctPredictions}/{totalPredictions} correct
                  </span>
                )}
              </div>
              <div className="divide-y divide-[rgb(var(--border-soft))]">
                {activity.predictions.map((p: any) => (
                  <div key={p.match_id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.predicted_winner_name}</p>
                      <p className="text-xs text-[rgb(var(--muted-fg))]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {p.was_correct === true && <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />}
                    {p.was_correct === false && <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                    {p.was_correct === null && <span className="text-[10px] text-[rgb(var(--muted-fg))]">Pending</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player ratings history */}
          {activity.ratings.length > 0 && (
            <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgb(var(--border-soft))] flex items-center gap-2">
                <Star size={14} className="text-yellow-400" />
                <span className="font-semibold text-sm">Player Ratings</span>
              </div>
              <div className="divide-y divide-[rgb(var(--border-soft))]">
                {activity.ratings.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[rgb(var(--muted-fg))]">Player #{r.player_id}</p>
                      {r.note && <p className="text-sm truncate">{r.note}</p>}
                    </div>
                    <StarRating value={r.rating} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Poll votes */}
          {activity.pollVotes.length > 0 && (
            <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[rgb(var(--border-soft))] flex items-center gap-2">
                <Users size={14} className="text-blue-400" />
                <span className="font-semibold text-sm">Poll Votes</span>
              </div>
              <div className="divide-y divide-[rgb(var(--border-soft))]">
                {activity.pollVotes.map((v: any) => (
                  <div key={v.poll_id} className="px-5 py-3">
                    <p className="text-sm font-medium">{v.question}</p>
                    <p className="text-xs text-[rgb(var(--muted-fg))] mt-1">
                      {new Date(v.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activity.totalActivity === 0 && (
            <div className="text-center py-12 space-y-3">
              <p className="text-[rgb(var(--muted-fg))]">No activity yet.</p>
              <p className="text-sm text-[rgb(var(--muted-fg))]">
                React to photos, predict matches, and vote in polls to build your profile.
              </p>
              <Link to="/" className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors">
                Explore the app
              </Link>
            </div>
          )}
        </>
      ) : null}
    </main>
  )
}
