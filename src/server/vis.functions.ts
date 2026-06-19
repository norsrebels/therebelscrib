import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { visMatches, visMatchPlayers, visSetStats, players, playerStats } from '../../db/schema.js'
import { eq, and, desc, sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'

// ─── Match CRUD ───────────────────────────────────────────────

export const listMatches = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    const rows = await db
      .select({
        id: visMatches.id,
        matchDate: visMatches.matchDate,
        teamName: visMatches.teamName,
        opponentName: visMatches.opponentName,
        location: visMatches.location,
        totalSets: visMatches.totalSets,
        tournamentId: visMatches.tournamentId,
        tournamentMatchId: visMatches.tournamentMatchId,
        createdAt: visMatches.createdAt,
      })
      .from(visMatches)
      .orderBy(desc(visMatches.createdAt))
    return rows
  })
})

// Look up a VIS match by its tournament match ID (to avoid duplicates)
export const findMatchByTournamentMatchId = createServerFn({ method: 'POST' })
  .inputValidator((data: { tournamentId: string; tournamentMatchId: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const rows = await db
        .select({
          id: visMatches.id,
          matchDate: visMatches.matchDate,
          teamName: visMatches.teamName,
          opponentName: visMatches.opponentName,
          location: visMatches.location,
          totalSets: visMatches.totalSets,
          tournamentId: visMatches.tournamentId,
          tournamentMatchId: visMatches.tournamentMatchId,
        })
        .from(visMatches)
        .where(
          and(
            eq(visMatches.tournamentId, data.tournamentId),
            eq(visMatches.tournamentMatchId, data.tournamentMatchId),
          )
        )
        .limit(1)
      return rows[0] ?? null
    })
  })

export const createMatch = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    matchDate: string
    teamName: string
    opponentName: string
    location: string
    totalSets: number
    players: { jerseyNumber: number; playerName: string }[]
    tournamentId?: string
    tournamentMatchId?: string
  }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const [match] = await db.insert(visMatches).values({
        matchDate: data.matchDate,
        teamName: data.teamName,
        opponentName: data.opponentName,
        location: data.location,
        passwordHash: '',
        totalSets: data.totalSets,
        tournamentId: data.tournamentId ?? null,
        tournamentMatchId: data.tournamentMatchId ?? null,
      }).returning()

      if (data.players.length > 0) {
        await db.insert(visMatchPlayers).values(
          data.players.map(p => ({
            matchId: match.id,
            jerseyNumber: p.jerseyNumber,
            playerName: p.playerName,
          }))
        )
      }
      return { id: match.id }
    })
  })

export const deleteMatch = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: number }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const [match] = await db.select({ id: visMatches.id })
        .from(visMatches).where(eq(visMatches.id, data.matchId))
      if (!match) throw new Error('Match not found')
      await db.delete(visMatches).where(eq(visMatches.id, data.matchId))
      return { ok: true }
    })
  })

// ─── Player management within a match ────────────────────────

export const getMatchData = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: number }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const [match] = await db.select().from(visMatches).where(eq(visMatches.id, data.matchId))
      if (!match) throw new Error('Match not found')

      const players = await db.select().from(visMatchPlayers)
        .where(eq(visMatchPlayers.matchId, data.matchId))
        .orderBy(visMatchPlayers.jerseyNumber)

      const stats = await db.select().from(visSetStats)
        .where(eq(visSetStats.matchId, data.matchId))

      return { match, players, stats }
    })
  })

export const addPlayerToMatch = createServerFn({ method: 'POST' })
  .inputValidator((data: { matchId: number; jerseyNumber: number; playerName: string }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const [match] = await db.select({ id: visMatches.id })
        .from(visMatches).where(eq(visMatches.id, data.matchId))
      if (!match) throw new Error('Match not found')
      const [player] = await db.insert(visMatchPlayers).values({
        matchId: data.matchId,
        jerseyNumber: data.jerseyNumber,
        playerName: data.playerName,
      }).returning()
      return player
    })
  })

export const removePlayerFromMatch = createServerFn({ method: 'POST' })
  .inputValidator((data: { playerId: number; matchId: number }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const [match] = await db.select({ id: visMatches.id })
        .from(visMatches).where(eq(visMatches.id, data.matchId))
      if (!match) throw new Error('Match not found')
      await db.delete(visMatchPlayers).where(eq(visMatchPlayers.id, data.playerId))
      return { ok: true }
    })
  })

// ─── Stats saving ─────────────────────────────────────────────

