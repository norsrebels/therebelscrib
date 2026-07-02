// src/server/community.functions.ts
// Communities: CRUD (admin), self-service join/leave (any signed-in user),
// and the many-to-many tournament↔community linkage.
//
// Aligned to db/schema.ts: serial integer ids, community_members.display_name,
// keyed on netlify_user_id (+ denormalized netlify_email). Query style follows
// member.functions.ts (raw SQL via db.execute). "Signed in == participant" so
// admins/statisticians are never locked out. Reads fail soft (return empty) if the
// migration hasn't been applied yet, so pages never white-screen.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getStatIdentity } from '@/lib/auth-server'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireSignedIn() {
  const identity = await getStatIdentity()
  if (!identity) throw new Error('You must be signed in to do this')
  return identity
}

async function requireAdmin() {
  const identity = await getStatIdentity()
  if (!identity || identity.role !== 'admin') throw new Error('Admin access required')
  return identity
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function assertValidSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Slug must be lowercase letters, numbers, and single dashes')
  }
}

// Validates + normalizes a hex color (#rgb or #rrggbb). Returns null if invalid,
// so callers can fall back to a default rather than storing junk.
function normalizeHex(input?: string | null): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return ('#' + s.slice(1).split('').map((c) => c + c).join('')).toLowerCase()
  }
  return null
}

// ─── Read: list communities (public) ──────────────────────────────────────────

export const getCommunities = createServerFn({ method: 'GET' }).handler(async () => {
  const identity = await getStatIdentity()
  return withRetry(async () => {
    try {
      const rows = await db.execute(sql`
        SELECT
          c.id, c.slug, c.name, c.description, c.created_at,
          c.color_primary, c.color_secondary,
          (SELECT COUNT(*) FROM community_members      m  WHERE m.community_id  = c.id) AS member_count,
          (SELECT COUNT(*) FROM tournament_communities tc WHERE tc.community_id = c.id) AS schedule_count
        FROM communities c
        ORDER BY c.name ASC
      `)

      let mine = new Set<number>()
      if (identity) {
        const myRows = await db.execute(sql`
          SELECT community_id FROM community_members WHERE netlify_user_id = ${identity.userId}
        `)
        mine = new Set((myRows.rows as any[]).map((r) => Number(r.community_id)))
      }

      return (rows.rows as any[]).map((r) => ({
        id: Number(r.id),
        slug: r.slug as string,
        name: r.name as string,
        description: (r.description as string) ?? '',
        colorPrimary: (r.color_primary as string) ?? '#1e3a8a',
        colorSecondary: (r.color_secondary as string) ?? '#ffffff',
        memberCount: Number(r.member_count),
        scheduleCount: Number(r.schedule_count),
        isMember: mine.has(Number(r.id)),
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      }))
    } catch (err) {
      console.error('getCommunities failed (is the migration applied?):', err)
      return []
    }
  })
})

// ─── Read: members of one community (admin only) ──────────────────────────────

export const getCommunityMembers = createServerFn({ method: 'POST' })
  .inputValidator((data: { communityId: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin()
    return withRetry(async () => {
      const rows = await db.execute(sql`
        SELECT netlify_user_id, netlify_email, display_name, joined_at
        FROM community_members
        WHERE community_id = ${data.communityId}
        ORDER BY joined_at ASC
      `)
      return (rows.rows as any[]).map((r) => ({
        netlifyUserId: r.netlify_user_id as string,
        email: r.netlify_email as string,
        displayName: (r.display_name as string) || (r.netlify_email as string).split('@')[0],
        joinedAt: r.joined_at ? new Date(r.joined_at).getTime() : null,
      }))
    })
  })

// ─── Write: community CRUD (admin only) ───────────────────────────────────────

export const createCommunity = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; slug?: string; description?: string; colorPrimary?: string; colorSecondary?: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin()
    const name = data.name.trim()
    if (!name) throw new Error('Community name is required')
    const slug = (data.slug?.trim() || slugify(name))
    assertValidSlug(slug)
    const primary = normalizeHex(data.colorPrimary) ?? '#1e3a8a'
    const secondary = normalizeHex(data.colorSecondary) ?? '#ffffff'
    return withRetry(async () => {
      try {
        const result = await db.execute(sql`
          INSERT INTO communities (slug, name, description, color_primary, color_secondary)
          VALUES (${slug}, ${name}, ${data.description?.trim() ?? ''}, ${primary}, ${secondary})
          RETURNING id, slug, name, description, color_primary, color_secondary
        `)
        const row = result.rows[0] as any
        return { id: Number(row.id), slug: row.slug, name: row.name, description: row.description, colorPrimary: row.color_primary, colorSecondary: row.color_secondary }
      } catch (err: any) {
        if (String(err?.message ?? '').includes('communities_slug')) {
          throw new Error(`The slug "${slug}" is already in use`)
        }
        throw err
      }
    })
  })

export const updateCommunity = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; name?: string; slug?: string; description?: string; colorPrimary?: string; colorSecondary?: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (data.slug !== undefined) assertValidSlug(data.slug.trim())
    const primary = data.colorPrimary !== undefined ? normalizeHex(data.colorPrimary) : null
    const secondary = data.colorSecondary !== undefined ? normalizeHex(data.colorSecondary) : null
    return withRetry(async () => {
      await db.execute(sql`
        UPDATE communities SET
          name            = COALESCE(${data.name?.trim() ?? null}, name),
          slug            = COALESCE(${data.slug?.trim() ?? null}, slug),
          description     = COALESCE(${data.description?.trim() ?? null}, description),
          color_primary   = COALESCE(${primary}, color_primary),
          color_secondary = COALESCE(${secondary}, color_secondary),
          updated_at      = now()
        WHERE id = ${data.id}
      `)
      return { ok: true }
    })
  })

