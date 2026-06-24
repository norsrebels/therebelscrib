  // ─── Types ────────────────────────────────────────────────────────────────────

  export type Pool = 'A' | 'B'

  export type PaymentStatus = 'Paid' | 'Partial' | 'Pending'
  export type PlayerPosition = 'OS' | 'OPP' | 'MB' | 'S' | 'L'
  export type SkillLevel = 'Developmental' | 'Formative' | 'Intermediate' | 'Competitive' | 'Advanced'

  export interface Player {
    id: string
    name: string
    position: PlayerPosition | ''
    skillLevel: SkillLevel | ''
    paymentStatus: PaymentStatus
    profilePicture?: string
    jerseyNumber?: number | null
  }

  export interface Team {
    id: string
    name: string
    pool: Pool
    paymentStatus: PaymentStatus
    profilePicture?: string
    players: Player[]
  }

  export interface PoolMatch {
    id: string
    pool: Pool
    round: number
    gameNum: number
    court: string // court number/name
    officiatingTeamId: string | null
    teamAId: string
    teamBId: string
    scoreA: number | null
    scoreB: number | null
    isFinal?: boolean
    serving?: 'A' | 'B' | null
    sets?: { scoreA: number; scoreB: number }[]
    pointLog?: string[]
  }

  export type PlayoffPhase =
    | 'wildcard'
    | 'elimination'
    | 'crossover'
    | 'classification'
    | 'semifinal'
    | '3rd_place'
    | 'championship'
    | 'winners_bracket'
    | 'losers_bracket'
    | 'grand_final'
    | 'true_final'

  // 'auto'  = derive bracket from team counts (all existing formats)
  // 'de'    = double elimination playoffs (any team count, single pool)
  export type FormatType = 'auto' | 'de'

  export interface PlayoffGame {
    slot: string // G21–G30
    phase: PlayoffPhase
    label: string
    court: string
    teamAId: string | null
    teamBId: string | null
    teamALabel: string
    teamBLabel: string
    scoreA: number | null
    scoreB: number | null
    isFinal?: boolean
    serving?: 'A' | 'B' | null
    sets?: { scoreA: number; scoreB: number }[]
    pointLog?: string[]
  }

  export interface Settings {
    scheduleName: string
    venue: string
    date: string
    startTime: string
    endTime: string
    maxScore: number | null
    leadScore: number | null
    facebookUrl?: string
    instagramUrl?: string
    contactUrl?: string
    formatType?: FormatType
    // Double elimination controls
    // useDEBracket: true = DE playoffs active, false/undefined = SE playoffs (default)
    // deBye: which seed number gets the bye in odd-team DE (e.g. 3 = Seed #3 sits out W-R1)
    useDEBracket?: boolean
    deBye?: number
  }

  export interface TournamentState {
    teams: Team[]
    poolMatches: PoolMatch[]
    playoffGames: PlayoffGame[]
    settings: Settings
  }

  function normalizePoolMatch(match: Partial<PoolMatch>): PoolMatch | null {
    if (
      typeof match.id !== 'string' ||
      (match.pool !== 'A' && match.pool !== 'B') ||
      typeof match.round !== 'number' ||
      typeof match.gameNum !== 'number' ||
      typeof match.teamAId !== 'string' ||
      typeof match.teamBId !== 'string'
    ) {
      return null
    }

    return {
      id: match.id,
      pool: match.pool,
      round: match.round,
      gameNum: match.gameNum,
      court: match.court ?? '',
      officiatingTeamId:
        typeof match.officiatingTeamId === 'string' ? match.officiatingTeamId : null,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      scoreA: typeof match.scoreA === 'number' ? match.scoreA : null,
      scoreB: typeof match.scoreB === 'number' ? match.scoreB : null,
      isFinal: match.isFinal === true,
      serving: (match.serving === 'A' || match.serving === 'B') ? match.serving : null,
      sets: Array.isArray(match.sets) ? match.sets : [],
      pointLog: Array.isArray(match.pointLog) ? match.pointLog : [],
    }
  }

  function normalizeTournamentState(raw: unknown): TournamentState {
    if (!raw || typeof raw !== 'object') return defaultState
    const parsed = raw as Partial<TournamentState>

    const poolMatches = Array.isArray(parsed.poolMatches)
      ? parsed.poolMatches
          .map((match) => normalizePoolMatch(match as Partial<PoolMatch>))
          .filter((match): match is PoolMatch => match !== null)
      : []

    const teams = Array.isArray(parsed.teams) ? parsed.teams.map((t: any) => ({
      id: t.id || '',
      name: t.name || '',
      pool: t.pool || 'A',
      paymentStatus: t.paymentStatus || 'Pending',
      players: Array.isArray(t.players) ? t.players : [],
    })) : []

    const legacySettings = parsed.settings as Partial<Settings> & { time?: string } | undefined

    return {
      teams,
      poolMatches,
      playoffGames: Array.isArray(parsed.playoffGames) ? parsed.playoffGames : [],
      settings: legacySettings ? {
        scheduleName: legacySettings.scheduleName ?? '',
        venue: legacySettings.venue ?? '',
        date: legacySettings.date ?? '',
        startTime: legacySettings.startTime ?? legacySettings.time ?? '',
        endTime: legacySettings.endTime ?? '',
        maxScore: typeof legacySettings.maxScore === 'number' ? legacySettings.maxScore : null,
        leadScore: typeof legacySettings.leadScore === 'number' ? legacySettings.leadScore : null,
        formatType: legacySettings.formatType ?? 'auto',
        useDEBracket: legacySettings.useDEBracket ?? false,
        deBye: typeof legacySettings.deBye === 'number' ? legacySettings.deBye : undefined,
      } : defaultState.settings,
    }
  }

  export interface TeamStanding {
    team: Team
    wins: number
    losses: number
    gamesPlayed: number
    pointsFor: number
    pointsAgainst: number
    quotient: number // PF / PA or PA / PF
    rank: number
  }

  // ─── Storage ──────────────────────────────────────────────────────────────────

  const STORAGE_KEY = 'rebels_tournament_v2'

  export const defaultState: TournamentState = {
    teams: [],
    poolMatches: [],
    playoffGames: [],
    settings: { scheduleName: 'Main Event', venue: '', date: '', startTime: '', endTime: '', maxScore: null, leadScore: null, formatType: 'auto', useDEBracket: false, deBye: undefined },
  }

  export function loadState(storageKey = STORAGE_KEY): TournamentState {
    if (typeof window === 'undefined') return defaultState
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return defaultState
      return normalizeTournamentState(JSON.parse(raw))
    } catch {
      return defaultState
    }
  }

  export function saveState(state: TournamentState, storageKey = STORAGE_KEY): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(storageKey, JSON.stringify(state))
  }

  export function factoryReset(storageKey = STORAGE_KEY): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(storageKey)
  }

  // ─── Game Completion Helper ──────────────────────────────────────────────────

  export function isGameComplete(match: { scoreA: number | null, scoreB: number | null, isFinal?: boolean }, maxScore: number | null, leadScore: number | null = null): boolean {
    if (match.isFinal) return true
    if (match.scoreA === null || match.scoreB === null) return false
    if (maxScore !== null && maxScore > 0) {
      const lead = leadScore !== null && leadScore > 0 ? leadScore : 1
      const meetsMax = match.scoreA >= maxScore || match.scoreB >= maxScore
      const meetsLead = Math.abs(match.scoreA - match.scoreB) >= lead
      return meetsMax && meetsLead
    }
    return true
  }

  // ─── Round-Robin Schedule Generation ─────────────────────────────────────────

  function generateFixedRounds(rounds: Array<Array<[string, string]>>, pool: Pool): PoolMatch[] {
    let gameNum = 1
    const matches: PoolMatch[] = []
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
      for (const [teamAId, teamBId] of rounds[roundIndex]) {
        matches.push({
          id: `${pool}-R${roundIndex + 1}-G${gameNum}`,
          pool,
          round: roundIndex + 1,
          gameNum: gameNum++,
          court: '',
          officiatingTeamId: null,
          teamAId,
          teamBId,
          scoreA: null,
          scoreB: null,
        })
      }
    }
    return matches
  }

  export function generateRoundRobin(teamIds: string[], pool: Pool): PoolMatch[] {
    const teams = [...teamIds]
    if (teams.length < 2) return []

    // Single pool - 4 teams: 1v2, 3v4, 1v3, 2v4, 2v3, 1v4
    if (teams.length === 4) {
      const [t1, t2, t3, t4] = teams
      const rounds: Array<Array<[string, string]>> = [
        [[t1, t2], [t3, t4]],
        [[t1, t3], [t2, t4]],
        [[t2, t3], [t1, t4]],
      ]
      return generateFixedRounds(rounds, pool)
    }

    // Single pool - 5 teams: 1v2, 3v4, 1v5, 2v3, 4v5, 1v3, 2v5, 1v4, 3v5, 2v4
    if (teams.length === 5) {
      const [t1, t2, t3, t4, t5] = teams
      const rounds: Array<Array<[string, string]>> = [
        [[t1, t2], [t3, t4]],
        [[t1, t5], [t2, t3]],
        [[t4, t5], [t1, t3]],
        [[t2, t5], [t1, t4]],
        [[t3, t5], [t2, t4]],
      ]
      return generateFixedRounds(rounds, pool)
    }

    // Single pool - 6 teams: exact matchup order per tournament format
    if (teams.length === 6) {
      const [t1, t2, t3, t4, t5, t6] = teams
      const rounds: Array<Array<[string, string]>> = [
        [[t1, t2], [t3, t4], [t5, t6]],   // G1-G3
        [[t1, t3], [t2, t5], [t4, t6]],   // G4-G6
        [[t1, t4], [t3, t6], [t2, t4]],   // G7-G9 (Note: G9 is T2 vs T4)
        [[t1, t5], [t3, t5], [t2, t6]],   // G10-G12
        [[t1, t6], [t2, t3], [t4, t5]],   // G13-G15
      ]
      return generateFixedRounds(rounds, pool)
    }

    // Single pool - 8 teams: exact matchup order per tournament format
    if (teams.length === 8) {
      const [t1, t2, t3, t4, t5, t6, t7, t8] = teams
      const rounds: Array<Array<[string, string]>> = [
        [[t1, t8], [t2, t7], [t3, t6], [t4, t5]],   // R1: G1-G4
        [[t1, t7], [t8, t6], [t2, t5], [t3, t4]],   // R2: G5-G8
        [[t1, t6], [t7, t5], [t8, t4], [t2, t3]],   // R3: G9-G12
        [[t1, t5], [t6, t4], [t7, t3], [t8, t2]],   // R4: G13-G16
        [[t1, t4], [t5, t3], [t6, t2], [t7, t8]],   // R5: G17-G20
        [[t1, t3], [t4, t2], [t5, t8], [t6, t7]],   // R6: G21-G24
        [[t1, t2], [t3, t8], [t4, t7], [t5, t6]],   // R7: G25-G28
      ]
      return generateFixedRounds(rounds, pool)
    }

    // General fallback
    if (teams.length % 2 === 1) teams.push('BYE')

    const n = teams.length
    const numRounds = n - 1
    const gamesPerRound = n / 2
    const matches: PoolMatch[] = []
    let gameNum = 1

    const rotation = [...teams]

    for (let r = 0; r < numRounds; r++) {
      for (let i = 0; i < gamesPerRound; i++) {
        const a = rotation[i]
        const b = rotation[n - 1 - i]
        if (a !== 'BYE' && b !== 'BYE') {
          matches.push({
            id: `${pool}-R${r + 1}-G${gameNum}`,
            pool,
            round: r + 1,
            gameNum: gameNum++,
            court: '',
            officiatingTeamId: null,
            teamAId: a,
            teamBId: b,
            scoreA: null,
            scoreB: null,
          })
        }
      }
      const last = rotation[n - 1]
      for (let i = n - 1; i > 1; i--) rotation[i] = rotation[i - 1]
      rotation[1] = last
    }

    return matches
  }

  // Pool A and Pool B run simultaneously: Pool A's gameNum N plays at the same
  // slot as Pool B's gameNum N. Each pool keeps its own 1..N gameNum (assigned
  // by generateRoundRobin), so we sort by slot (gameNum) then pool without
  // renumbering.
  export function arrangePoolMatchesByGameNumber(matches: PoolMatch[]): PoolMatch[] {
    return [...matches].sort((a, b) => {
      if (a.gameNum !== b.gameNum) return a.gameNum - b.gameNum
      if (a.pool !== b.pool) return a.pool.localeCompare(b.pool)
      return a.round - b.round
    })
  }

  // ─── Double Round Robin ─────────────────────────────────────────────────────

  export function getMaxRoundRobinRound(matches: PoolMatch[]): number {
    if (matches.length === 0) return 0
    return Math.max(...matches.map((m) => m.round))
  }

  function getOriginalRoundCount(matches: PoolMatch[]): number {
    const pairings = new Set<string>()
    const rounds = new Set<number>()
    for (const m of matches) {
      const key = [m.pool, m.teamAId, m.teamBId].sort().join('|')
      if (pairings.has(key)) return rounds.size
      pairings.add(key)
      rounds.add(m.round)
    }
    return getMaxRoundRobinRound(matches)
  }

  export function hasSecondRound(matches: PoolMatch[]): boolean {
    if (matches.length === 0) return false
    const origRounds = getOriginalRoundCount(matches)
    return matches.some((m) => m.round > origRounds)
  }

  export function secondRoundHasScores(matches: PoolMatch[]): boolean {
    const origRounds = getOriginalRoundCount(matches)
    return matches
      .filter((m) => m.round > origRounds)
      .some((m) => m.scoreA !== null || m.scoreB !== null)
  }

  export function generateSecondRound(matches: PoolMatch[]): PoolMatch[] {
    if (matches.length === 0) return []
    const maxRound = getMaxRoundRobinRound(matches)
    const maxGameNum = Math.max(...matches.map((m) => m.gameNum))

    const secondRoundMatches: PoolMatch[] = matches.map((m, i) => ({
      ...m,
      id: `${m.pool}-R${m.round + maxRound}-G${maxGameNum + i + 1}`,
      round: m.round + maxRound,
      gameNum: maxGameNum + i + 1,
      court: m.court,
      officiatingTeamId: m.officiatingTeamId,
      scoreA: null,
      scoreB: null,
      isFinal: false,
    }))

    return arrangePoolMatchesByGameNumber([...matches, ...secondRoundMatches])
  }

  export function removeSecondRound(matches: PoolMatch[]): PoolMatch[] {
    const origRounds = getOriginalRoundCount(matches)
    return matches.filter((m) => m.round <= origRounds)
  }

  export function getOriginalRoundBoundary(matches: PoolMatch[]): number {
    return getOriginalRoundCount(matches)
  }

  // ─── Standings & Tie-breakers ─────────────────────────────────────────────────

  export function computeStandings(
    teams: Team[],
    matches: PoolMatch[],
    pool: Pool | null = null,
    maxScore: number | null = null,
    leadScore: number | null = null,
  ): TeamStanding[] {
    const filtered = pool ? teams.filter((t) => t.pool === pool) : teams
    const poolMatches = pool ? matches.filter((m) => m.pool === pool) : matches

    const map = new Map<string, TeamStanding>()
    for (const team of filtered) {
      map.set(team.id, {
        team,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        quotient: 0,
        rank: 0,
      })
    }

    for (const m of poolMatches) {
      if (!isGameComplete(m, maxScore, leadScore)) continue
      const scoreA = m.scoreA!
      const scoreB = m.scoreB!
      const sa = map.get(m.teamAId)
      const sb = map.get(m.teamBId)
      if (sa) {
        sa.gamesPlayed++
        sa.pointsFor += scoreA
        sa.pointsAgainst += scoreB
        if (scoreA > scoreB) sa.wins++
        else sa.losses++
      }
      if (sb) {
        sb.gamesPlayed++
        sb.pointsFor += scoreB
        sb.pointsAgainst += scoreA
        if (scoreB > scoreA) sb.wins++
        else sb.losses++
      }
    }

    const standings = Array.from(map.values()).map((s) => ({
      ...s,
      quotient: s.pointsAgainst === 0 ? (s.pointsFor > 0 ? 999 : 0) : s.pointsFor / s.pointsAgainst, // Standard PF/PA quotient
    }))

    standings.sort((a, b) => {
      // a. win record
      if (b.wins !== a.wins) return b.wins - a.wins
      
      // Check if it's a 2-way tie or more by finding all teams with this win count
      const tiedTeams = standings.filter((s) => s.wins === a.wins)
      
      // b. win-over the other (2-way tie)
      if (tiedTeams.length === 2) {
        // Find head-to-head match
        const h2h = poolMatches.find(
          (m) => 
            (m.teamAId === a.team.id && m.teamBId === b.team.id) ||
            (m.teamAId === b.team.id && m.teamBId === a.team.id)
        )
        if (h2h && isGameComplete(h2h, maxScore, leadScore)) {
          const hScoreA = h2h.scoreA!
          const hScoreB = h2h.scoreB!
          if (h2h.teamAId === a.team.id) {
            if (hScoreA > hScoreB) return -1 // a wins
            if (hScoreB > hScoreA) return 1  // b wins
          } else {
            if (hScoreB > hScoreA) return -1 // a wins
            if (hScoreA > hScoreB) return 1  // b wins
          }
        }
      }
      
      // c. total scores (3-way or more tie) - using Points For as total scores
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor

      // d. incase of tied scores - quotient (PF/PA or PA/PF)
      // We use PF/PA quotient here (higher is better)
      return b.quotient - a.quotient
    })

    return standings.map((s, i) => ({ ...s, rank: i + 1 }))
  }

  // ─── Bracket Template ─────────────────────────────────────────────────────────

  interface BracketSlot {
    slot: string
    phase: PlayoffPhase
    label: string
    teamALabel: string
    teamBLabel: string
  }

  export function buildBracketTemplate(poolA: number, poolB: number, variant: 'auto' | 'de' = 'auto', deBye?: number): BracketSlot[] {
    // ── Double Elimination (any single-pool count) ─────────────────────────────
    // Only triggered when explicitly requested via the Generate DE button.
    // Supports 4, 5, 6, and 8 teams in a single pool.
    // deBye: for odd counts only — which seed number gets the bye
    //   5-team: Rank 1 gets a true bye through Winners R1, entering Winners
    //           Semi-Final B directly (default bye seed: Seed #1). 9-slot bracket.
    //   6-team: all seeds play W-R1; deBye is which W-R1 game's loser gets the
    //           L-bracket bye into L-R2 (1, 2, or 3; default: 3 = Loser G23)
    if (variant === 'de' && poolB === 0) {
      const n = poolA

      // 4-team DE — no byes, fully symmetric
      // W-R1a: #1 vs #4  |  W-R1b: #2 vs #3
      // L-R1: L(G21) vs L(G22)
      // W-Final: W(G21) vs W(G22)
      // L-Final: W(G23) vs L(G24)
      // Grand Final: W(G24) vs W(G25) — True Final if L-bracket winner wins
      if (n === 4) {
        return [
          { slot: 'G21', phase: 'winners_bracket', label: 'Winners R1a',   teamALabel: 'Seed #1',    teamBLabel: 'Seed #4'    },
          { slot: 'G22', phase: 'winners_bracket', label: 'Winners R1b',   teamALabel: 'Seed #2',    teamBLabel: 'Seed #3'    },
          { slot: 'G23', phase: 'losers_bracket',  label: 'Losers R1',     teamALabel: 'Loser G21',  teamBLabel: 'Loser G22'  },
          { slot: 'G24', phase: 'winners_bracket', label: 'Winners Final', teamALabel: 'Winner G21', teamBLabel: 'Winner G22' },
          { slot: 'G25', phase: 'losers_bracket',  label: 'Losers Final',  teamALabel: 'Winner G23', teamBLabel: 'Loser G24'  },
          { slot: 'G26', phase: 'grand_final',     label: 'Grand Final',   teamALabel: 'Winner G24', teamBLabel: 'Winner G25' },
          { slot: 'G27', phase: 'true_final',      label: 'True Final',    teamALabel: 'Winner G26', teamBLabel: 'Loser G26'  },
        ]
      }

      // 5-team DE — 9-slot structure (Rank 1 gets a true bye through W-R1,
      // entering the Winners bracket directly in Winners Semi-Final B).
      // G21 Winners Opening:    Rank 4 vs Rank 5
      // G22 Winners Semi-Final A: Rank 2 vs Rank 3
      // G23 Winners Semi-Final B: Rank 1 vs Winner G21
      // G24 Losers Round 1:     Loser G22 vs Loser G23  -> Loser eliminated (5th)
      // G25 Winners Final:      Winner G22 vs Winner G23
      // G26 Losers Semi-Final:  Loser G21 vs Winner G24 -> Loser eliminated (4th)
      // G27 Losers Final:       Loser G25 vs Winner G26 -> Loser eliminated (3rd)
      // G28 Grand Final (M1):   Winner G25 (undefeated) vs Winner G27 (loser side)
      // G29 Grand Final (M2 Rematch): only if loser-side wins G28
      if (n === 5) {
        const bye = deBye ?? 1
        const nonBye = [1, 2, 3, 4, 5].filter(s => s !== bye)
        // nonBye = [Rank2, Rank3, Rank4, Rank5] when bye = Rank1
        return [
          { slot: 'G21', phase: 'winners_bracket', label: 'Winners Opening',     teamALabel: `Seed #${nonBye[2]}`, teamBLabel: `Seed #${nonBye[3]}` },
          { slot: 'G22', phase: 'winners_bracket', label: "Winners Semi-Final A", teamALabel: `Seed #${nonBye[0]}`, teamBLabel: `Seed #${nonBye[1]}` },
          { slot: 'G23', phase: 'winners_bracket', label: "Winners Semi-Final B", teamALabel: `Seed #${bye}`,       teamBLabel: 'Winner G21'          },
          { slot: 'G24', phase: 'losers_bracket',  label: "Losers Round 1",       teamALabel: 'Loser G22',          teamBLabel: 'Loser G23'          },
          { slot: 'G25', phase: 'winners_bracket', label: "Winners Final",        teamALabel: 'Winner G22',         teamBLabel: 'Winner G23'         },
          { slot: 'G26', phase: 'losers_bracket',  label: "Losers Semi-Final",    teamALabel: 'Loser G21',          teamBLabel: 'Winner G24'         },
          { slot: 'G27', phase: 'losers_bracket',  label: "Losers Final",         teamALabel: 'Loser G25',          teamBLabel: 'Winner G26'         },
          { slot: 'G28', phase: 'grand_final',     label: 'Grand Final',          teamALabel: 'Winner G25',         teamBLabel: 'Winner G27'         },
          { slot: 'G29', phase: 'true_final',      label: 'True Final',           teamALabel: 'Winner G28',         teamBLabel: 'Loser G28'          },
        ]
      }

      // 6-team DE — L-bracket bye (default: Loser of W-R1 game 3 = G23)
      // All 6 seeds play W-R1 (3 games). In the Losers bracket, 2 of the 3 losers
      // play L-R1; the third loser (deBye = 1, 2, or 3 indicating which W-R1 game)
      // gets a bye directly into L-R2.
      if (n === 6) {
        const byeGame = deBye ?? 3
        const lPlayingGames = [1, 2, 3].filter(g => g !== byeGame).map(g => `G${20 + g}`)
        const lByeLoser = `Loser G${20 + byeGame}`
        return [
          { slot: 'G21', phase: 'winners_bracket', label: 'Winners R1a',  teamALabel: 'Seed #1',               teamBLabel: 'Seed #6'                },
          { slot: 'G22', phase: 'winners_bracket', label: 'Winners R1b',  teamALabel: 'Seed #2',               teamBLabel: 'Seed #5'                },
          { slot: 'G23', phase: 'winners_bracket', label: 'Winners R1c',  teamALabel: 'Seed #3',               teamBLabel: 'Seed #4'                },
          { slot: 'G24', phase: 'losers_bracket',  label: 'Losers R1',    teamALabel: `Loser ${lPlayingGames[0]}`, teamBLabel: `Loser ${lPlayingGames[1]}` },
          { slot: 'G25', phase: 'losers_bracket',  label: 'Losers R2',    teamALabel: 'Winner G24',            teamBLabel: lByeLoser                },
          { slot: 'G26', phase: 'winners_bracket', label: 'Winners Sema', teamALabel: 'Winner G21',            teamBLabel: 'Winner G22'             },
          { slot: 'G27', phase: 'winners_bracket', label: 'Winners Semb', teamALabel: 'Winner G23',            teamBLabel: 'Winner G26'             },
          { slot: 'G28', phase: 'losers_bracket',  label: 'Losers Semi',  teamALabel: 'Winner G25',            teamBLabel: 'Loser G27'              },
          { slot: 'G29', phase: 'losers_bracket',  label: 'Losers Final', teamALabel: 'Winner G28',            teamBLabel: 'Loser G26'              },
          { slot: 'G30', phase: 'grand_final',     label: 'Grand Final',  teamALabel: 'Winner G27',            teamBLabel: 'Winner G29'             },
          { slot: 'G31', phase: 'true_final',      label: 'True Final',   teamALabel: 'Winner G30',            teamBLabel: 'Loser G30'              },
        ]
      }

      // 8-team DE — no byes, fully symmetric classic bracket
      if (n === 8) {
        return [
          { slot: 'G21', phase: 'winners_bracket', label: 'Winners R1a',   teamALabel: 'Seed #1',    teamBLabel: 'Seed #8'    },
          { slot: 'G22', phase: 'winners_bracket', label: 'Winners R1b',   teamALabel: 'Seed #2',    teamBLabel: 'Seed #7'    },
          { slot: 'G23', phase: 'winners_bracket', label: 'Winners R1c',   teamALabel: 'Seed #3',    teamBLabel: 'Seed #6'    },
          { slot: 'G24', phase: 'winners_bracket', label: 'Winners R1d',   teamALabel: 'Seed #4',    teamBLabel: 'Seed #5'    },
          { slot: 'G25', phase: 'losers_bracket',  label: 'Losers R1a',    teamALabel: 'Loser G21',  teamBLabel: 'Loser G24'  },
          { slot: 'G26', phase: 'losers_bracket',  label: 'Losers R1b',    teamALabel: 'Loser G22',  teamBLabel: 'Loser G23'  },
          { slot: 'G27', phase: 'winners_bracket', label: 'Winners Sema',  teamALabel: 'Winner G21', teamBLabel: 'Winner G22' },
          { slot: 'G28', phase: 'winners_bracket', label: 'Winners Semb',  teamALabel: 'Winner G23', teamBLabel: 'Winner G24' },
          { slot: 'G29', phase: 'losers_bracket',  label: 'Losers R2a',    teamALabel: 'Winner G25', teamBLabel: 'Loser G28'  },
          { slot: 'G30', phase: 'losers_bracket',  label: 'Losers R2b',    teamALabel: 'Winner G26', teamBLabel: 'Loser G27'  },
          { slot: 'G31', phase: 'winners_bracket', label: 'Winners Final', teamALabel: 'Winner G27', teamBLabel: 'Winner G28' },
          { slot: 'G32', phase: 'losers_bracket',  label: 'Losers Sema',   teamALabel: 'Winner G29', teamBLabel: 'Winner G30' },
          { slot: 'G33', phase: 'losers_bracket',  label: 'Losers Final',  teamALabel: 'Winner G32', teamBLabel: 'Loser G31'  },
          { slot: 'G34', phase: 'grand_final',     label: 'Grand Final',   teamALabel: 'Winner G31', teamBLabel: 'Winner G33' },
          { slot: 'G35', phase: 'true_final',      label: 'True Final',    teamALabel: 'Winner G34', teamBLabel: 'Loser G34'  },
        ]
      }

      // DE not defined for this team count — fall through to auto
    }

    // ── Auto (existing formats — untouched) ───────────────────────────────────
    if (poolA === 4 && poolB === 0) {
      return [
        { slot: 'G21', phase: 'semifinal', label: 'Semi-Final 1', teamALabel: 'Seed #1', teamBLabel: 'Seed #4' },
        { slot: 'G22', phase: 'semifinal', label: 'Semi-Final 2', teamALabel: 'Seed #2', teamBLabel: 'Seed #3' },
        { slot: 'G23', phase: '3rd_place', label: 'Battle for Third', teamALabel: 'Loser G21', teamBLabel: 'Loser G22' },
        { slot: 'G24', phase: 'championship', label: 'Championship', teamALabel: 'Winner G21', teamBLabel: 'Winner G22' },
      ]
    }

    // Single Pool - 5 teams
    if (poolA === 5 && poolB === 0) {
      return [
        { slot: 'G21', phase: 'wildcard', label: 'Wildcard', teamALabel: 'Seed #4', teamBLabel: 'Seed #5' },
        { slot: 'G22', phase: 'semifinal', label: 'Semi-Final 1', teamALabel: 'Seed #2', teamBLabel: 'Seed #3' },
        { slot: 'G23', phase: 'semifinal', label: 'Semi-Final 2', teamALabel: 'Seed #1', teamBLabel: 'Winner G21' },
        { slot: 'G24', phase: '3rd_place', label: 'Battle for Third', teamALabel: 'Loser G22', teamBLabel: 'Loser G23' },
        { slot: 'G25', phase: 'championship', label: 'Championship', teamALabel: 'Winner G22', teamBLabel: 'Winner G23' },
      ]
    }

    // Single Pool - 6 teams
    if (poolA === 6 && poolB === 0) {
      return [
        { slot: 'G16', phase: 'elimination', label: 'Elimination', teamALabel: 'Seed #5', teamBLabel: 'Seed #6' },
        { slot: 'G17', phase: 'semifinal', label: 'Semi-Final 1', teamALabel: 'Seed #2', teamBLabel: 'Seed #3' },
        { slot: 'G18', phase: 'semifinal', label: 'Semi-Final 2', teamALabel: 'Seed #1', teamBLabel: 'Seed #4' },
        { slot: 'G19', phase: '3rd_place', label: 'Battle for Third', teamALabel: 'Loser G17', teamBLabel: 'Loser G18' },
        { slot: 'G20', phase: 'championship', label: 'Championship', teamALabel: 'Winner G17', teamBLabel: 'Winner G18' },
      ]
    }

    // Single Pool - 8 teams
    if (poolA === 8 && poolB === 0) {
      return [
        { slot: 'G29', phase: 'classification', label: 'Classification (7th/8th)', teamALabel: 'Seed #7', teamBLabel: 'Seed #8' },
        { slot: 'G30', phase: 'classification', label: 'Classification (5th/6th)', teamALabel: 'Seed #5', teamBLabel: 'Seed #6' },
        { slot: 'G31', phase: 'semifinal', label: 'Semi-Final A', teamALabel: 'Seed #1', teamBLabel: 'Seed #4' },
        { slot: 'G32', phase: 'semifinal', label: 'Semi-Final B', teamALabel: 'Seed #2', teamBLabel: 'Seed #3' },
        { slot: 'G33', phase: '3rd_place', label: 'Battle for Third', teamALabel: 'Loser G31', teamBLabel: 'Loser G32' },
        { slot: 'G34', phase: 'championship', label: 'Championship', teamALabel: 'Winner G31', teamBLabel: 'Winner G32' },
      ]
    }

    // Double Pool - 8 teams (4 each)
    if (poolA === 4 && poolB === 4) {
      return [
        { slot: 'G21', phase: 'crossover', label: 'Crossover 1', teamALabel: 'Pool A #1', teamBLabel: 'Pool B #4' },
        { slot: 'G22', phase: 'crossover', label: 'Crossover 2', teamALabel: 'Pool A #3', teamBLabel: 'Pool B #2' },
        { slot: 'G23', phase: 'crossover', label: 'Crossover 3', teamALabel: 'Pool A #2', teamBLabel: 'Pool B #3' },
        { slot: 'G24', phase: 'crossover', label: 'Crossover 4', teamALabel: 'Pool A #4', teamBLabel: 'Pool B #1' },
        { slot: 'G25', phase: 'semifinal', label: 'Semi-Final 1', teamALabel: 'Winner G21', teamBLabel: 'Winner G22' },
        { slot: 'G26', phase: 'semifinal', label: 'Semi-Final 2', teamALabel: 'Winner G23', teamBLabel: 'Winner G24' },
        { slot: 'G27', phase: '3rd_place', label: 'Battle for Third', teamALabel: 'Loser G25', teamBLabel: 'Loser G26' },
        { slot: 'G28', phase: 'championship', label: 'Championship', teamALabel: 'Winner G25', teamBLabel: 'Winner G26' },
      ]
    }

    // Double Pool - 10 teams (5 each)
    if (poolA === 5 && poolB === 5) {
      return [
        { slot: 'G21', phase: 'wildcard', label: 'Wildcard 1', teamALabel: 'Pool A #4', teamBLabel: 'Pool A #5' },
        { slot: 'G22', phase: 'wildcard', label: 'Wildcard 2', teamALabel: 'Pool B #4', teamBLabel: 'Pool B #5' },
        { slot: 'G23', phase: 'crossover', label: 'Crossover 1', teamALabel: 'Pool A #1', teamBLabel: 'Winner G22' },
        { slot: 'G24', phase: 'crossover', label: 'Crossover 2', teamALabel: 'Pool A #3', teamBLabel: 'Pool B #2' },
        { slot: 'G25', phase: 'crossover', label: 'Crossover 3', teamALabel: 'Winner G21', teamBLabel: 'Pool B #1' },
        { slot: 'G26', phase: 'crossover', label: 'Crossover 4', teamALabel: 'Pool A #2', teamBLabel: 'Pool B #3' },
        { slot: 'G27', phase: 'semifinal', label: 'Semi-Final 1', teamALabel: 'Winner G23', teamBLabel: 'Winner G24' },
        { slot: 'G28', phase: 'semifinal', label: 'Semi-Final 2', teamALabel: 'Winner G25', teamBLabel: 'Winner G26' },
        { slot: 'G29', phase: '3rd_place', label: 'Battle for Third', teamALabel: 'Loser G27', teamBLabel: 'Loser G28' },
        { slot: 'G30', phase: 'championship', label: 'Championship', teamALabel: 'Winner G27', teamBLabel: 'Winner G28' },
      ]
    }

    // Fallback generic bracket if combinations don't match exactly
    return []
  }

  // ─── Bracket Resolution ───────────────────────────────────────────────────────

  export function resolvePlayoffGames(
    template: BracketSlot[],
    teams: Team[],
    poolMatches: PoolMatch[],
    existingGames: PlayoffGame[],
    maxScore: number | null = null,
    leadScore: number | null = null,
  ): PlayoffGame[] {
    const poolA = computeStandings(teams, poolMatches, 'A', maxScore, leadScore)
    const poolB = computeStandings(teams, poolMatches, 'B', maxScore, leadScore)
    const single = computeStandings(teams, poolMatches, null, maxScore, leadScore)

    const getByLabel = (label: string): string | null => {
      const poolAMatch = label.match(/^Pool A #(\d+)$/)
      if (poolAMatch) return poolA[parseInt(poolAMatch[1]) - 1]?.team.id ?? null

      const poolBMatch = label.match(/^Pool B #(\d+)$/)
      if (poolBMatch) return poolB[parseInt(poolBMatch[1]) - 1]?.team.id ?? null

      const seedMatch = label.match(/^Seed #(\d+)$/)
      if (seedMatch) return single[parseInt(seedMatch[1]) - 1]?.team.id ?? null

      const winnerMatch = label.match(/^Winner (G\d+)$/)
      if (winnerMatch) {
        const g = existingGames.find((g) => g.slot === winnerMatch[1])
        if (!g || !isGameComplete(g, maxScore, leadScore)) return null
        if (g.scoreA! > g.scoreB!) return g.teamAId
        if (g.scoreB! > g.scoreA!) return g.teamBId
        return null
      }

      const loserMatch = label.match(/^Loser (G\d+)$/)
      if (loserMatch) {
        const g = existingGames.find((g) => g.slot === loserMatch[1])
        if (!g || !isGameComplete(g, maxScore, leadScore)) return null
        if (g.scoreA! < g.scoreB!) return g.teamAId
        if (g.scoreB! < g.scoreA!) return g.teamBId
        return null
      }

      return null
    }

    const resolved: PlayoffGame[] = template.map((t) => {
      const existing = existingGames.find((g) => g.slot === t.slot)
      return {
        slot: t.slot,
        phase: t.phase,
        label: t.label,
        court: existing?.court ?? '',
        teamALabel: t.teamALabel,
        teamBLabel: t.teamBLabel,
        teamAId: getByLabel(t.teamALabel),
        teamBId: getByLabel(t.teamBLabel),
        scoreA: existing?.scoreA ?? null,
        scoreB: existing?.scoreB ?? null,
      }
    })

    const resolvedMap = new Map(resolved.map((g) => [g.slot, g]))

    const resolveWithMap = (label: string): string | null => {
      const winnerMatch = label.match(/^Winner (G\d+)$/)
      if (winnerMatch) {
        const g = resolvedMap.get(winnerMatch[1])
        if (!g || !isGameComplete(g, maxScore, leadScore)) return null
        if (g.scoreA! > g.scoreB!) return g.teamAId
        if (g.scoreB! > g.scoreA!) return g.teamBId
        return null
      }
      const loserMatch = label.match(/^Loser (G\d+)$/)
      if (loserMatch) {
        const g = resolvedMap.get(loserMatch[1])
        if (!g || !isGameComplete(g, maxScore, leadScore)) return null
        if (g.scoreA! < g.scoreB!) return g.teamAId
        if (g.scoreB! < g.scoreA!) return g.teamBId
        return null
      }
      return getByLabel(label)
    }

    return resolved.map((g) => ({
      ...g,
      teamAId: resolveWithMap(g.teamALabel),
      teamBId: resolveWithMap(g.teamBLabel),
    }))
  }

  // ─── Export Utilities ─────────────────────────────────────────────────────────

  export function exportCSV(teams: Team[], matches: PoolMatch[], maxScore: number | null = null, leadScore: number | null = null): void {
    const standingsA = computeStandings(teams, matches, 'A', maxScore, leadScore)
    const standingsB = computeStandings(teams, matches, 'B', maxScore, leadScore)
    const all = [...standingsA, ...standingsB]

    const header = 'Rank,Team,Pool,W,L,GP,PF,PA,Quotient\n'
    const rows = all
      .map(
        (s) =>
          `${s.rank},${s.team.name},${s.team.pool},${s.wins},${s.losses},${s.gamesPlayed},${s.pointsFor},${s.pointsAgainst},${s.quotient.toFixed(3)}`,
      )
      .join('\n')

    downloadFile('rebels_standings.csv', 'text/csv', header + rows)
  }

  export function exportJSON(state: TournamentState): void {
    downloadFile(
      'rebels_backup.json',
      'application/json',
      JSON.stringify(state, null, 2),
    )
  }

  function downloadFile(name: string, type: string, content: string): void {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  export function importJSON(json: string): TournamentState | null {
    try {
      const parsed = JSON.parse(json)
      if (!parsed.teams || !parsed.poolMatches) return null
      return normalizeTournamentState(parsed)
    } catch {
      return null
    }
  }

  // ─── Phase Labels ─────────────────────────────────────────────────────────────

  export const PHASE_LABELS: Record<PlayoffPhase, string> = {
    wildcard: 'WILDCARD',
    elimination: 'ELIMINATION',
    crossover: 'CROSSOVER',
    classification: 'CLASSIFICATION',
    semifinal: 'SEMI-FINAL',
    '3rd_place': 'BATTLE FOR 3RD',
    championship: 'CHAMPIONSHIP',
    winners_bracket: 'WINNERS',
    losers_bracket: 'LOSERS',
    grand_final: 'GRAND FINAL',
    true_final: 'TRUE FINAL',
  }

  export const PHASE_COLORS: Record<PlayoffPhase, string> = {
    wildcard: 'text-yellow-400',
    elimination: 'text-orange-400',
    crossover: 'text-blue-400',
    classification: 'text-teal-400',
    semifinal: 'text-purple-400',
    '3rd_place': 'text-amber-500',
    championship: 'text-[#cbd5e1]',
    winners_bracket: 'text-blue-400',
    losers_bracket: 'text-orange-400',
    grand_final: 'text-purple-400',
    true_final: 'text-[#cbd5e1]',
  }
