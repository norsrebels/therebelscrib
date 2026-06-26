// src/routes/api.messages.ts
// Polling-based chat: global thread + per-community threads.
//
//   GET  /api/messages?scope=global
//   GET  /api/messages?scope=community&communityId=<int>
//   GET  /api/messages?...&since=<ISO timestamp>   → delta poll (only newer messages)
//   POST /api/messages    body: { scope, communityId?, body, displayName? }  (requires sign-in)
//   DELETE /api/messages?id=<int>                  (admin only)
//
// Access model (consistent with the rest of the app):
//   • Global    — anyone may READ; any signed-in user may POST.
//   • Community — must be a MEMBER of that community to READ or POST (admins always pass).
// Sender display name comes from the client (same as photo comments), with an
// email local-part fallback; the user identity (netlify_user_id) is server-verified.

import { createFileRoute } from '@tanstack/react-router'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry, jsonResponse, errorResponse } from '@/lib/db-retry'
import { getStatIdentity } from '@/lib/auth-server'

const MAX_BODY_LEN = 500
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

type Scope = 'global' | 'community'

function parseScope(raw: string | null | undefined): Scope {
  return raw === 'community' ? 'community' : 'global'
}

function parseCommunityId(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

async function isCommunityMember(communityId: number, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true
  const rows = await db.execute(sql`
    SELECT 1 FROM community_members
    WHERE community_id = ${communityId} AND netlify_user_id = ${userId}
    LIMIT 1
  `)
  return rows.rows.length > 0
}

export const Route = createFileRoute('/api/messages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const scope = parseScope(url.searchParams.get('scope'))
        const communityId = parseCommunityId(url.searchParams.get('communityId'))
        const since = url.searchParams.get('since')
        const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

        if (scope === 'community') {
          if (communityId === null) return errorResponse('communityId is required for community scope', 400)
          const identity = await getStatIdentity()
          if (!identity) return errorResponse('Sign in to view this community thread', 401)
          const ok = await isCommunityMember(communityId, identity.userId, identity.role)
          if (!ok) return errorResponse('Join this community to view its thread', 403)
        }

        const filterCommunityId = scope === 'community' ? communityId : null

        try {
          const rows = await withRetry(async () => {
            if (since) {
              return db.execute(sql`
                SELECT id, scope, community_id, netlify_user_id, sender_name, body, created_at
                FROM chat_messages
                WHERE scope = ${scope}
                  AND community_id IS NOT DISTINCT FROM ${filterCommunityId}
                  AND created_at > ${since}
                ORDER BY created_at ASC
                LIMIT ${MAX_LIMIT}
              `)
            }
            return db.execute(sql`
              SELECT * FROM (
                SELECT id, scope, community_id, netlify_user_id, sender_name, body, created_at
                FROM chat_messages
                WHERE scope = ${scope}
                  AND community_id IS NOT DISTINCT FROM ${filterCommunityId}
                ORDER BY created_at DESC
                LIMIT ${limit}
              ) t ORDER BY created_at ASC
            `)
          })

          const identity = await getStatIdentity()
          const messages = (rows.rows as any[]).map((r) => ({
            id: Number(r.id),
            senderName: r.sender_name as string,
            body: r.body as string,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            mine: identity ? r.netlify_user_id === identity.userId : false,
          }))

          return jsonResponse({ messages, serverTime: new Date().toISOString() })
        } catch (err) {
          console.error('GET /api/messages failed (is the migration applied?):', err)
          return jsonResponse({ messages: [], serverTime: new Date().toISOString() })
        }
      },

      POST: async ({ request }) => {
        const identity = await getStatIdentity()
        if (!identity) return errorResponse('Sign in to post a message', 401)

        const body = (await request.json()) as {
          scope?: string
          communityId?: number | string | null
          body?: string
          displayName?: string
        }
        const scope = parseScope(body.scope)
        const text = (body.body ?? '').trim()

        if (!text) return errorResponse('Message cannot be empty', 400)
        if (text.length > MAX_BODY_LEN) return errorResponse(`Message too long (max ${MAX_BODY_LEN})`, 400)

        let communityId: number | null = null
        if (scope === 'community') {
          communityId = parseCommunityId(body.communityId)
          if (communityId === null) return errorResponse('communityId is required for community scope', 400)
          const ok = await isCommunityMember(communityId, identity.userId, identity.role)
          if (!ok) return errorResponse('Join this community to post in its thread', 403)
        }

        const senderName = (body.displayName?.trim() || identity.email.split('@')[0] || 'Member')

        const result = await withRetry(async () =>
          db.execute(sql`
            INSERT INTO chat_messages (scope, community_id, netlify_user_id, netlify_email, sender_name, body)
            VALUES (${scope}, ${communityId}, ${identity.userId}, ${identity.email}, ${senderName}, ${text})
            RETURNING id, sender_name, body, created_at
          `),
        )
        const row = result.rows[0] as any
        return jsonResponse({
          message: {
            id: Number(row.id),
            senderName: row.sender_name,
            body: row.body,
            createdAt: new Date(row.created_at).toISOString(),
            mine: true,
          },
        })
      },

      DELETE: async ({ request }) => {
        const identity = await getStatIdentity()
        if (!identity) return errorResponse('Unauthorized', 401)
        if (identity.role !== 'admin') return errorResponse('Admin access required', 403)

        const id = parseCommunityId(new URL(request.url).searchParams.get('id'))
        if (id === null) return errorResponse('Message id is required', 400)

        await withRetry(async () => db.execute(sql`DELETE FROM chat_messages WHERE id = ${id}`))
        return jsonResponse({ ok: true })
      },
    },
  },
})
