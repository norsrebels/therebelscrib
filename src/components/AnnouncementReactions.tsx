// src/components/AnnouncementReactions.tsx
// Emoji reactions for announcements. Self-loading per card with optimistic updates.
// Mirrors the PhotoEngagement reaction pattern exactly.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-client'
import {
  upsertAnnouncementReaction,
  removeAnnouncementReaction,
  getAnnouncementReactions,
} from '@/server/member.functions'

const REACTIONS = ['👍', '🔥', '💪', '❤️', '🏐']

export function AnnouncementReactions({ announcementId }: { announcementId: number }) {
  const { isMember } = useAuth()
  const [counts, setCounts]       = useState<Record<string, number>>({})
  const [myReaction, setMyReaction] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await getAnnouncementReactions({ data: { announcementIds: [announcementId] } })
      setCounts(data.counts?.[announcementId] ?? {})
      setMyReaction(data.mine?.[announcementId] ?? null)
    } catch (e) {
      // Fail silently — reactions are non-critical
      console.error('Failed to load announcement reactions', e)
    }
    setLoading(false)
  }, [announcementId])

  useEffect(() => { load() }, [load])

  const handleReaction = async (emoji: string) => {
    if (!isMember) return
    const wasMine = myReaction === emoji

    // Optimistic update
    setCounts(prev => {
      const next = { ...prev }
      if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] ?? 1) - 1)
      if (!wasMine)   next[emoji] = (next[emoji] ?? 0) + 1
      return next
    })
    setMyReaction(wasMine ? null : emoji)

    try {
      if (wasMine) {
        await removeAnnouncementReaction({ data: { announcementId } })
      } else {
        await upsertAnnouncementReaction({ data: { announcementId, reaction: emoji } })
      }
    } catch (e) {
      console.error('Reaction failed', e)
      load() // revert to server truth on failure
    }
  }

  // Don't render until loaded (avoids layout shift with empty → populated)
  if (loading) return (
    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[rgb(var(--border-soft))]">
      {REACTIONS.map(e => (
        <div key={e} className="w-10 h-7 rounded-full bg-[rgb(var(--surface-hover))] animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-[rgb(var(--border-soft))]">
      {REACTIONS.map(emoji => {
        const count = counts[emoji] ?? 0
        const isMine = myReaction === emoji
        return (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); handleReaction(emoji) }}
            disabled={!isMember}
            title={isMember ? `React with ${emoji}` : 'Sign in as a member to react'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all select-none ${
              isMine
                ? 'bg-blue-500/15 ring-1 ring-blue-500/40 text-blue-500'
                : 'bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--surface))] text-[rgb(var(--fg))]'
            } ${!isMember ? 'opacity-50 cursor-default' : 'cursor-pointer active:scale-95'}`}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-xs font-bold tabular-nums">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
