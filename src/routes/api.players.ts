import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '@/lib/auth-server'
import { db } from '../../db/index.js'
import { players } from '../../db/schema.js'
import { ilike, eq } from 'drizzle-orm'
import { withRetry, jsonResponse, errorResponse } from '@/lib/db-retry'

export const Route = createFileRoute('/api/players')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q')?.toLowerCase() ?? ''

        const result = await withRetry(async () => {
          if (query) {
            return db.select().from(players).where(ilike(players.nickname, `%${query}%`));
          }
          return db.select().from(players);
        });

        const mappedPlayers = result.map(p => ({
          id: p.id.toString(),
          name: p.nickname,
          position: p.position,
          skillLevel: p.playerLevel
        }));

        return jsonResponse({ players: mappedPlayers })
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin()
        if (auth instanceof Response) return auth

        const body = (await request.json()) as any
        if (!body.name) {
          return errorResponse('Invalid player data', 400)
        }

        await withRetry(async () => {
          if (body.id && !isNaN(parseInt(body.id))) {
            await db.update(players).set({ nickname: body.name, position: body.position || '', playerLevel: body.skillLevel || 'Developmental' }).where(eq(players.id, parseInt(body.id)));
          } else {
            await db.insert(players).values({ nickname: body.name, position: body.position || '', playerLevel: body.skillLevel || 'Developmental' });
          }
        });

        return jsonResponse({ ok: true, player: body })
      },
    },
  },
})
