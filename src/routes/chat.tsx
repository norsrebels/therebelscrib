// src/routes/chat.tsx
// Polling chat. Two tabs: Global and My Communities. Reads/writes via the
// /api/messages route. Anyone may read global; posting requires sign-in;
// community threads require membership (enforced server-side). Polls every 5s
// using ?since= so each tick only pulls new messages.

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth, getUserDisplayName } from '@/lib/auth-client'
import { getCommunities } from '@/server/community.functions'
import {
  Loader2, Send, MessageSquare, Globe, Users, ArrowLeft, Lock, Trash2,
} from 'lucide-react'

const POLL_MS = 5000

export const Route = createFileRoute('/chat')({
  validateSearch: (search: Record<string, unknown>) => ({
    community: typeof search.community === 'string' ? search.community : undefined,
  }),
  component: ChatPage,
})

type ChatMessage = {
  id: string
  senderName: string
  body: string
  createdAt: string
  mine: boolean
}

type JoinedCommunity = { id: number; slug: string; name: string }

function ChatPage() {
  const { community: communityParam } = Route.useSearch()
  const { user, isAdmin, loading: authLoading } = useAuth()
  const displayName = getUserDisplayName(user)

  const [tab, setTab] = useState<'global' | 'community'>(communityParam ? 'community' : 'global')
  const [myCommunities, setMyCommunities] = useState<JoinedCommunity[]>([])
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(null)

  // Load the user's joined communities for the community tab.
  useEffect(() => {
    if (!user) { setMyCommunities([]); return }
    getCommunities()
      .then(rows => {
        const mine = (rows ?? []).filter((c: any) => c.isMember)
          .map((c: any) => ({ id: c.id, slug: c.slug, name: c.name }))
        setMyCommunities(mine)
        // Resolve ?community=slug → id, else default to first joined community.
        if (communityParam) {
          const match = mine.find(c => c.slug === communityParam)
          if (match) { setTab('community'); setActiveCommunityId(match.id); return }
        }
        if (mine.length > 0) setActiveCommunityId(prev => prev ?? mine[0].id)
      })
      .catch(e => console.error('Failed to load communities', e))
  }, [user, communityParam])

  const scope: 'global' | 'community' = tab
  const communityId = tab === 'community' ? activeCommunityId : null

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]">
        <ArrowLeft size={14} /> Back to home
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <MessageSquare size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Chat</h1>
          <p className="text-sm text-[rgb(var(--muted-fg))]">Talk with the Rebels community</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-[rgb(var(--surface-hover))] rounded-full p-1 border border-[rgb(var(--border-soft))] w-fit">
        <button
          onClick={() => setTab('global')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'global' ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'}`}
        >
          <Globe size={14} /> Global
        </button>
        <button
          onClick={() => setTab('community')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'community' ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'}`}
        >
          <Users size={14} /> My Communities
        </button>
      </div>

      {/* Community selector */}
      {tab === 'community' && (
        myCommunities.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            {myCommunities.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCommunityId(c.id)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                  activeCommunityId === c.id
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    : 'border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm">
            <Users size={16} className="text-blue-400 flex-shrink-0" />
            <span className="text-[rgb(var(--muted-fg))]">You haven't joined any communities yet. </span>
            <Link to="/communities" className="text-blue-400 hover:underline font-medium">Browse communities</Link>
          </div>
        )
      )}

      {/* Thread */}
      {tab === 'community' && !communityId ? null : (
        <ChatThread
          key={`${scope}:${communityId ?? 'global'}`}
          scope={scope}
          communityId={communityId}
          canPost={!!user}
          displayName={displayName}
          isAdmin={isAdmin}
          authLoading={authLoading}
        />
      )}
    </main>
  )
}

// ─── Thread (feed + composer), self-contained per scope/community ─────────────

