// src/server/member.functions.ts
// All member engagement server functions — reactions, comments, predictions, polls, ratings

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { eq, and, sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getStatIdentity } from '@/lib/auth-server'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireMember() {
  const identity = await getStatIdentity()
  if (!identity) throw new Error('You must be signed in to do this')
  return identity
}

// ─── Photo Reactions ─────────────────────────────────────────────────────────

export const upsertPhotoReaction = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageId: string; reaction: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO photo_reactions (netlify_user_id, netlify_email, image_id, reaction)
        VALUES (${identity.userId}, ${identity.email}, ${data.imageId}, ${data.reaction})
        ON CONFLICT (netlify_user_id, image_id)
        DO UPDATE SET reaction = ${data.reaction}
      `)
      return { ok: true }
    })
  })

export const removePhotoReaction = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    return withRetry(async () => {
      await db.execute(sql`
        DELETE FROM photo_reactions
        WHERE netlify_user_id = ${identity.userId} AND image_id = ${data.imageId}
      `)
      return { ok: true }
    })
  })

export const getPhotoReactions = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageIds: string[] }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    return withRetry(async () => {
      if (data.imageIds.length === 0) return { counts: {}, mine: {} }

      // Get reaction counts per image
      const countRows = await db.execute(sql`
        SELECT image_id, reaction, COUNT(*) as count
        FROM photo_reactions
        WHERE image_id = ANY(${data.imageIds})
        GROUP BY image_id, reaction
      `)

      // Get current user's reactions
      const myRows = identity ? await db.execute(sql`
        SELECT image_id, reaction FROM photo_reactions
        WHERE netlify_user_id = ${identity.userId}
        AND image_id = ANY(${data.imageIds})
      `) : { rows: [] }

      const counts: Record<string, Record<string, number>> = {}
      for (const row of countRows.rows as any[]) {
        if (!counts[row.image_id]) counts[row.image_id] = {}
        counts[row.image_id][row.reaction] = Number(row.count)
      }

      const mine: Record<string, string> = {}
      for (const row of myRows.rows as any[]) {
        mine[row.image_id] = row.reaction
      }

      return { counts, mine }
    })
  })

// ─── Photo Comments ──────────────────────────────────────────────────────────

export const addPhotoComment = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageId: string; body: string; displayName: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    if (!data.body.trim()) throw new Error('Comment cannot be empty')
    if (data.body.length > 300) throw new Error('Comment too long (max 300 chars)')
    return withRetry(async () => {
      const result = await db.execute(sql`
        INSERT INTO photo_comments (netlify_user_id, netlify_email, display_name, image_id, body)
        VALUES (${identity.userId}, ${identity.email}, ${data.displayName}, ${data.imageId}, ${data.body.trim()})
        RETURNING id, netlify_email, display_name, body, created_at
      `)
      return result.rows[0]
    })
  })

export const getPhotoComments = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageId: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const result = await db.execute(sql`
        SELECT id, netlify_email, display_name, body, created_at
        FROM photo_comments
        WHERE image_id = ${data.imageId}
        ORDER BY created_at ASC
        LIMIT 50
      `)
      return result.rows
    })
  })

export const deletePhotoComment = createServerFn({ method: 'POST' })
  .inputValidator((data: { commentId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    return withRetry(async () => {
      // Only allow deleting own comments (admin can delete any)
      await db.execute(sql`
        DELETE FROM photo_comments
        WHERE id = ${data.commentId}
        AND (netlify_user_id = ${identity.userId} OR ${identity.role} = 'admin')
      `)
      return { ok: true }
    })
  })

// ─── Match Predictions ───────────────────────────────────────────────────────

export const submitMatchPrediction = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    matchId: string
    predictedWinnerId: string
    predictedWinnerName: string
  }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO match_predictions
          (netlify_user_id, netlify_email, match_id, predicted_winner_id, predicted_winner_name)
        VALUES
          (${identity.userId}, ${identity.email}, ${data.matchId},
           ${data.predictedWinnerId}, ${data.predictedWinnerName})
        ON CONFLICT (netlify_user_id, match_id) DO UPDATE SET
          predicted_winner_id = ${data.predictedWinnerId},
          predicted_winner_name = ${data.predictedWinnerName},
          was_correct = NULL,
          resolved_at = NULL
      `)
      return { ok: true }
    })
  })

