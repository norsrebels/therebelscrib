// src/routes/polls.tsx
// Member polls — vote on active polls, see live results. Admins can create polls.

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-client'
import {
  getActivePolls,
  getPollWithResults,
  submitPollResponse,
  createPoll,
} from '@/server/member.functions'
import {
  Loader2, BarChart3, Plus, X, Check, Vote,
  ArrowLeft, Lock, Trophy, Clock,
} from 'lucide-react'

export const Route = createFileRoute('/polls')({
  component: PollsPage,
})

type Poll = {
  id: string
  question: string
  options: string[]
  closes_at: string | null
  created_at: string
}

function PollsPage() {
  const { user, isMember, isAdmin, loading: authLoading } = useAuth()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadPolls = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getActivePolls()
      setPolls((rows ?? []) as Poll[])
    } catch (e) {
      console.error('Failed to load polls', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadPolls() }, [loadPolls])

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Vote size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Polls & Surveys</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))]">Have your say on team matters</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={15} /> New Poll
          </button>
        )}
      </div>

      {/* Not logged in notice */}
      {!authLoading && !user && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Lock size={16} className="text-blue-400 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-[rgb(var(--muted-fg))]">You can see results, but </span>
            <Link to="/join" className="text-blue-400 hover:underline font-medium">join as a member</Link>
            <span className="text-[rgb(var(--muted-fg))]"> to vote.</span>
          </div>
        </div>
      )}

      {/* Create poll modal */}
      {showCreate && isAdmin && (
        <CreatePollModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadPolls() }}
        />
      )}

      {/* Polls list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[rgb(var(--muted-fg))]" />
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BarChart3 size={32} className="text-[rgb(var(--muted-fg))] opacity-30 mx-auto" />
          <p className="text-[rgb(var(--muted-fg))]">No active polls right now.</p>
          {isAdmin && (
            <p className="text-sm text-[rgb(var(--muted-fg))]">Create one to start gathering responses.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map(poll => (
            <PollCard key={poll.id} poll={poll} canVote={isMember} />
          ))}
        </div>
      )}
    </main>
  )
}

// ─── Poll Card ────────────────────────────────────────────────────────────────

function PollCard({ poll, canVote }: { poll: Poll; canVote: boolean }) {
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({})
  const [totalVotes, setTotalVotes] = useState(0)
  const [myAnswer, setMyAnswer] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const options: string[] = Array.isArray(poll.options)
    ? poll.options
    : typeof poll.options === 'string'
      ? JSON.parse(poll.options)
      : []

  const loadResults = useCallback(async () => {
    try {
      const res = await getPollWithResults({ data: { pollId: poll.id } })
      setVoteCounts(res.voteCounts ?? {})
      setTotalVotes(res.totalVotes ?? 0)
      setMyAnswer(res.myAnswer)
    } catch (e) {
      console.error('Failed to load poll results', e)
    }
    setLoading(false)
  }, [poll.id])

  useEffect(() => { loadResults() }, [loadResults])

  const handleVote = async (index: number) => {
    if (!canVote || myAnswer !== null || submitting) return
    setSubmitting(true)
    // Optimistic update
    setMyAnswer(index)
    setVoteCounts(prev => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }))
    setTotalVotes(prev => prev + 1)
    try {
      await submitPollResponse({ data: { pollId: poll.id, answerIndex: index } })
      await loadResults()
    } catch (e) {
      console.error('Vote failed', e)
      // Revert on failure
      setMyAnswer(null)
      await loadResults()
    }
    setSubmitting(false)
  }

  const hasVoted = myAnswer !== null
  const showResults = hasVoted || !canVote
  const closesAt = poll.closes_at ? new Date(poll.closes_at) : null

  return (
    <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-[rgb(var(--fg))] leading-snug">{poll.question}</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-[rgb(var(--muted-fg))]" />
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((option, index) => {
            const count = voteCounts[index] ?? 0
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            const isMine = myAnswer === index

            if (showResults) {
              return (
                <div key={index} className="relative">
                  <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border-soft))]">
                    {/* Result bar fill */}
                    <div
                      className={`absolute inset-0 transition-all duration-500 ${isMine ? 'bg-blue-500/20' : 'bg-[rgb(var(--surface-hover))]'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between px-4 py-2.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {isMine && <Check size={14} className="text-blue-400" />}
                        {option}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-[rgb(var(--muted-fg))]">{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <button
                key={index}
                onClick={() => handleVote(index)}
                disabled={submitting}
                className="w-full text-left px-4 py-2.5 rounded-xl border border-[rgb(var(--border-soft))] text-sm font-medium hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors disabled:opacity-50"
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[rgb(var(--muted-fg))] pt-1">
        <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
        {hasVoted && <span className="flex items-center gap-1 text-green-400"><Check size={11} /> You voted</span>}
        {closesAt && (
          <span className="flex items-center gap-1">
            <Clock size={11} /> Closes {closesAt.toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Create Poll Modal (admin only) ──────────────────────────────────────────

function CreatePollModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [closesAt, setClosesAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateOption = (index: number, value: string) => {
    setOptions(prev => prev.map((o, i) => i === index ? value : o))
  }

  const addOption = () => {
    if (options.length < 6) setOptions(prev => [...prev, ''])
  }

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setError(null)
    const cleanOptions = options.map(o => o.trim()).filter(Boolean)
    if (!question.trim()) { setError('Question is required.'); return }
    if (cleanOptions.length < 2) { setError('At least 2 options are required.'); return }

    setSubmitting(true)
    try {
      await createPoll({
        data: {
          question: question.trim(),
          options: cleanOptions,
          closesAt: closesAt || undefined,
        }
      })
      onCreated()
    } catch (e: any) {
      setError(e?.message || 'Failed to create poll.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Create Poll</h3>
          <button onClick={onClose} className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Question</label>
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Who was the MVP this week?"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Options</label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={e => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(index)}
                      className="text-[rgb(var(--muted-fg))] hover:text-red-400 p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                onClick={addOption}
                className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:underline"
              >
                <Plus size={12} /> Add option
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Closes (optional)</label>
            <input
              type="date"
              value={closesAt}
              onChange={e => setClosesAt(e.target.value)}
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Create Poll
          </button>
        </div>
      </div>
    </div>
  )
}
