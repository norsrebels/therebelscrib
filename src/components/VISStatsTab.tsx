// src/components/VISStatsTab.tsx
// Sprint 2 — Full rebuild:
//   ✅ Card layout (no horizontal scroll)
//   ✅ Active player spotlight
//   ✅ Jersey number quick-select bar
//   ✅ Collapsible stat groups
//   ✅ Split-screen Team A / Team B
//   ✅ Dual-statistician polling sync (5s)
//   ✅ Team assignment per statistician
//   ✅ Conflict indicator
//   ✅ FIVB-compliant formulas
//   ✅ Freeball dig tracking
//   ✅ Set attempt auto-compute
//   ✅ Reception attempt auto-compute

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { TournamentState, Player } from '@/lib/tournament'
import {
  type PlayerStatRow,
  type StatField,
  attackEfficiency,
  attackTotal,
  killPct,
  serveAcePct,
  serveErrorPct,
  serveTotal,
  passEfficiency,
  receptionTotal,
  setEfficiency,
  setTotal,
  digSuccessRate,
  freeballEfficiency,
  blockTotal,
  blockPoints,
  pointsTotal,
  aggregateTeamStats,
  fmt2,
  fmtPct,
  fmtEff,
} from '@/lib/stats/formulas'
import {
  getPlayerStats,
  upsertPlayerStat,
  savePlayerStatRow,
  undoLastStat,
  resolveOrCreatePlayer,
} from '@/server/stats.functions'
import {
  Undo2, ArrowUpDown, Save, Loader2, Check,
  ChevronDown, ChevronUp, Users, Zap, RefreshCw,
  AlertTriangle,
} from 'lucide-react'

type SubTab = 'live' | 'all' | 'attack' | 'serve' | 'reception' | 'block' | 'set' | 'dig' | 'points'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'live',      label: 'Live Entry' },
  { key: 'all',       label: 'All Stats' },
  { key: 'attack',    label: 'Attack' },
  { key: 'serve',     label: 'Serve' },
  { key: 'reception', label: 'Reception' },
  { key: 'block',     label: 'Block' },
  { key: 'set',       label: 'Set' },
  { key: 'dig',       label: 'Dig' },
  { key: 'points',    label: 'Points' },
]

const EMPTY_ROW = (): PlayerStatRow => ({
  attackKill: 0, attackError: 0, attackAttempt: 0,
  serveAce: 0, serveError: 0, serveAttempt: 0,
  receptionPerfect: 0, receptionGood: 0, receptionOk: 0, receptionError: 0,
  receiveAttempt: 0,
  setAssist: 0, setAttempt: 0, setBallHandlingError: 0,
  blockSolo: 0, blockAssist: 0, blockError: 0, blockRebound: 0,
  dig: 0, digError: 0, digAttempt: 0,
  freeballDig: 0, freeballError: 0,
})

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ─── Stat group definitions ───────────────────────────────────────────────────
type StatGroupKey = 'ATK' | 'SRV' | 'RCV' | 'BLK' | 'DIG' | 'SET'

const GROUP_COLORS: Record<StatGroupKey, string> = {
  ATK: 'text-green-400',
  SRV: 'text-blue-400',
  RCV: 'text-emerald-400',
  BLK: 'text-purple-400',
  DIG: 'text-cyan-400',
  SET: 'text-amber-400',
}

const GROUP_BG: Record<StatGroupKey, string> = {
  ATK: 'border-green-500/20 bg-green-500/5',
  SRV: 'border-blue-500/20 bg-blue-500/5',
  RCV: 'border-emerald-500/20 bg-emerald-500/5',
  BLK: 'border-purple-500/20 bg-purple-500/5',
  DIG: 'border-cyan-500/20 bg-cyan-500/5',
  SET: 'border-amber-500/20 bg-amber-500/5',
}