export const getMatchPredictions = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    return withRetry(async () => {
      // Prediction counts by team
      const counts = await db.execute(sql`
        SELECT predicted_winner_id, predicted_winner_name, COUNT(*) as count
        FROM match_predictions
        WHERE match_id = ${data.matchId}
        GROUP BY predicted_winner_id, predicted_winner_name
      `)

      // User's own prediction
      const mine = identity ? await db.execute(sql`
        SELECT predicted_winner_id, predicted_winner_name, was_correct
        FROM match_predictions
        WHERE match_id = ${data.matchId} AND netlify_user_id = ${identity.userId}
        LIMIT 1
      `) : { rows: [] }

      return {
        counts: counts.rows,
        mine: mine.rows[0] ?? null,
        total: (counts.rows as any[]).reduce((s, r) => s + Number(r.count), 0),
      }
    })
  })

// ─── Match Ratings ───────────────────────────────────────────────────────────

export const submitMatchRating = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string; rating: number; comment?: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    if (data.rating < 1 || data.rating > 5) throw new Error('Rating must be 1–5')
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO match_ratings (netlify_user_id, netlify_email, match_id, rating, comment)
        VALUES (${identity.userId}, ${identity.email}, ${data.matchId}, ${data.rating}, ${data.comment ?? null})
        ON CONFLICT (netlify_user_id, match_id) DO UPDATE SET
          rating = ${data.rating}, comment = ${data.comment ?? null}
      `)
      return { ok: true }
    })
  })

export const getMatchRatings = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    return withRetry(async () => {
      const [avg] = await db.execute(sql`
        SELECT ROUND(AVG(rating), 1) as avg, COUNT(*) as count
        FROM match_ratings WHERE match_id = ${data.matchId}
      `)

      const mine = identity ? await db.execute(sql`
        SELECT rating, comment FROM match_ratings
        WHERE match_id = ${data.matchId} AND netlify_user_id = ${identity.userId} LIMIT 1
      `) : { rows: [] }

      const avgRow = (avg as any).rows?.[0] ?? { avg: null, count: 0 }
      return {
        avg: avgRow.avg ? Number(avgRow.avg) : null,
        count: Number(avgRow.count),
        mine: mine.rows[0] ?? null,
      }
    })
  })

// ─── Player Ratings ──────────────────────────────────────────────────────────

export const submitPlayerRating = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    playerId: number; matchId?: string; rating: number; note?: string
  }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    if (data.rating < 1 || data.rating > 5) throw new Error('Rating must be 1–5')
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO player_ratings
          (netlify_user_id, netlify_email, player_id, match_id, rating, note)
        VALUES
          (${identity.userId}, ${identity.email}, ${data.playerId},
           ${data.matchId ?? null}, ${data.rating}, ${data.note ?? null})
        ON CONFLICT (netlify_user_id, player_id, match_id) DO UPDATE SET
          rating = ${data.rating}, note = ${data.note ?? null}
      `)
      return { ok: true }
    })
  })

export const getPlayerRatings = createServerFn({ method: 'POST' })
  .inputValidator((data: { playerId: number }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    return withRetry(async () => {
      const [avg] = await db.execute(sql`
        SELECT ROUND(AVG(rating), 1) as avg, COUNT(*) as count
        FROM player_ratings WHERE player_id = ${data.playerId}
      `)
      const mine = identity ? await db.execute(sql`
        SELECT rating, note FROM player_ratings
        WHERE player_id = ${data.playerId} AND netlify_user_id = ${identity.userId}
        ORDER BY created_at DESC LIMIT 1
      `) : { rows: [] }

      const avgRow = (avg as any).rows?.[0] ?? { avg: null, count: 0 }
      return {
        avg: avgRow.avg ? Number(avgRow.avg) : null,
        count: Number(avgRow.count),
        mine: mine.rows[0] ?? null,
      }
    })
  })

// ─── Polls ───────────────────────────────────────────────────────────────────

export const getActivePolls = createServerFn({ method: 'GET' })
  .handler(async () => {
    return withRetry(async () => {
      const result = await db.execute(sql`
        SELECT id, question, options, closes_at, created_at
        FROM polls
        WHERE is_active = true
        AND (closes_at IS NULL OR closes_at > now())
        ORDER BY created_at DESC
      `)
      return result.rows
    })
  })