export const saveSetStats = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    matchId: number
    playerId: number
    setNumber: number
    stats: {
      spikeKill: number; spikeError: number; spikeAttempt: number
      blockKill: number; blockError: number; blockRebound: number
      serveAce: number; serveError: number; serveAttempt: number
      digExcellent: number; digFault: number; digAttempt: number
      setExcellent: number; setFault: number; setAttempt: number
      receiveExcellent: number; receiveError: number; receiveAttempt: number
    }
  }) => data)
  .handler(async ({ data }) => {
    return withRetry(async () => {
      const [match] = await db.select({
        id: visMatches.id,
        tournamentMatchId: visMatches.tournamentMatchId,
      }).from(visMatches).where(eq(visMatches.id, data.matchId))
      if (!match) throw new Error('Match not found')

      // Resolve the roster entry to a global players.id. player_stats is the single source
      // of truth and references players.id, so an unlinked roster entry must be linked first.
      const [rosterPlayer] = await db.select().from(visMatchPlayers)
        .where(eq(visMatchPlayers.id, data.playerId))
      if (!rosterPlayer) throw new Error('Player not found')

      let globalPlayerId = rosterPlayer.globalPlayerId
      if (!globalPlayerId) {
        const name = rosterPlayer.playerName.trim()
        const [existingPlayer] = await db.select({ id: players.id }).from(players)
          .where(sql`lower(${players.nickname}) = lower(${name})`)
          .limit(1)
        if (existingPlayer) {
          globalPlayerId = existingPlayer.id
        } else {
          const [createdPlayer] = await db.insert(players).values({
            nickname: name,
            jerseyNumber: rosterPlayer.jerseyNumber ?? null,
          }).returning({ id: players.id })
          globalPlayerId = createdPlayer.id
        }
        await db.update(visMatchPlayers)
          .set({ globalPlayerId })
          .where(eq(visMatchPlayers.id, data.playerId))
      }

      // Tournament match ID string is the canonical match_id; fall back to the VIS match id.
      const matchIdStr = match.tournamentMatchId ?? String(match.id)

      // Map the VIS set-stat fields onto the unified player_stats columns.
      const mapped = {
        attackKill: data.stats.spikeKill,
        attackError: data.stats.spikeError,
        attackAttempt: data.stats.spikeAttempt,
        blockSolo: data.stats.blockKill,
        blockError: data.stats.blockError,
        blockRebound: data.stats.blockRebound,
        serveAce: data.stats.serveAce,
        serveError: data.stats.serveError,
        serveAttempt: data.stats.serveAttempt,
        dig: data.stats.digExcellent,
        digError: data.stats.digFault,
        digAttempt: data.stats.digAttempt,
        setAssist: data.stats.setExcellent,
        setBallHandlingError: data.stats.setFault,
        setAttempt: data.stats.setAttempt,
        receptionPerfect: data.stats.receiveExcellent,
        receptionError: data.stats.receiveError,
        receiveAttempt: data.stats.receiveAttempt,
      }

      await db.insert(playerStats).values({
        matchId: matchIdStr,
        playerId: globalPlayerId,
        teamId: 'vis-hub',
        setNumber: data.setNumber,
        ...mapped,
      }).onConflictDoUpdate({
        target: [playerStats.matchId, playerStats.playerId, playerStats.setNumber],
        set: { ...mapped, updatedAt: new Date() },
      })
      return { ok: true }
    })
  })

// ─── Dashboard / leaderboard ──────────────────────────────────

export const getLeaderboard = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    const allStats = await db
      .select({
        playerName: players.nickname,
        jerseyNumber: players.jerseyNumber,
        spikeKill: playerStats.attackKill,
        spikeError: playerStats.attackError,
        spikeAttempt: playerStats.attackAttempt,
        blockKill: playerStats.blockSolo,
        serveAce: playerStats.serveAce,
        serveError: playerStats.serveError,
        serveAttempt: playerStats.serveAttempt,
        digExcellent: playerStats.dig,
        digAttempt: playerStats.digAttempt,
        setExcellent: playerStats.setAssist,
        setAttempt: playerStats.setAttempt,
        receiveExcellent: playerStats.receptionPerfect,
        receiveError: playerStats.receptionError,
        receiveAttempt: playerStats.receiveAttempt,
        matchId: playerStats.matchId,
        setNumber: playerStats.setNumber,
      })
      .from(playerStats)
      .innerJoin(players, eq(playerStats.playerId, players.id))

    // Aggregate by player name
    const agg: Record<string, any> = {}
    let totalSets = 0
    const setKeys = new Set<string>()

    for (const row of allStats) {
      const key = row.playerName
      const setKey = `${row.matchId}-${row.setNumber}`
      setKeys.add(setKey)
      if (!agg[key]) {
        agg[key] = {
          playerName: row.playerName,
          jerseyNumber: row.jerseyNumber,
          spikeKill: 0, spikeError: 0, spikeAttempt: 0,
          blockKill: 0, serveAce: 0, serveError: 0, serveAttempt: 0,
          digExcellent: 0, digAttempt: 0,
          setExcellent: 0, setAttempt: 0,
          receiveExcellent: 0, receiveError: 0, receiveAttempt: 0,
          sets: 0,
        }
      }
      const a = agg[key]
      a.spikeKill += row.spikeKill
      a.spikeError += row.spikeError
      a.spikeAttempt += row.spikeAttempt
      a.blockKill += row.blockKill
      a.serveAce += row.serveAce
      a.serveError += row.serveError
      a.serveAttempt += row.serveAttempt
      a.digExcellent += row.digExcellent
      a.digAttempt += row.digAttempt
      a.setExcellent += row.setExcellent
      a.setAttempt += row.setAttempt
      a.receiveExcellent += row.receiveExcellent
      a.receiveError += row.receiveError
      a.receiveAttempt += row.receiveAttempt
      a.sets += 1
    }

    totalSets = setKeys.size || 1

    return Object.values(agg).map((a: any) => ({
      ...a,
      totalPoints: a.spikeKill + a.blockKill + a.serveAce,
      spikeEff: a.spikeAttempt > 0
        ? ((a.spikeKill - a.spikeError) / (a.spikeAttempt + a.spikeKill + a.spikeError) * 100).toFixed(1)
        : '—',
      receiveEff: (a.receiveExcellent + a.receiveError + a.receiveAttempt) > 0
        ? ((a.receiveExcellent - a.receiveError) / (a.receiveExcellent + a.receiveError + a.receiveAttempt) * 100).toFixed(1)
        : '—',
      blocksPerSet: a.sets > 0 ? (a.blockKill / a.sets).toFixed(2) : '0.00',
      acesPerSet: a.sets > 0 ? (a.serveAce / a.sets).toFixed(2) : '0.00',
      digsPerSet: a.sets > 0 ? (a.digExcellent / a.sets).toFixed(2) : '0.00',
      setsPerSet: a.sets > 0 ? (a.setExcellent / a.sets).toFixed(2) : '0.00',
    }))
  })
})
