import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { db } from '../../db/index.js'
import { players, playerStats, auditLog, tournaments } from '../../db/schema.js'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import type { StatField } from '@/lib/stats/formulas'
import { getStatIdentity } from '@/lib/auth-server'

// ─── Helpers ────────────────────────────────────────────────────

function getClientIp(): string | null {
  try { return getRequestIP() ?? null } catch { return null }
}

async function insertAudit(data: {
  netlifyUserId?: string | null
  netlifyEmail?: string | null
  username: string
  userRole: string
  action: string
  entityType?: string | null
  entityId?: string | null
  matchId?: string | null
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
  ipAddress?: string | null
}) {
  await db.insert(auditLog).values({
    statUserId: null,
    username: data.username,
    userRole: data.userRole,
    action: data.action,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    matchId: data.matchId ?? null,
    fieldName: data.fieldName ?? null,
    oldValue: data.oldValue ?? null,
    newValue: data.newValue ?? null,
    ipAddress: data.ipAddress ?? null,
  }).catch(() => { /* audit failure should not block stat entry */ })
}

export const getPlayerStats = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string; teamId?: string; setNumber?: number }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const conditions = [eq(playerStats.matchId, data.matchId)]
      if (data.teamId) conditions.push(eq(playerStats.teamId, data.teamId))
      if (data.setNumber !== undefined) conditions.push(eq(playerStats.setNumber, data.setNumber))

      return db.select().from(playerStats).where(and(...conditions))
    })
  })

// Resolve a tournament player to a global players.id, creating the row if needed.
export const resolveOrCreatePlayer = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; jerseyNumber: number | null }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const name = data.name.trim()
      const [existing] = await db.select({ id: players.id }).from(players)
        .where(sql`lower(${players.nickname}) = lower(${name})`)
        .limit(1)
      if (existing) return { id: existing.id }

      const [created] = await db.insert(players).values({
        nickname: name,
        jerseyNumber: data.jerseyNumber ?? null,
      }).returning({ id: players.id })
      return { id: created.id }
    })
  })