export const getPollWithResults = createServerFn({ method: 'POST' })
  .inputValidator((data: { pollId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    return withRetry(async () => {
      const [poll] = await db.execute(sql`
        SELECT id, question, options, closes_at, is_active FROM polls WHERE id = ${data.pollId}
      `)
      const pollRow = (poll as any).rows?.[0]
      if (!pollRow) throw new Error('Poll not found')

      const votes = await db.execute(sql`
        SELECT answer_index, COUNT(*) as count
        FROM poll_responses WHERE poll_id = ${data.pollId}
        GROUP BY answer_index ORDER BY answer_index
      `)

      const mine = identity ? await db.execute(sql`
        SELECT answer_index FROM poll_responses
        WHERE poll_id = ${data.pollId} AND netlify_user_id = ${identity.userId} LIMIT 1
      `) : { rows: [] }

      const voteCounts: Record<number, number> = {}
      for (const row of (votes.rows as any[])) {
        voteCounts[Number(row.answer_index)] = Number(row.count)
      }
      const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0)

      return {
        poll: pollRow,
        voteCounts,
        totalVotes,
        myAnswer: (mine.rows[0] as any)?.answer_index ?? null,
      }
    })
  })

export const submitPollResponse = createServerFn({ method: 'POST' })
  .inputValidator((data: { pollId: string; answerIndex: number }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO poll_responses (poll_id, netlify_user_id, netlify_email, answer_index)
        VALUES (${data.pollId}, ${identity.userId}, ${identity.email}, ${data.answerIndex})
        ON CONFLICT (poll_id, netlify_user_id) DO NOTHING
      `)
      return { ok: true }
    })
  })

export const createPoll = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    question: string
    options: string[]
    closesAt?: string
  }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    if (!identity || identity.role !== 'admin') throw new Error('Admin access required')
    if (data.options.length < 2) throw new Error('Poll needs at least 2 options')
    return withRetry(async () => {
      const result = await db.execute(sql`
        INSERT INTO polls (question, options, closes_at, created_by)
        VALUES (
          ${data.question},
          ${JSON.stringify(data.options)}::jsonb,
          ${data.closesAt ?? null},
          ${identity.email}
        )
        RETURNING id
      `)
      return result.rows[0]
    })
  })

// ─── Member Profile ──────────────────────────────────────────────────────────

export const getMemberProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const result = await db.execute(sql`
        SELECT netlify_user_id, netlify_email, display_name, avatar_url,
               fan_level, total_reactions, total_predictions, correct_predictions, created_at
        FROM member_profiles WHERE netlify_user_id = ${data.userId}
      `)
      return result.rows[0] ?? null
    })
  })

export const upsertMemberProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: { displayName: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireMember()
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO member_profiles (netlify_user_id, netlify_email, display_name)
        VALUES (${identity.userId}, ${identity.email}, ${data.displayName})
        ON CONFLICT (netlify_user_id) DO UPDATE SET
          display_name = ${data.displayName},
          updated_at = now()
      `)
      return { ok: true }
    })
  })

export const getMyActivity = createServerFn({ method: 'GET' })
  .handler(async () => {
    const identity = await requireMember()
    return withRetry(async () => {
      const [reactions, predictions, ratings, pollVotes] = await Promise.all([
        db.execute(sql`
          SELECT image_id, reaction, created_at FROM photo_reactions
          WHERE netlify_user_id = ${identity.userId}
          ORDER BY created_at DESC LIMIT 20
        `),
        db.execute(sql`
          SELECT match_id, predicted_winner_name, was_correct, created_at
          FROM match_predictions
          WHERE netlify_user_id = ${identity.userId}
          ORDER BY created_at DESC LIMIT 20
        `),
        db.execute(sql`
          SELECT player_id, rating, note, created_at FROM player_ratings
          WHERE netlify_user_id = ${identity.userId}
          ORDER BY created_at DESC LIMIT 20
        `),
        db.execute(sql`
          SELECT pr.poll_id, p.question, pr.answer_index, pr.created_at
          FROM poll_responses pr
          JOIN polls p ON p.id = pr.poll_id
          WHERE pr.netlify_user_id = ${identity.userId}
          ORDER BY pr.created_at DESC LIMIT 20
        `),
      ])

      // Compute fan level based on activity
      const totalActivity = reactions.rows.length + predictions.rows.length +
        ratings.rows.length + pollVotes.rows.length
      const fanLevel = totalActivity >= 50 ? 'Die-Hard'
        : totalActivity >= 20 ? 'Regular'
        : totalActivity >= 5 ? 'Fan'
        : 'Rookie'

      return {
        reactions: reactions.rows,
        predictions: predictions.rows,
        ratings: ratings.rows,
        pollVotes: pollVotes.rows,
        fanLevel,
        totalActivity,
      }
    })
  })
