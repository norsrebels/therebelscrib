// src/routes/me.tsx
// Member profile page — activity, predictions, ratings, poll votes

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth, getUserDisplayName } from '@/lib/auth-client'
import { getMyActivity } from '@/server/member.functions'
import {
  Loader2, Star, Trophy, Image, Users, LogOut,
  CheckCircle2, XCircle, ArrowLeft,
} from 'lucide-react'
import { logout } from '@netlify/identity'

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
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-red-400 hover:border-red-500/30 transition-colors flex-shrink-0"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

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