export const upsertPlayerStat = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    matchId: string; playerId: number; teamId: string; setNumber: number
    field: string; delta: number
  }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    const ip = getClientIp()

    return withRetry(async () => {
      const fieldKey = data.field as StatField
      const colMap: Record<string, any> = {
        attackKill: playerStats.attackKill,
        attackError: playerStats.attackError,
        attackAttempt: playerStats.attackAttempt,
        serveAce: playerStats.serveAce,
        serveError: playerStats.serveError,
        serveAttempt: playerStats.serveAttempt,
        receptionPerfect: playerStats.receptionPerfect,
        receptionGood: playerStats.receptionGood,
        receptionOk: playerStats.receptionOk,
        receptionError: playerStats.receptionError,
        setAssist: playerStats.setAssist,
        setAttempt: playerStats.setAttempt,
        setBallHandlingError: playerStats.setBallHandlingError,
        blockSolo: playerStats.blockSolo,
        blockAssist: playerStats.blockAssist,
        blockError: playerStats.blockError,
        blockRebound: playerStats.blockRebound,
        dig: playerStats.dig,
        digError: playerStats.digError,
        digAttempt: playerStats.digAttempt,
        freeballDig: playerStats.freeballDig,
        freeballError: playerStats.freeballError,
      }

      const col = colMap[fieldKey]
      if (!col) throw new Error(`Invalid stat field: ${data.field}`)

      // Read the current value first so the audit entry (and therefore undo) has an
      // accurate before-value. The actual write below is atomic at the DB level.
      const existing = await db.select().from(playerStats).where(
        and(
          eq(playerStats.matchId, data.matchId),
          eq(playerStats.playerId, data.playerId),
          eq(playerStats.setNumber, data.setNumber),
        )
      ).limit(1)

      const action = existing.length > 0 ? 'STAT_UPDATE' : 'STAT_CREATE'
      const oldVal = existing.length > 0 ? String((existing[0] as any)[fieldKey] ?? 0) : '0'

      // Atomic upsert: the unique (match_id, player_id, set_number) constraint guarantees a
      // single row, and the increment is computed in-DB so concurrent taps cannot race.
      const [row] = await db.insert(playerStats).values({
        matchId: data.matchId,
        playerId: data.playerId,
        teamId: data.teamId,
        setNumber: data.setNumber,
        [fieldKey]: Math.max(0, data.delta),
      }).onConflictDoUpdate({
        target: [playerStats.matchId, playerStats.playerId, playerStats.setNumber],
        set: {
          [fieldKey]: sql`GREATEST(0, ${col} + ${data.delta})`,
          updatedAt: new Date(),
          // Self-heal the tournament tag. player_stats.team_id holds the tournament
          // (schedule) id a row belongs to. A row created with a wrong/legacy tag —
          // e.g. an offline tap before the client fix, stamped with a within-match
          // team id — gets normalized to the canonical tournament id on the next
          // write. 'vis-hub' rows belong to the VIS Match Stats system, not a
          // tournament, so they are never overwritten.
          teamId: sql`CASE WHEN ${playerStats.teamId} = 'vis-hub' THEN ${playerStats.teamId} ELSE ${data.teamId} END`,
        },
      }).returning()

      const newVal = String((row as any)[fieldKey] ?? 0)

      await insertAudit({
        username: identity?.email ?? 'anonymous',
        userRole: identity?.role ?? 'viewer',
        action,
        entityType: 'player_stat',
        entityId: row.id,
        matchId: data.matchId,
        fieldName: data.field,
        oldValue: oldVal,
        newValue: newVal,
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

// Write an entire stat row using ABSOLUTE values (not deltas). Used by "Save All", which
// re-syncs the optimistic UI to the DB. The per-tap path (upsertPlayerStat) increments, so
// re-pushing already-saved totals through it would double them — this overwrites instead.
export const savePlayerStatRow = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    matchId: string; playerId: number; teamId: string; setNumber: number
    row: Record<string, number>
  }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    const ip = getClientIp()

    return withRetry(async () => {
      const fieldKeys: StatField[] = [
        'attackKill', 'attackError', 'attackAttempt',
        'serveAce', 'serveError', 'serveAttempt',
        'receptionPerfect', 'receptionGood', 'receptionOk', 'receptionError',
        'setAssist', 'setAttempt', 'setBallHandlingError',
        'blockSolo', 'blockAssist', 'blockError', 'blockRebound',
        'dig', 'digError', 'digAttempt',
        'freeballDig', 'freeballError',
      ]

      const values: Record<string, number> = {}
      for (const key of fieldKeys) {
        values[key] = Math.max(0, Math.round(data.row[key] ?? 0))
      }

      await db.insert(playerStats).values({
        matchId: data.matchId,
        playerId: data.playerId,
        teamId: data.teamId,
        setNumber: data.setNumber,
        ...values,
      }).onConflictDoUpdate({
        target: [playerStats.matchId, playerStats.playerId, playerStats.setNumber],
        set: {
          ...values,
          updatedAt: new Date(),
          // Same self-heal as upsertPlayerStat: normalize a stale team_id to the
          // tournament id, but never overwrite a 'vis-hub' row.
          teamId: sql`CASE WHEN ${playerStats.teamId} = 'vis-hub' THEN ${playerStats.teamId} ELSE ${data.teamId} END`,
        },
      })

      // Distinct action so undoLastStat (which targets STAT_CREATE/STAT_UPDATE) ignores
      // bulk re-syncs and keeps undoing the individual taps.
      await insertAudit({
        username: identity?.email ?? 'anonymous',
        userRole: identity?.role ?? 'viewer',
        action: 'STAT_SAVE_ALL',
        entityType: 'player_stat',
        matchId: data.matchId,
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

export const undoLastStat = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    const ip = getClientIp()

    return withRetry(async () => {
      const [lastEntry] = await db.select().from(auditLog)
        .where(
          and(
            eq(auditLog.matchId, data.matchId),
            eq(auditLog.entityType, 'player_stat'),
            sql`${auditLog.action} IN ('STAT_CREATE', 'STAT_UPDATE')`,
          )
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(1)

      if (!lastEntry || !lastEntry.entityId || !lastEntry.fieldName) {
        throw new Error('Nothing to undo')
      }

      const [stat] = await db.select().from(playerStats).where(eq(playerStats.id, lastEntry.entityId))
      if (!stat) throw new Error('Stat record not found')

      const fieldKey = lastEntry.fieldName as StatField
      const oldVal = lastEntry.oldValue ?? '0'

      await db.update(playerStats).set({
        [fieldKey]: Number(oldVal),
        updatedAt: new Date(),
      }).where(eq(playerStats.id, lastEntry.entityId))

      await insertAudit({
        username: identity?.email ?? 'anonymous',
        userRole: identity?.role ?? 'viewer',
        action: 'STAT_UNDO',
        entityType: 'player_stat',
        entityId: lastEntry.entityId,
        matchId: data.matchId,
        fieldName: lastEntry.fieldName,
        oldValue: lastEntry.newValue,
        newValue: oldVal,
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

// ─── Roster ─────────────────────────────────────────────────────

export const updatePlayerJersey = createServerFn({ method: 'POST' })
  .inputValidator((data: { playerId: number; jerseyNumber: number | null }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    const ip = getClientIp()

    return withRetry(async () => {
      const [player] = await db.select().from(players).where(eq(players.id, data.playerId))
      if (!player) throw new Error('Player not found')

      const oldVal = String(player.jerseyNumber ?? '')

      await db.update(players).set({
        jerseyNumber: data.jerseyNumber,
        updatedAt: new Date(),
      }).where(eq(players.id, data.playerId))

      await insertAudit({
        netlifyUserId: identity?.userId ?? null,
        netlifyEmail: identity?.email ?? null,
        username: identity?.email ?? "unknown",
        userRole: identity?.role ?? "viewer",
        action: 'ROSTER_UPDATE',
        entityType: 'player',
        entityId: String(data.playerId),
        fieldName: 'jersey_number',
        oldValue: oldVal,
        newValue: String(data.jerseyNumber ?? ''),
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

export const importPlayers = createServerFn({ method: 'POST' })
  .inputValidator((data: { teamId: string; rows: { jerseyNumber: number; name: string; position: string }[] }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    const ip = getClientIp()

    return withRetry(async () => {
      const results: { name: string; action: string }[] = []

      for (const row of data.rows) {
        if (!row.name?.trim()) continue

        const [existing] = await db.select().from(players)
          .where(eq(players.nickname, row.name.trim()))
          .limit(1)

        if (existing) {
          await db.update(players).set({
            jerseyNumber: row.jerseyNumber || null,
            position: row.position || existing.position,
            updatedAt: new Date(),
          }).where(eq(players.id, existing.id))
          results.push({ name: row.name, action: 'updated' })
        } else {
          await db.insert(players).values({
            nickname: row.name.trim(),
            jerseyNumber: row.jerseyNumber || null,
            position: row.position || '',
          })
          results.push({ name: row.name, action: 'created' })
        }
      }

      await insertAudit({
        netlifyUserId: identity?.userId ?? null,
        netlifyEmail: identity?.email ?? null,
        username: identity?.email ?? "unknown",
        userRole: identity?.role ?? "viewer",
        action: 'ROSTER_UPDATE',
        entityType: 'import',
        newValue: JSON.stringify({ count: results.length, teamId: data.teamId }),
        ipAddress: ip,
      })

      return { results }
    })
  })

// ─── Audit Log ──────────────────────────────────────────────────

export const getAuditLog = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    matchId?: string; userId?: string; action?: string
    from?: string; to?: string; page?: number; pageSize?: number
  }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    if (!identity || identity.role !== 'admin') throw new Error('Admin access required')

    return withRetry(async () => {
      const page = data.page ?? 1
      const pageSize = data.pageSize ?? 50
      const offset = (page - 1) * pageSize
      const conditions: any[] = []

      if (data.matchId) conditions.push(eq(auditLog.matchId, data.matchId))
      if (data.userId) conditions.push(eq(auditLog.statUserId, data.userId))
      if (data.action) conditions.push(eq(auditLog.action, data.action))
      if (data.from) conditions.push(gte(auditLog.createdAt, new Date(data.from)))
      if (data.to) conditions.push(lte(auditLog.createdAt, new Date(data.to)))

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const rows = await db.select().from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset(offset)

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(auditLog)
        .where(where)

      return { rows, total: Number(countResult.count), page, pageSize }
    })
  })

// ─── All player stats (for leaderboard) ─────────────────────────

export const getAllPlayerStats = createServerFn({ method: 'GET' })
  .inputValidator((data: { tournamentId?: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      // Build the schedule list from the team_ids actually present on stats,
      // joined to tournament names. This guarantees each option's id is exactly
      // what the filter keys on (player_stats.team_id), so selecting a schedule
      // always matches. The inner join also drops 'vis-hub' and any orphaned tag
      // that doesn't map to a real tournament, and shows only schedules with stats.
      const schedules = await db
        .selectDistinct({ id: playerStats.teamId, name: tournaments.name })
        .from(playerStats)
        .innerJoin(tournaments, eq(tournaments.externalId, playerStats.teamId))
        .where(eq(tournaments.archived, false))
        .orderBy(tournaments.name)

      let stats: any[]
      if (data.tournamentId) {
        // Filter directly by teamId (= tournament externalId). This is the correct
        // single-step approach now that stale team_id rows have been retagged.
        // The previous two-step matchId-based approach could cross-contaminate stats
        // from different tournaments that share the same internal game id (e.g. "pool-A-1").
        stats = await db.select().from(playerStats)
          .where(eq(playerStats.teamId, data.tournamentId))
      } else {
        stats = await db.select().from(playerStats)
      }

      const allPlayers = await db.select({
        id: players.id,
        nickname: players.nickname,
        jerseyNumber: players.jerseyNumber,
        position: players.position,
      }).from(players)

      return { stats, players: allPlayers, schedules }
    })
  })

// getCurrentStatUser removed — use Netlify Identity getUser() directly


// ─── Match Finalization ──────────────────────────────────────────────────────

export const finalizeMatch = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string; notes?: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    if (!identity || identity.role !== 'admin') throw new Error('Admin access required')
    const ip = getClientIp()
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO match_locks (match_id, locked_by, notes)
        VALUES (${data.matchId}, ${identity.email}, ${data.notes ?? null})
        ON CONFLICT (match_id) DO UPDATE SET
          locked_by = ${identity.email},
          locked_at = now(),
          notes = ${data.notes ?? null}
      `)
      await insertAudit({
        username: identity.email,
        userRole: identity.role,
        action: 'MATCH_FINALIZE',
        matchId: data.matchId,
        newValue: data.notes ?? null,
        ipAddress: ip,
      })
      return { ok: true }
    })
  })

export const unlockMatch = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    if (!identity || identity.role !== 'admin') throw new Error('Admin access required')
    const ip = getClientIp()
    return withRetry(async () => {
      await db.execute(sql`DELETE FROM match_locks WHERE match_id = ${data.matchId}`)
      await insertAudit({
        username: identity.email,
        userRole: identity.role,
        action: 'MATCH_UNLOCK',
        matchId: data.matchId,
        ipAddress: ip,
      })
      return { ok: true }
    })
  })

export const getMatchLock = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const result = await db.execute(
        sql`SELECT match_id, locked_by, locked_at, notes FROM match_locks WHERE match_id = ${data.matchId} LIMIT 1`
      )
      const rows = result.rows as any[]
      if (rows.length === 0) return null
      return {
        matchId: rows[0].match_id,
        lockedBy: rows[0].locked_by,
        lockedAt: rows[0].locked_at,
        notes: rows[0].notes,
      }
    })
  })

export const flagAuditEntry = createServerFn({ method: 'POST' })
  .inputValidator((data: { entryId: string; flagged: boolean; note?: string }) => data)
  .handler(async ({ data }) => {
    const identity = await getStatIdentity()
    if (!identity || identity.role !== 'admin') throw new Error('Admin access required')
    return withRetry(async () => {
      await db.execute(sql`
        UPDATE audit_log SET flagged = ${data.flagged}, flag_note = ${data.note ?? null}
        WHERE id = ${data.entryId}
      `)
      return { ok: true }
    })
  })