export const deleteCommunity = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin()
    return withRetry(async () => {
      // ON DELETE CASCADE clears community_members, tournament_communities, and
      // community-scoped chat_messages automatically.
      await db.execute(sql`DELETE FROM communities WHERE id = ${data.id}`)
      return { ok: true }
    })
  })

// ─── Write: self-service membership (any signed-in user) ──────────────────────

export const joinCommunity = createServerFn({ method: 'POST' })
  .inputValidator((data: { communityId: number; displayName?: string }) => data)
  .handler(async ({ data }) => {
    const identity = await requireSignedIn()
    const displayName = (data.displayName?.trim() || identity.email.split('@')[0] || 'Member')
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO community_members (community_id, netlify_user_id, netlify_email, display_name)
        VALUES (${data.communityId}, ${identity.userId}, ${identity.email}, ${displayName})
        ON CONFLICT (community_id, netlify_user_id) DO UPDATE SET display_name = ${displayName}
      `)
      return { ok: true }
    })
  })

export const leaveCommunity = createServerFn({ method: 'POST' })
  .inputValidator((data: { communityId: number }) => data)
  .handler(async ({ data }) => {
    const identity = await requireSignedIn()
    return withRetry(async () => {
      await db.execute(sql`
        DELETE FROM community_members
        WHERE community_id = ${data.communityId} AND netlify_user_id = ${identity.userId}
      `)
      return { ok: true }
    })
  })

// ─── Tournament ↔ community linkage ───────────────────────────────────────────

export const getTournamentCommunities = createServerFn({ method: 'POST' })
  .inputValidator((data: { tournamentExternalId: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      try {
        const rows = await db.execute(sql`
          SELECT c.id, c.slug, c.name
          FROM tournament_communities tc
          JOIN communities c ON c.id = tc.community_id
          WHERE tc.tournament_external_id = ${data.tournamentExternalId}
          ORDER BY c.name ASC
        `)
        return (rows.rows as any[]).map((r) => ({ id: Number(r.id), slug: r.slug, name: r.name }))
      } catch {
        return []
      }
    })
  })

// Replace the full set of communities a schedule is linked to (admin). Idempotent:
// pass [] to clear. Many-to-many, so a schedule can sit in several communities.
export const setTournamentCommunities = createServerFn({ method: 'POST' })
  .inputValidator((data: { tournamentExternalId: string; communityIds: number[] }) => data)
  .handler(async ({ data }) => {
    await requireAdmin()
    return withRetry(async () => {
      await db.execute(sql`
        DELETE FROM tournament_communities WHERE tournament_external_id = ${data.tournamentExternalId}
      `)
      for (const communityId of data.communityIds) {
        await db.execute(sql`
          INSERT INTO tournament_communities (tournament_external_id, community_id)
          VALUES (${data.tournamentExternalId}, ${communityId})
          ON CONFLICT (tournament_external_id, community_id) DO NOTHING
        `)
      }
      return { ok: true }
    })
  })

// ─── Schedule ↔ community tagging (mirrors tournament_communities) ────────────

// Communities tagged on one registration schedule, with their palette so the
// public page can render the tag in the community's colors.
export const getScheduleCommunities = createServerFn({ method: 'POST' })
  .inputValidator((data: { scheduleId: number }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      try {
        const rows = await db.execute(sql`
          SELECT c.id, c.slug, c.name, c.color_primary, c.color_secondary
          FROM schedule_communities sc
          JOIN communities c ON c.id = sc.community_id
          WHERE sc.schedule_id = ${data.scheduleId}
          ORDER BY c.name ASC
        `)
        return (rows.rows as any[]).map((r) => ({
          id: Number(r.id), slug: r.slug, name: r.name,
          colorPrimary: r.color_primary ?? '#1e3a8a', colorSecondary: r.color_secondary ?? '#ffffff',
        }))
      } catch {
        return []
      }
    })
  })

// Public: all active schedules with their community tags in one call, so the
// registration page can render + filter by community without N extra requests.
export const getActiveSchedulesWithCommunities = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    try {
      const rows = await db.execute(sql`
        SELECT sc.schedule_id, c.id, c.slug, c.name, c.color_primary, c.color_secondary
        FROM schedule_communities sc
        JOIN communities c ON c.id = sc.community_id
        JOIN registration_schedules s ON s.id = sc.schedule_id
        WHERE s.status = 'active'
        ORDER BY c.name ASC
      `)
      const bySchedule: Record<number, any[]> = {}
      for (const r of rows.rows as any[]) {
        (bySchedule[Number(r.schedule_id)] ??= []).push({
          id: Number(r.id), slug: r.slug, name: r.name,
          colorPrimary: r.color_primary ?? '#1e3a8a', colorSecondary: r.color_secondary ?? '#ffffff',
        })
      }
      return bySchedule
    } catch {
      return {}
    }
  })
})

// Replace the full set of communities a schedule is tagged with (admin).
// Idempotent: pass [] to clear. Many-to-many — a schedule can span communities.
export const setScheduleCommunities = createServerFn({ method: 'POST' })
  .inputValidator((data: { scheduleId: number; communityIds: number[] }) => data)
  .handler(async ({ data }) => {
    await requireAdmin()
    return withRetry(async () => {
      await db.execute(sql`DELETE FROM schedule_communities WHERE schedule_id = ${data.scheduleId}`)
      for (const communityId of data.communityIds) {
        await db.execute(sql`
          INSERT INTO schedule_communities (schedule_id, community_id)
          VALUES (${data.scheduleId}, ${communityId})
          ON CONFLICT (schedule_id, community_id) DO NOTHING
        `)
      }
      return { ok: true }
    })
  })
