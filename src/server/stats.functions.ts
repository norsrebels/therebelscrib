import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestIP } from '@tanstack/react-start/server'
import { db } from '../../db/index.js'
import { players, playerStats, statUsers, auditLog, tournaments } from '../../db/schema.js'
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import crypto from 'crypto'
import type { StatField } from '@/lib/stats/formulas'

// ─── Password hashing (scrypt) ─────────────────────────────────

function hashPw(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPw(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
}

function getJwtSecret(): string {
  const secret = process.env.STAT_JWT_SECRET
  if (!secret) throw new Error('STAT_JWT_SECRET is not configured')
  return secret
}

function signJwt(payload: { id: string; username: string; role: string }, expiresInSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec })).toString('base64url')
  const secret = getJwtSecret()
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verifyJwt(token: string): { id: string; username: string; role: string } | null {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const secret = getJwtSecret()
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return { id: payload.id, username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

function getStatUserFromCookie(): { id: string; username: string; role: string } | null {
  const token = getCookie('stat_access')
  if (!token) return null
  return verifyJwt(token)
}

function getClientIp(): string | null {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? null
  } catch {
    return null
  }
}

async function insertAudit(data: {
  statUserId?: string | null
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
    statUserId: data.statUserId ?? null,
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
  })
}

// ─── Password validation ────────────────────────────────────────

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/

// ─── Hardcoded fallback account ─────────────────────────────────

const HARDCODED_ACCOUNT = {
  username: process.env.STAT_FALLBACK_USERNAME || 'stats@rebels.com',
  password: process.env.STAT_FALLBACK_PASSWORD || '',
  role: 'statistician' as const,
}

// ─── Auth Server Functions ──────────────────────────────────────

export const loginStatUser = createServerFn({ method: 'POST' })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const ip = getClientIp()
    return withRetry(async () => {
      // Hardcoded fallback account — auto-provisions in DB on first use.
      // Disabled unless STAT_FALLBACK_PASSWORD is configured.
      if (HARDCODED_ACCOUNT.password && data.username === HARDCODED_ACCOUNT.username && data.password === HARDCODED_ACCOUNT.password) {
        let [user] = await db.select().from(statUsers).where(eq(statUsers.username, HARDCODED_ACCOUNT.username)).limit(1)
        if (!user) {
          const [created] = await db.insert(statUsers).values({
            username: HARDCODED_ACCOUNT.username,
            passwordHash: hashPw(HARDCODED_ACCOUNT.password),
            role: HARDCODED_ACCOUNT.role,
            mustChangePassword: false,
            isActive: true,
            failedLoginCount: 0,
          }).returning()
          user = created
        }

        if (!user.isActive) throw new Error('Account disabled')

        await db.update(statUsers).set({
          failedLoginCount: 0,
          lockoutUntil: null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(statUsers.id, user.id))

        const accessToken = signJwt({ id: user.id, username: user.username, role: user.role }, 15 * 60)
        const refreshToken = signJwt({ id: user.id, username: user.username, role: user.role }, 7 * 24 * 60 * 60)

        await insertAudit({
          statUserId: user.id,
          username: user.username,
          userRole: user.role,
          action: 'LOGIN',
          ipAddress: ip,
        })

        return {
          user: { id: user.id, username: user.username, role: user.role, mustChangePassword: false },
          accessToken,
          refreshToken,
        }
      }

      const [user] = await db.select().from(statUsers).where(eq(statUsers.username, data.username)).limit(1)
      if (!user) throw new Error('Invalid credentials')
      if (!user.isActive) throw new Error('Account disabled')

      if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        const remaining = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000)
        throw new Error(`Account locked. Try again in ${remaining} minutes.`)
      }

      if (!verifyPw(data.password, user.passwordHash)) {
        const newCount = user.failedLoginCount + 1
        const updates: any = { failedLoginCount: newCount, updatedAt: new Date() }
        if (newCount >= 5) {
          updates.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000)
          await insertAudit({
            statUserId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'ACCOUNT_LOCK',
            ipAddress: ip,
          })
        }
        await db.update(statUsers).set(updates).where(eq(statUsers.id, user.id))
        throw new Error('Invalid credentials')
      }

      await db.update(statUsers).set({
        failedLoginCount: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(statUsers.id, user.id))

      const accessToken = signJwt({ id: user.id, username: user.username, role: user.role }, 15 * 60)
      const refreshToken = signJwt({ id: user.id, username: user.username, role: user.role }, 7 * 24 * 60 * 60)

      await insertAudit({
        statUserId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'LOGIN',
        ipAddress: ip,
      })

      return {
        user: { id: user.id, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword },
        accessToken,
        refreshToken,
      }
    })
  })