function ChatThread({
  scope,
  communityId,
  canPost,
  displayName,
  isAdmin,
  authLoading,
}: {
  scope: 'global' | 'community'
  communityId: number | null
  canPost: boolean
  displayName: string
  isAdmin: boolean
  authLoading: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const lastTsRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)

  const baseQuery = useCallback(() => {
    const p = new URLSearchParams({ scope })
    if (scope === 'community' && communityId !== null) p.set('communityId', String(communityId))
    return p
  }, [scope, communityId])

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  // Initial load.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAccessError(null)
    setMessages([])
    lastTsRef.current = null

    const p = baseQuery()
    fetch(`/api/messages?${p.toString()}`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Unable to load messages')
        }
        return res.json()
      })
      .then((data: { messages: ChatMessage[] }) => {
        if (cancelled) return
        setMessages(data.messages)
        if (data.messages.length) lastTsRef.current = data.messages[data.messages.length - 1].createdAt
        setLoading(false)
        scrollToBottom()
      })
      .catch(err => {
        if (cancelled) return
        setAccessError(err.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [baseQuery])

  // Poll for new messages every 5s.
  useEffect(() => {
    if (accessError) return
    const id = setInterval(async () => {
      const p = baseQuery()
      if (lastTsRef.current) p.set('since', lastTsRef.current)
      try {
        const res = await fetch(`/api/messages?${p.toString()}`)
        if (!res.ok) return
        const data = (await res.json()) as { messages: ChatMessage[] }
        if (data.messages.length) {
          setMessages(prev => {
            const seen = new Set(prev.map(m => m.id))
            const fresh = data.messages.filter(m => !seen.has(m.id))
            if (!fresh.length) return prev
            lastTsRef.current = data.messages[data.messages.length - 1].createdAt
            return [...prev, ...fresh]
          })
          scrollToBottom()
        }
      } catch { /* transient — next tick retries */ }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [baseQuery, accessError])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, communityId, body, displayName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send')
      }
      const data = (await res.json()) as { message: ChatMessage }
      setMessages(prev => [...prev, data.message])
      lastTsRef.current = data.message.createdAt
      setDraft('')
      scrollToBottom()
    } catch (e: any) {
      console.error('Send failed', e)
      setAccessError(e?.message ?? 'Failed to send')
    }
    setSending(false)
  }

  const remove = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
    try {
      await fetch(`/api/messages?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  return (
    <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl flex flex-col h-[60vh] min-h-[360px] overflow-hidden">
      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={22} className="animate-spin text-[rgb(var(--muted-fg))]" />
          </div>
        ) : accessError ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
            <Lock size={24} className="text-[rgb(var(--muted-fg))] opacity-40" />
            <p className="text-sm text-[rgb(var(--muted-fg))]">{accessError}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare size={24} className="text-[rgb(var(--muted-fg))] opacity-30" />
            <p className="text-sm text-[rgb(var(--muted-fg))]">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`group max-w-[78%] rounded-2xl px-3.5 py-2 ${
                m.mine
                  ? 'bg-blue-600 text-white'
                  : 'bg-[rgb(var(--surface-hover))] text-[rgb(var(--fg))]'
              }`}>
                {!m.mine && (
                  <div className="text-[11px] font-semibold text-blue-400 mb-0.5">{m.senderName}</div>
                )}
                <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`flex items-center gap-2 mt-0.5 ${m.mine ? 'justify-end' : ''}`}>
                  <span className={`text-[10px] ${m.mine ? 'text-blue-100/80' : 'text-[rgb(var(--muted-fg))]'}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => remove(m.id)}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity ${m.mine ? 'text-blue-100/80 hover:text-white' : 'text-[rgb(var(--muted-fg))] hover:text-red-400'}`}
                      title="Delete message"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-[rgb(var(--border-soft))] p-3">
        {authLoading ? (
          <div className="text-center text-xs text-[rgb(var(--muted-fg))] py-2">Checking sign-in…</div>
        ) : canPost ? (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="Type a message…"
              rows={1}
              maxLength={500}
              className="flex-1 resize-none bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2.5 text-sm max-h-32"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 flex-shrink-0"
              title="Send"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        ) : (
          <div className="text-center text-sm text-[rgb(var(--muted-fg))] py-2">
            <Link to="/join" className="text-blue-400 hover:underline font-medium">Join as a member</Link> to post.
          </div>
        )}
      </div>
    </div>
  )
}