// ─── Main component ───────────────────────────────────────────────────────────
export function VISStatsTab({ state, tournamentId }: { state: TournamentState; tournamentId: string }) {
  const [subTab, setSubTab]                 = useState<SubTab>('live')
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [selectedSet, setSelectedSet]       = useState(1)
  const [teamFilter, setTeamFilter]         = useState<'all' | 'A' | 'B'>('all')
  const [viewMode, setViewMode]             = useState<'perSet' | 'cumulative'>('cumulative')
  const [stats, setStats]                   = useState<Record<string, Record<number, PlayerStatRow>>>({})
  const [sortCol, setSortCol]               = useState<string>('')
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('desc')
  const [undoing, setUndoing]               = useState(false)
  const [saveStatus, setSaveStatus]         = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savingAll, setSavingAll]           = useState(false)
  const [lastPollAt, setLastPollAt]         = useState<Date | null>(null)
  const [conflicts, setConflicts]           = useState<Set<string>>(new Set())
  // Dual-stat team assignment: 'A' | 'B' | 'all'
  const [myTeam, setMyTeam]                 = useState<'all' | 'A' | 'B'>('all')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStatsRef   = useRef<typeof stats>({})

  const allMatches = useMemo(() => {
    const pool = state.poolMatches.map(m => ({
      id: m.id,
      label: `${state.teams.find(t => t.id === m.teamAId)?.name ?? '?'} vs ${state.teams.find(t => t.id === m.teamBId)?.name ?? '?'}`,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
    }))
    const playoffs = (state.playoffGames ?? []).filter(g => g.teamAId && g.teamBId).map(g => ({
      id: g.slot,
      label: `${g.label ?? g.slot}: ${state.teams.find(t => t.id === g.teamAId)?.name ?? '?'} vs ${state.teams.find(t => t.id === g.teamBId)?.name ?? '?'}`,
      teamAId: g.teamAId!,
      teamBId: g.teamBId!,
    }))
    return [...pool, ...playoffs]
  }, [state])

  const selectedMatch = allMatches.find(m => m.id === selectedMatchId)

  const playersForMatch = useMemo(() => {
    if (!selectedMatch) return []
    const teamA = state.teams.find(t => t.id === selectedMatch.teamAId)
    const teamB = state.teams.find(t => t.id === selectedMatch.teamBId)
    const playersA = (teamA?.players ?? []).map(p => ({ ...p, teamId: selectedMatch.teamAId, teamName: teamA?.name ?? '?' }))
    const playersB = (teamB?.players ?? []).map(p => ({ ...p, teamId: selectedMatch.teamBId, teamName: teamB?.name ?? '?' }))
    return [...playersA, ...playersB]
  }, [selectedMatch, state.teams])

  const [dbPlayerIds, setDbPlayerIds] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    const resolveAll = async () => {
      for (const p of playersForMatch) {
        if (dbPlayerIds[p.id] !== undefined) continue
        try {
          const res = await resolveOrCreatePlayer({ data: { name: p.name, jerseyNumber: p.jerseyNumber ?? null } })
          if (cancelled) return
          setDbPlayerIds(prev => (prev[p.id] !== undefined ? prev : { ...prev, [p.id]: res.id }))
        } catch { /* ignore */ }
      }
    }
    resolveAll()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersForMatch])

  // ─── Load stats from DB ────────────────────────────────────────
  const loadStats = useCallback(async (detectConflicts = false) => {
    if (!selectedMatchId) return
    const unresolvedCount = playersForMatch.filter(p => dbPlayerIds[p.id] === undefined).length
    if (unresolvedCount > 0) return
    try {
      const data = await getPlayerStats({ data: { matchId: selectedMatchId } })
      const map: Record<string, Record<number, PlayerStatRow>> = {}
      for (const row of data) {
        const key = String(row.playerId)
        if (!map[key]) map[key] = {}
        map[key][row.setNumber] = row as any
      }

      // Conflict detection: compare with previous snapshot
      if (detectConflicts) {
        const newConflicts = new Set<string>()
        for (const [pid, sets] of Object.entries(map)) {
          for (const [setNum, row] of Object.entries(sets)) {
            const prevRow = prevStatsRef.current[pid]?.[Number(setNum)]
            if (!prevRow) continue
            for (const field of Object.keys(row) as StatField[]) {
              const cur = (row as any)[field] ?? 0
              const prev = (prevRow as any)[field] ?? 0
              if (cur !== prev) {
                newConflicts.add(`${pid}-${setNum}-${field}`)
              }
            }
          }
        }
        if (newConflicts.size > 0) {
          setConflicts(newConflicts)
          setTimeout(() => setConflicts(new Set()), 5000)
        }
      }

      prevStatsRef.current = map
      setStats(map)
      setLastPollAt(new Date())
    } catch { /* ignore */ }
  }, [selectedMatchId, dbPlayerIds, playersForMatch])

  useEffect(() => {
    loadStats(false)
  }, [loadStats])

  // ─── 5-second polling for dual-statistician sync ───────────────
  useEffect(() => {
    if (!selectedMatchId || subTab !== 'live') return
    pollRef.current = setInterval(() => loadStats(true), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedMatchId, subTab, loadStats])

  const getStatRow = useCallback((tournamentPlayerId: string, setNum: number): PlayerStatRow => {
    const dbId = dbPlayerIds[tournamentPlayerId]
    if (dbId === undefined) return EMPTY_ROW()
    return stats[String(dbId)]?.[setNum] ?? EMPTY_ROW()
  }, [stats, dbPlayerIds])

  const getCumulativeRow = useCallback((tournamentPlayerId: string): PlayerStatRow => {
    const dbId = dbPlayerIds[tournamentPlayerId]
    if (dbId === undefined) return EMPTY_ROW()
    const sets = stats[String(dbId)] ?? {}
    const rows = Object.values(sets)
    if (rows.length === 0) return EMPTY_ROW()
    return aggregateTeamStats(rows)
  }, [stats, dbPlayerIds])

  const handleTap = useCallback(async (playerId: string, teamId: string, field: StatField, delta: number) => {
    const dbPlayerId = dbPlayerIds[playerId]
    if (dbPlayerId === undefined) return
    const key = String(dbPlayerId)

    setStats(prev => {
      const playerSets = { ...prev[key] }
      const current = playerSets[selectedSet] ?? EMPTY_ROW()
      playerSets[selectedSet] = {
        ...current,
        [field]: Math.max(0, (current[field] ?? 0) + delta),
      }
      return { ...prev, [key]: playerSets }
    })

    setSaveStatus('saving')
    try {
      await upsertPlayerStat({
        data: {
          matchId: selectedMatchId,
          playerId: dbPlayerId,
          teamId: tournamentId,
          setNumber: selectedSet,
          field,
          delta,
        }
      })
      setSaveStatus('saved')
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }, [selectedMatchId, selectedSet, dbPlayerIds, tournamentId])

  const handleUndo = useCallback(async () => {
    if (!selectedMatchId) return
    setUndoing(true)
    try {
      await undoLastStat({ data: { matchId: selectedMatchId } })
      await loadStats(false)
    } catch { /* ignore */ }
    setUndoing(false)
  }, [selectedMatchId, loadStats])

  const handleSaveAll = useCallback(async () => {
    if (!selectedMatchId) return
    setSavingAll(true)
    setSaveStatus('saving')
    try {
      for (const p of playersForMatch) {
        const dbPlayerId = dbPlayerIds[p.id]
        if (dbPlayerId === undefined) continue
        const sets = stats[String(dbPlayerId)] ?? {}
        for (const [setNumber, row] of Object.entries(sets)) {
          await savePlayerStatRow({
            data: {
              matchId: selectedMatchId,
              playerId: dbPlayerId,
              teamId: tournamentId,
              setNumber: Number(setNumber),
              row: row as unknown as Record<string, number>,
            }
          })
        }
      }
      setSaveStatus('saved')
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
    setSavingAll(false)
  }, [selectedMatchId, playersForMatch, dbPlayerIds, stats, tournamentId])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving' || saveStatus === 'error') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus])

  const sortedPlayers = useMemo(() => {
    if (!sortCol) return playersForMatch
    return [...playersForMatch].sort((a, b) => {
      const rowA = viewMode === 'perSet' ? getStatRow(a.id, selectedSet) : getCumulativeRow(a.id)
      const rowB = viewMode === 'perSet' ? getStatRow(b.id, selectedSet) : getCumulativeRow(b.id)
      const va = (rowA as any)[sortCol] ?? 0
      const vb = (rowB as any)[sortCol] ?? 0
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [playersForMatch, sortCol, sortDir, viewMode, selectedSet, getStatRow, getCumulativeRow])

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-4">
      {/* Match & set selectors */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Match</label>
          <select
            value={selectedMatchId}
            onChange={e => setSelectedMatchId(e.target.value)}
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Select match...</option>
            {allMatches.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Set</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setSelectedSet(n)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium',
                  selectedSet === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))]'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Dual-stat team assignment */}
        {selectedMatchId && (
          <div>
            <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block flex items-center gap-1">
              <Users size={10} /> My Team
            </label>
            <div className="flex gap-1">
              {(['all', 'A', 'B'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMyTeam(t)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium',
                    myTeam === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))]'
                  )}
                >
                  {t === 'all' ? 'Both' : `Team ${t}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl p-1">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              subTab === t.key
                ? 'bg-blue-600 text-white'
                : 'text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!selectedMatchId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap size={32} className="text-[rgb(var(--muted-fg))] opacity-30 mb-3" />
          <p className="text-sm text-[rgb(var(--muted-fg))] font-medium">Select a match to begin entering stats</p>
          <p className="text-xs text-[rgb(var(--muted-fg))] opacity-60 mt-1">Pool matches and playoffs will appear above</p>
        </div>
      ) : subTab === 'live' ? (
        <LiveEntryPanel
          players={playersForMatch}
          selectedSet={selectedSet}
          onTap={handleTap}
          onUndo={handleUndo}
          undoing={undoing}
          getStatRow={getStatRow}
          state={state}
          selectedMatch={selectedMatch}
          onSaveAll={handleSaveAll}
          savingAll={savingAll}
          saveStatus={saveStatus}
          lastPollAt={lastPollAt}
          conflicts={conflicts}
          myTeam={myTeam}
          dbPlayerIds={dbPlayerIds}
        />
      ) : (
        <StatTable
          subTab={subTab}
          players={sortedPlayers}
          teamFilter={teamFilter}
          setTeamFilter={setTeamFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedSet={selectedSet}
          getStatRow={getStatRow}
          getCumulativeRow={getCumulativeRow}
          selectedMatch={selectedMatch}
          onSort={handleSort}
          sortCol={sortCol}
          sortDir={sortDir}
        />
      )}
    </div>
  )
}

// ─── Live Entry Panel ─────────────────────────────────────────────────────────

function LiveEntryPanel({
  players, selectedSet, onTap, onUndo, undoing, getStatRow, state, selectedMatch,
  onSaveAll, savingAll, saveStatus, lastPollAt, conflicts, myTeam, dbPlayerIds,
}: {
  players: (Player & { teamId: string; teamName: string })[]
  selectedSet: number
  onTap: (playerId: string, teamId: string, field: StatField, delta: number) => void
  onUndo: () => void
  undoing: boolean
  getStatRow: (playerId: string, setNum: number) => PlayerStatRow
  state: TournamentState
  selectedMatch: any
  onSaveAll: () => void
  savingAll: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastPollAt: Date | null
  conflicts: Set<string>
  myTeam: 'all' | 'A' | 'B'
  dbPlayerIds: Record<string, number>
}) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)

  const teamAPlayers = players.filter(p => p.teamId === selectedMatch?.teamAId)
  const teamBPlayers = players.filter(p => p.teamId === selectedMatch?.teamBId)
  const teamAName = state.teams.find(t => t.id === selectedMatch?.teamAId)?.name ?? 'Team A'
  const teamBName = state.teams.find(t => t.id === selectedMatch?.teamBId)?.name ?? 'Team B'

  // Filter to assigned team
  const visibleTeamA = myTeam === 'B' ? [] : teamAPlayers
  const visibleTeamB = myTeam === 'A' ? [] : teamBPlayers

  const pill = saveStatus === 'error'
    ? { dot: 'bg-red-500', label: 'Save failed', spin: false, text: 'text-red-400' }
    : saveStatus === 'saving'
      ? { dot: 'bg-amber-500', label: 'Saving...', spin: true, text: 'text-amber-400' }
      : { dot: 'bg-green-500', label: 'Saved', spin: false, text: 'text-green-400' }

  const activePlayer = activePlayerId
    ? players.find(p => p.id === activePlayerId)
    : null

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wider">
            Set {selectedSet} — Live Entry
          </span>
          {conflicts.size > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <AlertTriangle size={11} /> {conflicts.size} conflict{conflicts.size > 1 ? 's' : ''} detected
            </span>
          )}
          {lastPollAt && (
            <span className="flex items-center gap-1 text-[10px] text-[rgb(var(--muted-fg))]">
              <RefreshCw size={9} /> synced {lastPollAt.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[rgb(var(--surface))] border border-[rgb(var(--border))]', pill.text)}>
            {pill.spin
              ? <Loader2 size={11} className="animate-spin" />
              : <span className={cn('w-2 h-2 rounded-full', pill.dot)} />}
            {pill.label}
          </span>
          <button
            onClick={onSaveAll}
            disabled={savingAll || saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-600/25 disabled:opacity-50"
          >
            {savingAll
              ? <Loader2 size={13} className="animate-spin" />
              : saveStatus === 'saved'
                ? <Check size={13} className="text-green-400" />
                : <Save size={13} />}
            Save All
          </button>
          <button
            onClick={onUndo}
            disabled={undoing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Undo2 size={13} /> Undo
          </button>
        </div>
      </div>

      {/* Active player spotlight */}
      {activePlayer && (
        <ActivePlayerPanel
          player={activePlayer}
          selectedSet={selectedSet}
          getStatRow={getStatRow}
          onTap={onTap}
          onClose={() => setActivePlayerId(null)}
        />
      )}

      {/* Team A */}
      {visibleTeamA.length > 0 && (
        <LiveTeamCards
          teamName={teamAName}
          players={visibleTeamA}
          selectedSet={selectedSet}
          getStatRow={getStatRow}
          onTap={onTap}
          activePlayerId={activePlayerId}
          onSelectPlayer={setActivePlayerId}
          dbPlayerIds={dbPlayerIds}
          conflicts={conflicts}
        />
      )}

      {/* Team B */}
      {visibleTeamB.length > 0 && (
        <LiveTeamCards
          teamName={teamBName}
          players={visibleTeamB}
          selectedSet={selectedSet}
          getStatRow={getStatRow}
          onTap={onTap}
          activePlayerId={activePlayerId}
          onSelectPlayer={setActivePlayerId}
          dbPlayerIds={dbPlayerIds}
          conflicts={conflicts}
        />
      )}
    </div>
  )
}

// ─── Active Player Spotlight ──────────────────────────────────────────────────

function ActivePlayerPanel({
  player, selectedSet, getStatRow, onTap, onClose,
}: {
  player: Player & { teamId: string; teamName: string }
  selectedSet: number
  getStatRow: (id: string, set: number) => PlayerStatRow
  onTap: (id: string, teamId: string, field: StatField, delta: number) => void
  onClose: () => void
}) {
  const row = getStatRow(player.id, selectedSet)
  const [openGroups, setOpenGroups] = useState<Set<StatGroupKey>>(new Set(['ATK', 'SRV', 'RCV']))

  const toggleGroup = (g: StatGroupKey) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  const tap = (field: StatField, delta: number) => onTap(player.id, player.teamId, field, delta)

  // FIVB auto-computed totals shown as read-only
  const recTotal = receptionTotal(row.receptionPerfect, row.receptionGood, row.receptionOk, row.receptionError)
  const setTot   = setTotal(row.setAssist, row.setBallHandlingError)

  return (
    <div className="bg-[rgb(var(--surface))] border-2 border-blue-500/40 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            #{player.jerseyNumber ?? '?'}
          </div>
          <div>
            <div className="font-bold text-sm">{player.name}</div>
            <div className="text-xs text-[rgb(var(--muted-fg))]">{player.teamName} · Set {selectedSet}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
        >
          Close
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* ATTACK */}
        <CollapsibleGroup
          groupKey="ATK"
          label="Attack"
          open={openGroups.has('ATK')}
          onToggle={() => toggleGroup('ATK')}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <TapCard label="Kill" field="attackKill" val={row.attackKill} color="bg-green-600" onTap={tap} />
            <TapCard label="Error" field="attackError" val={row.attackError} color="bg-red-600" onTap={tap} />
            <TapCard label="In Play" field="attackAttempt" val={row.attackAttempt} color="bg-gray-600" onTap={tap} />
          </div>
          <FIVBComputed
            label="Total Att"
            value={String(attackTotal(row.attackKill, row.attackError, row.attackAttempt))}
            extra={`Eff: ${row.attackKill + row.attackError + row.attackAttempt > 0
              ? ((row.attackKill - row.attackError) / (row.attackKill + row.attackError + row.attackAttempt)).toFixed(3)
              : '—'}`}
          />
        </CollapsibleGroup>

        {/* SERVE */}
        <CollapsibleGroup groupKey="SRV" label="Serve" open={openGroups.has('SRV')} onToggle={() => toggleGroup('SRV')}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <TapCard label="Ace" field="serveAce" val={row.serveAce} color="bg-green-600" onTap={tap} />
            <TapCard label="Error" field="serveError" val={row.serveError} color="bg-red-600" onTap={tap} />
            <TapCard label="In Play" field="serveAttempt" val={row.serveAttempt} color="bg-gray-600" onTap={tap} />
          </div>
          <FIVBComputed
            label="Total Att"
            value={String(serveTotal(row.serveAce, row.serveError, row.serveAttempt))}
          />
        </CollapsibleGroup>

        {/* RECEPTION */}
        <CollapsibleGroup groupKey="RCV" label="Reception" open={openGroups.has('RCV')} onToggle={() => toggleGroup('RCV')}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <TapCard label="Perfect (3)" field="receptionPerfect" val={row.receptionPerfect} color="bg-emerald-600" onTap={tap} />
            <TapCard label="Good (2)" field="receptionGood" val={row.receptionGood} color="bg-blue-600" onTap={tap} />
            <TapCard label="OK (1)" field="receptionOk" val={row.receptionOk} color="bg-amber-600" onTap={tap} />
            <TapCard label="Error (0)" field="receptionError" val={row.receptionError} color="bg-red-600" onTap={tap} />
          </div>
          {/* FIVB: Reception attempt auto-computed */}
          <FIVBComputed
            label="Total Receptions (auto)"
            value={String(recTotal)}
            extra={recTotal > 0
              ? `Pass Eff: ${((3 * row.receptionPerfect + 2 * row.receptionGood + row.receptionOk) / recTotal).toFixed(2)}`
              : undefined}
          />
        </CollapsibleGroup>

        {/* BLOCK */}
        <CollapsibleGroup groupKey="BLK" label="Block" open={openGroups.has('BLK')} onToggle={() => toggleGroup('BLK')}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <TapCard label="Solo" field="blockSolo" val={row.blockSolo} color="bg-green-600" onTap={tap} />
            <TapCard label="Assist" field="blockAssist" val={row.blockAssist} color="bg-blue-600" onTap={tap} />
            <TapCard label="Error" field="blockError" val={row.blockError} color="bg-red-600" onTap={tap} />
            <TapCard label="Rebound" field="blockRebound" val={row.blockRebound} color="bg-gray-600" onTap={tap} />
          </div>
          <FIVBComputed
            label="Block Points"
            value={`${blockPoints(row.blockSolo, row.blockAssist).toFixed(1)} pts`}
            extra="BS=1pt, BA=0.5pt (FIVB)"
          />
        </CollapsibleGroup>

        {/* DIG + FREEBALL */}
        <CollapsibleGroup groupKey="DIG" label="Dig & Freeball" open={openGroups.has('DIG')} onToggle={() => toggleGroup('DIG')}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <TapCard label="Dig" field="dig" val={row.dig} color="bg-cyan-600" onTap={tap} />
            <TapCard label="Dig Error" field="digError" val={row.digError} color="bg-red-600" onTap={tap} />
            <TapCard label="Dig Att" field="digAttempt" val={row.digAttempt} color="bg-gray-600" onTap={tap} />
          </div>
          {/* FIVB Freeball — tracked separately */}
          <div className="mt-2 pt-2 border-t border-[rgb(var(--border-soft))]">
            <div className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">Freeball (FIVB)</div>
            <div className="grid grid-cols-2 gap-2">
              <TapCard label="FB Dig" field="freeballDig" val={row.freeballDig ?? 0} color="bg-cyan-700" onTap={tap} />
              <TapCard label="FB Error" field="freeballError" val={row.freeballError ?? 0} color="bg-red-700" onTap={tap} />
            </div>
          </div>
        </CollapsibleGroup>

        {/* SET */}
        <CollapsibleGroup groupKey="SET" label="Set" open={openGroups.has('SET')} onToggle={() => toggleGroup('SET')}>
          <div className="grid grid-cols-2 gap-2">
            <TapCard label="Assist" field="setAssist" val={row.setAssist} color="bg-amber-600" onTap={tap} />
            <TapCard label="BHE" field="setBallHandlingError" val={row.setBallHandlingError} color="bg-red-600" onTap={tap} />
          </div>
          {/* FIVB: Set attempt = Assist + BHE (auto-computed) */}
          <FIVBComputed
            label="Set Attempts (auto)"
            value={String(setTot)}
            extra={setTot > 0 ? `Set Eff: ${((row.setAssist / setTot) * 100).toFixed(1)}%` : undefined}
          />
        </CollapsibleGroup>
      </div>
    </div>
  )
}

// ─── Collapsible stat group wrapper ──────────────────────────────────────────

function CollapsibleGroup({
  groupKey, label, open, onToggle, children,
}: {
  groupKey: StatGroupKey
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('border rounded-xl overflow-hidden', GROUP_BG[groupKey])}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2"
      >
        <span className={cn('text-xs font-bold uppercase tracking-wider', GROUP_COLORS[groupKey])}>
          {label}
        </span>
        {open ? <ChevronUp size={14} className="text-[rgb(var(--muted-fg))]" /> : <ChevronDown size={14} className="text-[rgb(var(--muted-fg))]" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  )
}

// ─── FIVB auto-computed row ───────────────────────────────────────────────────

function FIVBComputed({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))]">
      <span className="text-[10px] text-[rgb(var(--muted-fg))]">{label}</span>
      <div className="flex items-center gap-2">
        {extra && <span className="text-[10px] text-[rgb(var(--muted-fg))] opacity-70">{extra}</span>}
        <span className="text-xs font-bold tabular-nums">{value}</span>
      </div>
    </div>
  )
}

// ─── Tap card (replaces old TapGroup) ────────────────────────────────────────

function TapCard({
  label, field, val, color, onTap,
}: {
  label: string
  field: StatField
  val: number
  color: string
  onTap: (field: StatField, delta: number) => void
}) {
  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-[rgb(var(--border-soft))] select-none">
      <div className="text-center text-[10px] font-semibold text-[rgb(var(--muted-fg))] py-1 bg-[rgb(var(--bg))]">
        {label}
      </div>
      <div className="flex">
        <button
          onClick={() => onTap(field, -1)}
          className="flex-1 py-2.5 bg-black/20 hover:bg-black/40 text-white font-bold text-base flex items-center justify-center transition-colors active:scale-95"
        >
          −
        </button>
        <div className={cn('flex-[2] py-2.5 flex items-center justify-center font-bold text-lg text-white tabular-nums', color)}>
          {val}
        </div>
        <button
          onClick={() => onTap(field, 1)}
          className={cn('flex-1 py-2.5 hover:brightness-110 text-white font-bold text-base flex items-center justify-center transition-colors active:scale-95', color)}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Team Cards (compact player roster with jersey quick-select) ──────────────

function LiveTeamCards({
  teamName, players, selectedSet, getStatRow, onTap,
  activePlayerId, onSelectPlayer, dbPlayerIds, conflicts,
}: {
  teamName: string
  players: (Player & { teamId: string })[]
  selectedSet: number
  getStatRow: (id: string, set: number) => PlayerStatRow
  onTap: (id: string, teamId: string, field: StatField, delta: number) => void
  activePlayerId: string | null
  onSelectPlayer: (id: string | null) => void
  dbPlayerIds: Record<string, number>
  conflicts: Set<string>
}) {
  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
      {/* Team header */}
      <div className="px-4 py-2.5 border-b border-[rgb(var(--border))] flex items-center justify-between">
        <h3 className="text-sm font-bold">{teamName}</h3>
        <span className="text-xs text-[rgb(var(--muted-fg))]">{players.length} players</span>
      </div>

      {/* Jersey quick-select bar */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))]">
        {players.map(p => {
          const dbId = dbPlayerIds[p.id]
          const hasConflict = dbId !== undefined && conflicts.size > 0 &&
            [...conflicts].some(k => k.startsWith(String(dbId) + '-'))
          return (
            <button
              key={p.id}
              onClick={() => onSelectPlayer(activePlayerId === p.id ? null : p.id)}
              className={cn(
                'relative px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                activePlayerId === p.id
                  ? 'bg-blue-600 text-white scale-110 shadow-lg'
                  : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:border-blue-500/40',
              )}
            >
              #{p.jerseyNumber ?? '?'}
              {hasConflict && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Player rows — compact, no horizontal scroll */}
      <div className="divide-y divide-[rgb(var(--border-soft))]">
        {players.map(p => {
          const row = getStatRow(p.id, selectedSet)
          const isActive = activePlayerId === p.id
          const pts = pointsTotal(row.attackKill, row.serveAce, row.blockSolo, row.blockAssist)

          return (
            <div
              key={p.id}
              className={cn(
                'px-3 py-2.5 transition-colors',
                isActive ? 'bg-blue-500/10' : 'hover:bg-[rgb(var(--surface-hover))]'
              )}
            >
              {/* Player name row */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => onSelectPlayer(isActive ? null : p.id)}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs font-mono font-bold text-[rgb(var(--muted-fg))]">
                    #{p.jerseyNumber ?? '?'}
                  </span>
                  <span className="text-sm font-semibold">{p.name}</span>
                  {isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded-full">active</span>
                  )}
                </button>
                {/* Quick stat summary */}
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-green-400 font-bold">{row.attackKill}K</span>
                  <span className="text-blue-400 font-bold">{row.serveAce}A</span>
                  <span className="text-purple-400 font-bold">{blockPoints(row.blockSolo, row.blockAssist).toFixed(1)}B</span>
                  <span className="text-amber-400 font-bold">{pts}pts</span>
                </div>
              </div>

              {/* Compact inline tap buttons — 2 rows × 3 groups, no overflow */}
              <div className="grid grid-cols-3 gap-1.5">
                <CompactTapGroup
                  label="ATK"
                  groupKey="ATK"
                  buttons={[
                    { label: 'K', field: 'attackKill' as StatField, val: row.attackKill, color: 'bg-green-700' },
                    { label: 'E', field: 'attackError' as StatField, val: row.attackError, color: 'bg-red-700' },
                    { label: '0', field: 'attackAttempt' as StatField, val: row.attackAttempt, color: 'bg-gray-700' },
                  ]}
                  onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)}
                />
                <CompactTapGroup
                  label="SRV"
                  groupKey="SRV"
                  buttons={[
                    { label: 'A', field: 'serveAce' as StatField, val: row.serveAce, color: 'bg-green-700' },
                    { label: 'E', field: 'serveError' as StatField, val: row.serveError, color: 'bg-red-700' },
                    { label: 'In', field: 'serveAttempt' as StatField, val: row.serveAttempt, color: 'bg-gray-700' },
                  ]}
                  onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)}
                />
                <CompactTapGroup
                  label="RCV"
                  groupKey="RCV"
                  buttons={[
                    { label: '3', field: 'receptionPerfect' as StatField, val: row.receptionPerfect, color: 'bg-emerald-700' },
                    { label: '2', field: 'receptionGood' as StatField, val: row.receptionGood, color: 'bg-blue-700' },
                    { label: '1', field: 'receptionOk' as StatField, val: row.receptionOk, color: 'bg-amber-700' },
                    { label: '0', field: 'receptionError' as StatField, val: row.receptionError, color: 'bg-red-700' },
                  ]}
                  onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)}
                />
                <CompactTapGroup
                  label="BLK"
                  groupKey="BLK"
                  buttons={[
                    { label: 'BS', field: 'blockSolo' as StatField, val: row.blockSolo, color: 'bg-purple-700' },
                    { label: 'BA', field: 'blockAssist' as StatField, val: row.blockAssist, color: 'bg-purple-800' },
                    { label: 'BE', field: 'blockError' as StatField, val: row.blockError, color: 'bg-red-700' },
                  ]}
                  onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)}
                />
                <CompactTapGroup
                  label="DIG"
                  groupKey="DIG"
                  buttons={[
                    { label: 'D', field: 'dig' as StatField, val: row.dig, color: 'bg-cyan-700' },
                    { label: 'DE', field: 'digError' as StatField, val: row.digError, color: 'bg-red-700' },
                    { label: 'FB', field: 'freeballDig' as StatField, val: row.freeballDig ?? 0, color: 'bg-cyan-800' },
                  ]}
                  onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)}
                />
                <CompactTapGroup
                  label="SET"
                  groupKey="SET"
                  buttons={[
                    { label: 'Ast', field: 'setAssist' as StatField, val: row.setAssist, color: 'bg-amber-700' },
                    { label: 'BHE', field: 'setBallHandlingError' as StatField, val: row.setBallHandlingError, color: 'bg-red-700' },
                  ]}
                  onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)}
                />
              </div>
            </div>
          )
        })}
        {players.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[rgb(var(--muted-fg))]">No players on this team</div>
        )}
      </div>
    </div>
  )
}

// ─── Compact tap group for the player card grid ───────────────────────────────

function CompactTapGroup({
  label, groupKey, buttons, onTap,
}: {
  label: string
  groupKey: StatGroupKey
  buttons: { label: string; field: StatField; val: number; color: string }[]
  onTap: (field: StatField, delta: number) => void
}) {
  return (
    <div className={cn('rounded-lg border overflow-hidden', GROUP_BG[groupKey])}>
      <div className={cn('text-center text-[9px] font-bold uppercase tracking-wider py-0.5', GROUP_COLORS[groupKey])}>
        {label}
      </div>
      <div className="flex flex-wrap gap-px p-0.5 bg-[rgb(var(--border-soft))]">
        {buttons.map(b => (
          <button
            key={b.field}
            onClick={() => onTap(b.field, 1)}
            onContextMenu={(e) => { e.preventDefault(); onTap(b.field, -1) }}
            className={cn(
              'flex-1 min-w-[28px] py-1.5 rounded text-white text-[10px] font-bold flex flex-col items-center justify-center gap-0 transition-all active:scale-95',
              b.color,
            )}
            title={`Tap: +1 ${b.label} | Right-click: -1`}
          >
            <span>{b.label}</span>
            {b.val > 0 && <span className="text-[9px] opacity-80">{b.val}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Stat Tables (unchanged structure, minor FIVB column additions) ───────────

function StatTable({
  subTab, players, teamFilter, setTeamFilter, viewMode, setViewMode,
  selectedSet, getStatRow, getCumulativeRow, selectedMatch, onSort, sortCol, sortDir,
}: {
  subTab: SubTab
  players: (Player & { teamId: string; teamName: string })[]
  teamFilter: 'all' | 'A' | 'B'
  setTeamFilter: (f: 'all' | 'A' | 'B') => void
  viewMode: 'perSet' | 'cumulative'
  setViewMode: (m: 'perSet' | 'cumulative') => void
  selectedSet: number
  getStatRow: (playerId: string, setNum: number) => PlayerStatRow
  getCumulativeRow: (playerId: string) => PlayerStatRow
  selectedMatch: { teamAId: string; teamBId: string } | undefined
  onSort: (col: string) => void
  sortCol: string
  sortDir: 'asc' | 'desc'
}) {
  const columns = getColumnsForTab(subTab)

  const filteredPlayers = teamFilter === 'A'
    ? players.filter(p => p.teamId === selectedMatch?.teamAId)
    : teamFilter === 'B'
      ? players.filter(p => p.teamId === selectedMatch?.teamBId)
      : players

  const teamAgg = aggregateTeamStats(
    filteredPlayers.map(p => viewMode === 'perSet' ? getStatRow(p.id, selectedSet) : getCumulativeRow(p.id))
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1">
          {(['all', 'A', 'B'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTeamFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                teamFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))]'
              )}
            >
              {f === 'all' ? 'Both' : `Team ${f}`}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['perSet', 'cumulative'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                viewMode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))]'
              )}
            >
              {m === 'perSet' ? 'Per Set' : 'Cumulative'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              {columns.some(c => c.group) && (
                <tr className="border-b border-[rgb(var(--border-soft))]">
                  <th className="sticky left-0 bg-[rgb(var(--surface))] z-10" />
                  {columns.map((col, i) => {
                    const prevGroup = i > 0 ? columns[i - 1].group : undefined
                    const isFirstInGroup = col.group !== prevGroup
                    return (
                      <th
                        key={col.key}
                        className={cn(
                          'px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-center',
                          isFirstInGroup && 'border-l-2 border-[rgb(var(--border-strong))]',
                          col.group === 'ATK' && 'text-green-500',
                          col.group === 'SRV' && 'text-blue-500',
                          col.group === 'RCV' && 'text-emerald-500',
                          col.group === 'BLK' && 'text-purple-500',
                          col.group === 'SET' && 'text-amber-500',
                          col.group === 'DIG' && 'text-cyan-500',
                          col.group === 'PTS' && 'text-orange-500',
                        )}
                      >
                        {isFirstInGroup ? col.group : ''}
                      </th>
                    )
                  })}
                </tr>
              )}
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))] sticky left-0 bg-[rgb(var(--surface))] z-10 min-w-[150px]">
                  # / Name
                </th>
                {columns.map((col, i) => {
                  const prevGroup = i > 0 ? columns[i - 1].group : undefined
                  const isFirstInGroup = col.group !== prevGroup
                  return (
                    <th
                      key={col.key}
                      onClick={() => onSort(col.sortKey ?? col.key)}
                      className={cn(
                        'px-2 py-2.5 font-semibold text-[rgb(var(--muted-fg))] cursor-pointer hover:text-[rgb(var(--fg))] whitespace-nowrap',
                        isFirstInGroup && col.group && 'border-l-2 border-[rgb(var(--border-strong))]',
                      )}
                    >
                      <span className="flex items-center gap-1 justify-center">
                        {col.label}
                        {sortCol === (col.sortKey ?? col.key) && (
                          <ArrowUpDown size={10} className={sortDir === 'asc' ? 'rotate-180' : ''} />
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((p, idx) => {
                const row = viewMode === 'perSet' ? getStatRow(p.id, selectedSet) : getCumulativeRow(p.id)
                return (
                  <tr key={p.id} className={cn(
                    'border-b border-[rgb(var(--border-soft))]',
                    idx % 2 !== 0 && 'bg-[rgb(var(--surface-hover))]'
                  )}>
                    <td className="px-3 py-2 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                      <span className="text-[rgb(var(--muted-fg))] mr-1.5 font-mono">#{p.jerseyNumber ?? '?'}</span>
                      <span className="font-medium">{p.name}</span>
                    </td>
                    {columns.map((col, i) => {
                      const prevGroup = i > 0 ? columns[i - 1].group : undefined
                      const isFirstInGroup = col.group !== prevGroup
                      return (
                        <td key={col.key} className={cn(
                          'px-2 py-2 text-center font-mono',
                          isFirstInGroup && col.group && 'border-l-2 border-[rgb(var(--border-strong))]',
                        )}>
                          {col.compute(row)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[rgb(var(--border-strong))] bg-[rgb(var(--bg))] font-bold">
                <td className="px-3 py-2.5 sticky left-0 bg-[rgb(var(--bg))] z-10 text-sm">Team Total</td>
                {columns.map((col, i) => {
                  const prevGroup = i > 0 ? columns[i - 1].group : undefined
                  const isFirstInGroup = col.group !== prevGroup
                  return (
                    <td key={col.key} className={cn(
                      'px-2 py-2.5 text-center font-mono',
                      isFirstInGroup && col.group && 'border-l-2 border-[rgb(var(--border-strong))]',
                    )}>
                      {col.compute(teamAgg)}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

type Column = {
  key: string
  label: string
  sortKey?: string
  group?: string
  compute: (row: PlayerStatRow) => string
}

function getColumnsForTab(tab: SubTab): Column[] {
  switch (tab) {
    case 'all':
      return [
        { key: 'attackKill',      label: 'K',    group: 'ATK', compute: r => String(r.attackKill) },
        { key: 'attackError',     label: 'E',    group: 'ATK', compute: r => String(r.attackError) },
        { key: 'attackTotalAll',  label: 'Att',  group: 'ATK', compute: r => String(attackTotal(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'killPctAll',      label: 'K%',   group: 'ATK', sortKey: 'attackKill', compute: r => fmtPct(killPct(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'effAll',          label: 'Eff',  group: 'ATK', sortKey: 'attackKill', compute: r => fmtEff(attackEfficiency(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'serveAceAll',     label: 'SA',   group: 'SRV', compute: r => String(r.serveAce) },
        { key: 'serveErrorAll',   label: 'SE',   group: 'SRV', compute: r => String(r.serveError) },
        { key: 'serveTotalAll',   label: 'Att',  group: 'SRV', compute: r => String(serveTotal(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'acePctAll',       label: 'A%',   group: 'SRV', sortKey: 'serveAce', compute: r => fmtPct(serveAcePct(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'recPerfAll',      label: '3',    group: 'RCV', compute: r => String(r.receptionPerfect) },
        { key: 'recGoodAll',      label: '2',    group: 'RCV', compute: r => String(r.receptionGood) },
        { key: 'recOkAll',        label: '1',    group: 'RCV', compute: r => String(r.receptionOk) },
        { key: 'recErrAll',       label: '0',    group: 'RCV', compute: r => String(r.receptionError) },
        { key: 'recTotalAll',     label: 'Tot',  group: 'RCV', compute: r => String(receptionTotal(r.receptionPerfect, r.receptionGood, r.receptionOk, r.receptionError)) },
        { key: 'passEffAll',      label: 'Eff',  group: 'RCV', sortKey: 'receptionPerfect', compute: r => fmt2(passEfficiency(r.receptionPerfect, r.receptionGood, r.receptionOk, r.receptionError)) },
        { key: 'blockSoloAll',    label: 'BS',   group: 'BLK', compute: r => String(r.blockSolo) },
        { key: 'blockAssistAll',  label: 'BA',   group: 'BLK', compute: r => String(r.blockAssist) },
        { key: 'blockErrorAll',   label: 'BE',   group: 'BLK', compute: r => String(r.blockError) },
        { key: 'blockTotalAll',   label: 'Pts',  group: 'BLK', sortKey: 'blockSolo', compute: r => fmt2(blockTotal(r.blockSolo, r.blockAssist)) },
        { key: 'setAssistAll',    label: 'Ast',  group: 'SET', compute: r => String(r.setAssist) },
        { key: 'setBHEAll',       label: 'BHE',  group: 'SET', compute: r => String(r.setBallHandlingError) },
        { key: 'setTotAll',       label: 'Att',  group: 'SET', compute: r => String(setTotal(r.setAssist, r.setBallHandlingError)) },
        { key: 'setEffAll',       label: 'Eff',  group: 'SET', sortKey: 'setAssist', compute: r => fmtPct(setEfficiency(r.setAssist, r.setBallHandlingError)) },
        { key: 'digAll',          label: 'D',    group: 'DIG', compute: r => String(r.dig) },
        { key: 'digErrorAll',     label: 'DE',   group: 'DIG', compute: r => String(r.digError) },
        { key: 'fbDigAll',        label: 'FB',   group: 'DIG', compute: r => String(r.freeballDig ?? 0) },
        { key: 'digSuccAll',      label: 'D%',   group: 'DIG', sortKey: 'dig', compute: r => fmtPct(digSuccessRate(r.dig, r.digError, r.digAttempt)) },
        { key: 'ptsAll',          label: 'PTS',  group: 'PTS', sortKey: 'attackKill', compute: r => String(pointsTotal(r.attackKill, r.serveAce, r.blockSolo, r.blockAssist)) },
      ]
    case 'attack':
      return [
        { key: 'attackKill',    label: 'K',     compute: r => String(r.attackKill) },
        { key: 'attackError',   label: 'E',     compute: r => String(r.attackError) },
        { key: 'attackAttempt', label: 'In',    compute: r => String(r.attackAttempt) },
        { key: 'attackTotal',   label: 'Total', compute: r => String(attackTotal(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'killPct',       label: 'Kill%', sortKey: 'attackKill', compute: r => fmtPct(killPct(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'eff',           label: 'Eff',   sortKey: 'attackKill', compute: r => fmtEff(attackEfficiency(r.attackKill, r.attackError, r.attackAttempt)) },
      ]
    case 'serve':
      return [
        { key: 'serveAce',    label: 'SA',    compute: r => String(r.serveAce) },
        { key: 'serveError',  label: 'SE',    compute: r => String(r.serveError) },
        { key: 'serveAttempt',label: 'In',    compute: r => String(r.serveAttempt) },
        { key: 'serveTotal',  label: 'Total', compute: r => String(serveTotal(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'acePct',      label: 'Ace%',  sortKey: 'serveAce',   compute: r => fmtPct(serveAcePct(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'errPct',      label: 'Err%',  sortKey: 'serveError', compute: r => fmtPct(serveErrorPct(r.serveAce, r.serveError, r.serveAttempt)) },
      ]
    case 'reception':
      return [
        { key: 'receptionPerfect', label: '3 (P)',  compute: r => String(r.receptionPerfect) },
        { key: 'receptionGood',    label: '2 (G)',  compute: r => String(r.receptionGood) },
        { key: 'receptionOk',      label: '1 (OK)', compute: r => String(r.receptionOk) },
        { key: 'receptionError',   label: '0 (E)',  compute: r => String(r.receptionError) },
        { key: 'recTotal',         label: 'Total',  compute: r => String(receptionTotal(r.receptionPerfect, r.receptionGood, r.receptionOk, r.receptionError)) },
        { key: 'passEff',          label: 'Eff',    sortKey: 'receptionPerfect', compute: r => fmt2(passEfficiency(r.receptionPerfect, r.receptionGood, r.receptionOk, r.receptionError)) },
      ]
    case 'block':
      return [
        { key: 'blockSolo',   label: 'BS',    compute: r => String(r.blockSolo) },
        { key: 'blockAssist', label: 'BA',    compute: r => String(r.blockAssist) },
        { key: 'blockError',  label: 'BE',    compute: r => String(r.blockError) },
        { key: 'blockRebound',label: 'BR',    compute: r => String(r.blockRebound) },
        { key: 'blockTotal',  label: 'Pts',   sortKey: 'blockSolo', compute: r => fmt2(blockTotal(r.blockSolo, r.blockAssist)) },
      ]
    case 'set':
      return [
        { key: 'setAssist',           label: 'Ast',   compute: r => String(r.setAssist) },
        { key: 'setBallHandlingError', label: 'BHE',  compute: r => String(r.setBallHandlingError) },
        { key: 'setTotal',            label: 'Att',   compute: r => String(setTotal(r.setAssist, r.setBallHandlingError)) },
        { key: 'setEff',              label: 'Eff',   sortKey: 'setAssist', compute: r => fmtPct(setEfficiency(r.setAssist, r.setBallHandlingError)) },
      ]
    case 'dig':
      return [
        { key: 'dig',         label: 'D',     compute: r => String(r.dig) },
        { key: 'digError',    label: 'DE',    compute: r => String(r.digError) },
        { key: 'digAttempt',  label: 'Att',   compute: r => String(r.digAttempt) },
        { key: 'freeballDig', label: 'FB',    compute: r => String(r.freeballDig ?? 0) },
        { key: 'fbError',     label: 'FBE',   compute: r => String(r.freeballError ?? 0) },
        { key: 'digSucc',     label: 'D%',    sortKey: 'dig', compute: r => fmtPct(digSuccessRate(r.dig, r.digError, r.digAttempt)) },
      ]
    case 'points':
      return [
        { key: 'attackKill',     label: 'K',      compute: r => String(r.attackKill) },
        { key: 'serveAce',       label: 'SA',     compute: r => String(r.serveAce) },
        { key: 'blockSolo',      label: 'BS',     compute: r => String(r.blockSolo) },
        { key: 'blockAssistHalf',label: 'BA×.5',  compute: r => fmt2(r.blockAssist * 0.5) },
        { key: 'pts',            label: 'PTS',    sortKey: 'attackKill', compute: r => String(pointsTotal(r.attackKill, r.serveAce, r.blockSolo, r.blockAssist)) },
      ]
    default:
      return []
  }
}