export const logoutStatUser = createServerFn({ method: 'POST' })
  .handler(async () => {
    const statUser = getStatUserFromCookie()
    if (statUser) {
      await withRetry(() =>
        insertAudit({
          statUserId: statUser.id,
          username: statUser.username,
          userRole: statUser.role,
          action: 'LOGOUT',
        })
      )
    }
    return { ok: true }
  })

export const changePassword = createServerFn({ method: 'POST' })
  .inputValidator((data: { current: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const statUser = getStatUserFromCookie()
    if (!statUser) throw new Error('Not authenticated')

    if (!PASSWORD_REGEX.test(data.newPassword)) {
      throw new Error('Password must be 8+ chars with uppercase, digit, and special character (!@#$%^&*)')
    }

    const ip = getClientIp()
    return withRetry(async () => {
      const [user] = await db.select().from(statUsers).where(eq(statUsers.id, statUser.id))
      if (!user) throw new Error('User not found')
      if (!verifyPw(data.current, user.passwordHash)) throw new Error('Current password incorrect')

      await db.update(statUsers).set({
        passwordHash: hashPw(data.newPassword),
        mustChangePassword: false,
        updatedAt: new Date(),
      }).where(eq(statUsers.id, user.id))

      await insertAudit({
        statUserId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'PASSWORD_RESET',
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

export const createStatUser = createServerFn({ method: 'POST' })
  .inputValidator((data: { username: string; tempPassword: string; role: string }) => data)
  .handler(async ({ data }) => {
    const statUser = getStatUserFromCookie()
    if (!statUser || statUser.role !== 'admin') throw new Error('Admin access required')

    const ip = getClientIp()
    return withRetry(async () => {
      const [newUser] = await db.insert(statUsers).values({
        username: data.username,
        passwordHash: hashPw(data.tempPassword),
        role: data.role,
        mustChangePassword: true,
        createdBy: statUser.id,
      }).returning()

      await insertAudit({
        statUserId: statUser.id,
        username: statUser.username,
        userRole: statUser.role,
        action: 'USER_CREATE',
        entityType: 'stat_user',
        entityId: newUser.id,
        ipAddress: ip,
      })

      return { id: newUser.id, username: newUser.username, role: newUser.role }
    })
  })

export const resetStatUserPassword = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; tempPassword: string }) => data)
  .handler(async ({ data }) => {
    const statUser = getStatUserFromCookie()
    if (!statUser || statUser.role !== 'admin') throw new Error('Admin access required')

    const ip = getClientIp()
    return withRetry(async () => {
      await db.update(statUsers).set({
        passwordHash: hashPw(data.tempPassword),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockoutUntil: null,
        updatedAt: new Date(),
      }).where(eq(statUsers.id, data.userId))

      await insertAudit({
        statUserId: statUser.id,
        username: statUser.username,
        userRole: statUser.role,
        action: 'PASSWORD_RESET',
        entityType: 'stat_user',
        entityId: data.userId,
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

export const listStatUsers = createServerFn({ method: 'GET' })
  .handler(async () => {
    const statUser = getStatUserFromCookie()
    if (!statUser || statUser.role !== 'admin') throw new Error('Admin access required')

    return withRetry(async () => {
      return db.select({
        id: statUsers.id,
        username: statUsers.username,
        role: statUsers.role,
        isActive: statUsers.isActive,
        mustChangePassword: statUsers.mustChangePassword,
        lastLoginAt: statUsers.lastLoginAt,
        lockoutUntil: statUsers.lockoutUntil,
        failedLoginCount: statUsers.failedLoginCount,
        createdAt: statUsers.createdAt,
      }).from(statUsers).orderBy(desc(statUsers.createdAt))
    })
  })

export const toggleStatUserActive = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const statUser = getStatUserFromCookie()
    if (!statUser || statUser.role !== 'admin') throw new Error('Admin access required')
    if (statUser.id === data.userId) throw new Error('Cannot modify your own account')

    const ip = getClientIp()
    return withRetry(async () => {
      await db.update(statUsers).set({
        isActive: data.isActive,
        updatedAt: new Date(),
      }).where(eq(statUsers.id, data.userId))

      await insertAudit({
        statUserId: statUser.id,
        username: statUser.username,
        userRole: statUser.role,
        action: 'USER_UPDATE',
        entityType: 'stat_user',
        entityId: data.userId,
        fieldName: 'is_active',
        oldValue: String(!data.isActive),
        newValue: String(data.isActive),
        ipAddress: ip,
      })

      return { ok: true }
    })
  })

// ─── Stat CRUD ──────────────────────────────────────────────────

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
    const statUser = getStatUserFromCookie()
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
        },
      }).returning()

      const newVal = String((row as any)[fieldKey] ?? 0)

      await insertAudit({
        statUserId: statUser?.id ?? null,
        username: statUser?.username ?? 'anonymous',
        userRole: statUser?.role ?? 'viewer',
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
    const statUser = getStatUserFromCookie()
    const ip = getClientIp()

    return withRetry(async () => {
      const fieldKeys: StatField[] = [
        'attackKill', 'attackError', 'attackAttempt',
        'serveAce', 'serveError', 'serveAttempt',
        'receptionPerfect', 'receptionGood', 'receptionOk', 'receptionError',
        'setAssist', 'setAttempt', 'setBallHandlingError',
        'blockSolo', 'blockAssist', 'blockError', 'blockRebound',
        'dig', 'digError', 'digAttempt',
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
        set: { ...values, updatedAt: new Date() },
      })

      // Distinct action so undoLastStat (which targets STAT_CREATE/STAT_UPDATE) ignores
      // bulk re-syncs and keeps undoing the individual taps.
      await insertAudit({
        statUserId: statUser?.id ?? null,
        username: statUser?.username ?? 'anonymous',
        userRole: statUser?.role ?? 'viewer',
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
    const statUser = getStatUserFromCookie()
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
        statUserId: statUser?.id ?? null,
        username: statUser?.username ?? 'anonymous',
        userRole: statUser?.role ?? 'viewer',
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
    const statUser = getStatUserFromCookie()
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
        statUserId: statUser?.id ?? null,
        username: statUser?.username ?? 'admin',
        userRole: statUser?.role ?? 'admin',
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
    const statUser = getStatUserFromCookie()
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
        statUserId: statUser?.id ?? null,
        username: statUser?.username ?? 'admin',
        userRole: statUser?.role ?? 'admin',
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
    const statUser = getStatUserFromCookie()
    if (!statUser || statUser.role !== 'admin') throw new Error('Admin access required')

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
      const schedules = await db.select({
        id: tournaments.externalId,
        name: tournaments.name,
      }).from(tournaments)
        .where(eq(tournaments.archived, false))
        .orderBy(tournaments.createdAt)

      let stats: any[]
      if (data.tournamentId) {
        const matchRows = await db.selectDistinct({ matchId: playerStats.matchId })
          .from(playerStats)
          .where(eq(playerStats.teamId, data.tournamentId))
        const matchIds = matchRows.map(r => r.matchId)

        if (matchIds.length > 0) {
          stats = await db.select().from(playerStats)
            .where(inArray(playerStats.matchId, matchIds))
        } else {
          stats = []
        }
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

// ─── Get current stat user from token ───────────────────────────

export const getCurrentStatUser = createServerFn({ method: 'GET' })
  .handler(async () => {
    const statUser = getStatUserFromCookie()
    if (!statUser) return null
    return withRetry(async () => {
      const [user] = await db.select({
        id: statUsers.id,
        username: statUsers.username,
        role: statUsers.role,
        isActive: statUsers.isActive,
        mustChangePassword: statUsers.mustChangePassword,
      }).from(statUsers).where(eq(statUsers.id, statUser.id))
      return user ?? null
    })
  })
