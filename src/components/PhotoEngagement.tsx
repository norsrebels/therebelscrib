// src/components/PhotoEngagement.tsx
// Reactions + comments for a gallery photo. Used inside the gallery lightbox.

import { useState, useEffect, useCallback } from 'react'
import { useAuth, getUserDisplayName } from '@/lib/auth-client'
import {
  upsertPhotoReaction,
  removePhotoReaction,
  getPhotoReactions,
  addPhotoComment,
  getPhotoComments,
  deletePhotoComment,
} from '@/server/member.functions'
import { Loader2, Send, Trash2, MessageCircle } from 'lucide-react'

const REACTIONS = ['👏', '🔥', '💪', '❤️', '🏐']

export function PhotoEngagement({ imageId }: { imageId: string }) {
  const { user, isMember, isAdmin } = useAuth()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [myReaction, setMyReaction] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const load = useCallback(async () => {
    if (!imageId) return
    setLoading(true)
    try {
      const [reactionData, commentData] = await Promise.all([
        getPhotoReactions({ data: { imageIds: [imageId] } }),
        getPhotoComments({ data: { imageId } }),
      ])
      setCounts(reactionData.counts?.[imageId] ?? {})
      setMyReaction(reactionData.mine?.[imageId] ?? null)
      setComments(commentData ?? [])
    } catch (e) {
      console.error('Failed to load engagement', e)
    }
    setLoading(false)
  }, [imageId])

  useEffect(() => { load() }, [load])

  const handleReaction = async (emoji: string) => {
    if (!isMember) return
    const wasMine = myReaction === emoji
    // Optimistic update
    setCounts(prev => {
      const next = { ...prev }
      if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] ?? 1) - 1)
      if (!wasMine) next[emoji] = (next[emoji] ?? 0) + 1
      return next
    })
    setMyReaction(wasMine ? null : emoji)
    try {
      if (wasMine) {
        await removePhotoReaction({ data: { imageId } })
      } else {
        await upsertPhotoReaction({ data: { imageId, reaction: emoji } })
      }
    } catch (e) {
      console.error('Reaction failed', e)
      load() // revert by reloading truth
    }
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim() || !isMember) return
    setSubmitting(true)
    try {
      await addPhotoComment({
        data: {
          imageId,
          body: commentBody.trim(),
          displayName: getUserDisplayName(user),
        }
      })
      setCommentBody('')
      await load()
    } catch (e) {
      console.error('Comment failed', e)
    }
    setSubmitting(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deletePhotoComment({ data: { commentId } })
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (e) {
      console.error('Delete comment failed', e)
    }
  }

  const totalReactions = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
      {/* Reactions bar */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {REACTIONS.map(emoji => {
          const count = counts[emoji] ?? 0
          const isMine = myReaction === emoji
          return (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              disabled={!isMember}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm transition-all ${
                isMine
                  ? 'bg-blue-500/30 ring-1 ring-blue-400'
                  : 'bg-white/10 hover:bg-white/20'
              } ${!isMember ? 'opacity-60 cursor-default' : 'cursor-pointer active:scale-95'}`}
              title={isMember ? '' : 'Join as a member to react'}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-xs font-bold text-white/80">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Comments toggle */}
      <button
        onClick={() => setShowComments(v => !v)}
        className="mt-3 mx-auto flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
      >
        <MessageCircle size={13} />
        {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Comments'}
      </button>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 size={16} className="animate-spin text-white/50" />
            </div>
          ) : (
            <>
              {comments.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-2 text-left bg-white/5 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white/90">{c.display_name || c.netlify_email?.split('@')[0]}</span>
                        <p className="text-xs text-white/70 break-words">{c.body}</p>
                      </div>
                      {(isAdmin || (user && c.netlify_user_id === user.id)) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-white/40 hover:text-red-400 flex-shrink-0"
                          aria-label="Delete comment"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Comment input */}
              {isMember ? (
                <form onSubmit={handleComment} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    placeholder="Add a comment..."
                    maxLength={300}
                    className="flex-1 bg-white/10 border border-white/10 focus:border-blue-400 outline-none rounded-full px-4 py-2 text-sm text-white placeholder-white/40"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !commentBody.trim()}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white disabled:opacity-50 transition-colors"
                    aria-label="Post comment"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-white/50 text-center">
                  <a href="/join" className="text-blue-400 hover:underline">Join as a member</a> to comment.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
