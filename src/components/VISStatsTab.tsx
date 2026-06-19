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
  setEfficiency,
  setTotal,
  digSuccessRate,
  blockTotal,
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
import { Undo2, ArrowUpDown, Save, Loader2, Check } from 'lucide-react'

type SubTab = 'live' | 'all' | 'attack' | 'serve' | 'reception' | 'block' | 'set' | 'dig' | 'points'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'live', label: 'Live Entry' },
  { key: 'all', label: 'All Stats' },
  { key: 'attack', label: 'Attack' },
  { key: 'serve', label: 'Serve' },
  { key: 'reception', label: 'Reception' },
  { key: 'block', label: 'Block' },
  { key: 'set', label: 'Set' },
  { key: 'dig', label: 'Dig' },
  { key: 'points', label: 'Points' },
]

const EMPTY_ROW = (): PlayerStatRow => ({
  attackKill: 0, attackError: 0, attackAttempt: 0,
  serveAce: 0, serveError: 0, serveAttempt: 0,
  receptionPerfect: 0, receptionGood: 0, receptionOk: 0, receptionError: 0,
  setAssist: 0, setAttempt: 0, setBallHandlingError: 0,
  blockSolo: 0, blockAssist: 0, blockError: 0, blockRebound: 0,
  dig: 0, digError: 0, digAttempt: 0,
  receiveAttempt: 0,
})

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function VISStatsTab({ state, tournamentId }: { state: TournamentState; tournamentId: string }) {
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [selectedSet, setSelectedSet] = useState(1)
  const [teamFilter, setTeamFilter] = useState<'all' | 'A' | 'B'>('all')
  const [viewMode, setViewMode] = useState<'perSet' | 'cumulative'>('cumulative')
  const [stats, setStats] = useState<Record<string, Record<number, PlayerStatRow>>>({})
  const [sortCol, setSortCol] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [undoing, setUndoing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savingAll, setSavingAll] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Resolve each tournament player to a global players.id so stat taps reference a real
  // DB row (the player_stats FK). Resolution is idempotent and cached per tournament player id.
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
        } catch { /* ignore — tap will be skipped until resolved */ }
      }
    }
    resolveAll()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersForMatch])

  useEffect(() => {
    if (!selectedMatchId) return
    // Wait until every player in the match has resolved to a DB integer id. The stats map is
    // keyed by DB id, so loading before resolution would key rows the lookups can't reach.
    const unresolvedCount = playersForMatch.filter(p => dbPlayerIds[p.id] === undefined).length
    if (unresolvedCount > 0) return
    const load = async () => {
      try {
        const data = await getPlayerStats({ data: { matchId: selectedMatchId } })
        // Key by the stringified DB integer id (row.playerId) so reloads repopulate the
        // display through the same dbPlayerIds bridge the lookups use.
        const map: Record<string, Record<number, PlayerStatRow>> = {}
        for (const row of data) {
          const key = String(row.playerId)
          if (!map[key]) map[key] = {}
          map[key][row.setNumber] = row as any
        }
        setStats(map)
      } catch { /* ignore */ }
    }
    load()
  }, [selectedMatchId, dbPlayerIds, playersForMatch])

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
    if (dbPlayerId === undefined) return // not yet resolved; ignore the tap until the DB id is known
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
  }, [selectedMatchId, selectedSet, dbPlayerIds])

  const handleUndo = useCallback(async () => {
    if (!selectedMatchId) return
    setUndoing(true)
    try {
      await undoLastStat({ data: { matchId: selectedMatchId } })
      const data = await getPlayerStats({ data: { matchId: selectedMatchId } })
      const map: Record<string, Record<number, PlayerStatRow>> = {}
      for (const row of data) {
        const key = String(row.playerId)
        if (!map[key]) map[key] = {}
        map[key][row.setNumber] = row as any
      }
      setStats(map)
    } catch { /* ignore */ }
    setUndoing(false)
  }, [selectedMatchId])

  // Manual "Save All" — re-syncs every player × set in the current optimistic state to the DB
  // using ABSOLUTE values. Each tap is already persisted via handleTap (which increments), so
  // this must overwrite rather than add — otherwise it would double the stored stats.
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
  }, [selectedMatchId, playersForMatch, dbPlayerIds, stats])

  // Warn before leaving while a save is in flight or after a failure, so taps entered mid-match
  // are not lost to an accidental tab close or navigation.
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
        <div className="text-center py-16 text-[rgb(var(--muted-fg))] text-sm">
          Select a match to begin entering stats.
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

// ─── Live Entry Panel ──────────────────────────────────────────

function LiveEntryPanel({
  players, selectedSet, onTap, onUndo, undoing, getStatRow, state, selectedMatch,
  onSaveAll, savingAll, saveStatus,
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
}) {
  const teamAPlayers = players.filter(p => p.teamId === selectedMatch?.teamAId)
  const teamBPlayers = players.filter(p => p.teamId === selectedMatch?.teamBId)
  const teamAName = state.teams.find(t => t.id === selectedMatch?.teamAId)?.name ?? 'Team A'
  const teamBName = state.teams.find(t => t.id === selectedMatch?.teamBId)?.name ?? 'Team B'

  const pill = saveStatus === 'error'
    ? { dot: 'bg-red-500', label: 'Save failed — tap Save All', spin: false, text: 'text-red-400' }
    : saveStatus === 'saving'
      ? { dot: 'bg-amber-500', label: 'Saving...', spin: true, text: 'text-amber-400' }
      : { dot: 'bg-gray-400', label: 'Saved', spin: false, text: 'text-[rgb(var(--muted-fg))]' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wider">
          Set {selectedSet} — Live Entry
        </span>
        <div className="flex items-center gap-2">
          {/* Save status pill */}
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

      <div className="space-y-4">
        <LiveTeamColumn
          teamName={teamAName}
          players={teamAPlayers}
          selectedSet={selectedSet}
          getStatRow={getStatRow}
          onTap={onTap}
        />
        <LiveTeamColumn
          teamName={teamBName}
          players={teamBPlayers}
          selectedSet={selectedSet}
          getStatRow={getStatRow}
          onTap={onTap}
        />
      </div>
    </div>
  )
}

function LiveTeamColumn({
  teamName, players, selectedSet, getStatRow, onTap,
}: {
  teamName: string
  players: (Player & { teamId: string })[]
  selectedSet: number
  getStatRow: (playerId: string, setNum: number) => PlayerStatRow
  onTap: (playerId: string, teamId: string, field: StatField, delta: number) => void
}) {
  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <h3 className="text-sm font-bold">{teamName}</h3>
      </div>
      <div className="overflow-x-auto">
        <div className="divide-y divide-[rgb(var(--border-soft))] min-w-max">
          {players.map(p => {
            const row = getStatRow(p.id, selectedSet)
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex items-center gap-2 w-36 shrink-0 sticky left-0 bg-[rgb(var(--surface))] z-10 pr-2">
                  <span className="text-xs font-mono font-bold text-[rgb(var(--muted-fg))]">
                    #{p.jerseyNumber ?? '?'}
                  </span>
                  <span className="text-sm font-semibold truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TapGroup label="ATK" buttons={[
                    { label: 'K+', field: 'attackKill' as StatField, color: 'bg-green-600 hover:bg-green-500', val: row.attackKill },
                    { label: 'E+', field: 'attackError' as StatField, color: 'bg-red-600 hover:bg-red-500', val: row.attackError },
                    { label: '0+', field: 'attackAttempt' as StatField, color: 'bg-gray-600 hover:bg-gray-500', val: row.attackAttempt },
                  ]} onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)} />
                  <TapGroup label="SRV" buttons={[
                    { label: 'A+', field: 'serveAce' as StatField, color: 'bg-green-600 hover:bg-green-500', val: row.serveAce },
                    { label: 'E+', field: 'serveError' as StatField, color: 'bg-red-600 hover:bg-red-500', val: row.serveError },
                    { label: 'In', field: 'serveAttempt' as StatField, color: 'bg-gray-600 hover:bg-gray-500', val: row.serveAttempt },
                  ]} onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)} />
                  <TapGroup label="RCV" buttons={[
                    { label: '3', field: 'receptionPerfect' as StatField, color: 'bg-emerald-600 hover:bg-emerald-500', val: row.receptionPerfect },
                    { label: '2', field: 'receptionGood' as StatField, color: 'bg-blue-600 hover:bg-blue-500', val: row.receptionGood },
                    { label: '1', field: 'receptionOk' as StatField, color: 'bg-amber-600 hover:bg-amber-500', val: row.receptionOk },
                    { label: '0', field: 'receptionError' as StatField, color: 'bg-red-600 hover:bg-red-500', val: row.receptionError },
                  ]} onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)} />
                  <TapGroup label="BLK" buttons={[
                    { label: 'BS+', field: 'blockSolo' as StatField, color: 'bg-green-600 hover:bg-green-500', val: row.blockSolo },
                    { label: 'BA+', field: 'blockAssist' as StatField, color: 'bg-blue-600 hover:bg-blue-500', val: row.blockAssist },
                    { label: 'BE+', field: 'blockError' as StatField, color: 'bg-red-600 hover:bg-red-500', val: row.blockError },
                    { label: 'BR+', field: 'blockRebound' as StatField, color: 'bg-gray-600 hover:bg-gray-500', val: row.blockRebound },
                  ]} onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)} />
                  <TapGroup label="DIG" buttons={[
                    { label: 'D+', field: 'dig' as StatField, color: 'bg-green-600 hover:bg-green-500', val: row.dig },
                    { label: 'DE+', field: 'digError' as StatField, color: 'bg-red-600 hover:bg-red-500', val: row.digError },
                    { label: 'DA+', field: 'digAttempt' as StatField, color: 'bg-gray-600 hover:bg-gray-500', val: row.digAttempt },
                  ]} onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)} />
                  <TapGroup label="SET" buttons={[
                    { label: 'A+', field: 'setAssist' as StatField, color: 'bg-green-600 hover:bg-green-500', val: row.setAssist },
                    { label: 'BHE+', field: 'setBallHandlingError' as StatField, color: 'bg-red-600 hover:bg-red-500', val: row.setBallHandlingError },
                  ]} onTap={(field, delta) => onTap(p.id, p.teamId, field, delta)} />
                </div>
              </div>
            )
          })}
          {players.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[rgb(var(--muted-fg))]">No players on this team</div>
          )}
        </div>
      </div>
    </div>
  )
}

function TapGroup({
  label,
  buttons,
  onTap,
}: {
  label: string
  buttons: { label: string; field: StatField; color: string; val: number }[]
  onTap: (field: StatField, delta: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5 pr-2 border-r border-[rgb(var(--border-soft))] last:border-r-0 last:pr-0">
      <span className="text-[9px] font-bold text-[rgb(var(--muted-fg))] w-7 text-right mr-0.5">{label}</span>
      {buttons.map(b => (
        <div key={b.field} className="flex items-stretch">
          <button
            onClick={() => onTap(b.field, -1)}
            className="w-6 h-8 rounded-l-lg bg-black/20 hover:bg-black/40 text-white text-sm font-bold flex items-center justify-center"
            aria-label={`Subtract ${b.label}`}
          >
            −
          </button>
          <button
            onClick={() => onTap(b.field, 1)}
            className={cn(
              'min-w-[36px] h-8 px-1 rounded-r-lg text-white text-xs font-bold flex flex-col items-center justify-center gap-0 transition-colors',
              b.color,
            )}
            aria-label={`Add ${b.label}`}
          >
            <span className="text-[10px] leading-none">{b.label}</span>
            {b.val > 0 && (
              <span className="text-[9px] leading-none opacity-80">{b.val}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Tables (Attack, Serve, etc.) ────────────────────────

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

  // Team filter compares against the actual tournament team UUIDs carried on each player.
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
              {/* Team aggregate row */}
              <tr className="border-t-2 border-[rgb(var(--border-strong))] bg-[rgb(var(--bg))] font-bold">
                <td className="px-3 py-2.5 sticky left-0 bg-[rgb(var(--bg))] z-10 text-sm">
                  Team Total
                </td>
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
        // ATK
        { key: 'attackKill', label: 'K', group: 'ATK', compute: r => String(r.attackKill) },
        { key: 'attackError', label: 'E', group: 'ATK', compute: r => String(r.attackError) },
        { key: 'attackTotalAll', label: 'Att', group: 'ATK', compute: r => String(attackTotal(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'killPctAll', label: 'K%', group: 'ATK', sortKey: 'attackKill', compute: r => fmtPct(killPct(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'effAll', label: 'Eff', group: 'ATK', sortKey: 'attackKill', compute: r => fmtEff(attackEfficiency(r.attackKill, r.attackError, r.attackAttempt)) },
        // SRV
        { key: 'serveAceAll', label: 'SA', group: 'SRV', compute: r => String(r.serveAce) },
        { key: 'serveErrorAll', label: 'SE', group: 'SRV', compute: r => String(r.serveError) },
        { key: 'serveTotalAll', label: 'Att', group: 'SRV', compute: r => String(serveTotal(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'acePctAll', label: 'A%', group: 'SRV', sortKey: 'serveAce', compute: r => fmtPct(serveAcePct(r.serveAce, r.serveError, r.serveAttempt)) },
        // RCV
        { key: 'receptionPerfectAll', label: '3', group: 'RCV', compute: r => String(r.receptionPerfect) },
        { key: 'receptionGoodAll', label: '2', group: 'RCV', compute: r => String(r.receptionGood) },
        { key: 'receptionOkAll', label: '1', group: 'RCV', compute: r => String(r.receptionOk) },
        { key: 'receptionErrorAll', label: '0', group: 'RCV', compute: r => String(r.receptionError) },
        { key: 'passEffAll', label: 'Eff', group: 'RCV', sortKey: 'receptionPerfect', compute: r => fmt2(passEfficiency(r.receptionPerfect, r.receptionGood, r.receptionOk, r.receptionError)) },
        // BLK
        { key: 'blockSoloAll', label: 'BS', group: 'BLK', compute: r => String(r.blockSolo) },
        { key: 'blockAssistAll', label: 'BA', group: 'BLK', compute: r => String(r.blockAssist) },
        { key: 'blockErrorAll', label: 'BE', group: 'BLK', compute: r => String(r.blockError) },
        { key: 'blockTotalAll', label: 'Tot', group: 'BLK', sortKey: 'blockSolo', compute: r => fmt2(blockTotal(r.blockSolo, r.blockAssist)) },
        // SET
        { key: 'setAssistAll', label: 'Ast', group: 'SET', compute: r => String(r.setAssist) },
        { key: 'setBHEAll', label: 'BHE', group: 'SET', compute: r => String(r.setBallHandlingError) },
        { key: 'setEffAll', label: 'Eff', group: 'SET', sortKey: 'setAssist', compute: r => fmtPct(setEfficiency(r.setAssist, r.setBallHandlingError)) },
        // DIG
        { key: 'digAll', label: 'D', group: 'DIG', compute: r => String(r.dig) },
        { key: 'digErrorAll', label: 'DE', group: 'DIG', compute: r => String(r.digError) },
        { key: 'digSuccAll', label: 'Succ%', group: 'DIG', sortKey: 'dig', compute: r => fmtPct(digSuccessRate(r.dig, r.digError, r.digAttempt)) },
        // PTS
        { key: 'ptsAll', label: 'PTS', group: 'PTS', sortKey: 'attackKill', compute: r => String(pointsTotal(r.attackKill, r.serveAce, r.blockSolo, r.blockAssist)) },
      ]
    case 'attack':
      return [
        { key: 'attackKill', label: 'K', compute: r => String(r.attackKill) },
        { key: 'attackError', label: 'E', compute: r => String(r.attackError) },
        { key: 'attackAttempt', label: 'In', compute: r => String(r.attackAttempt) },
        { key: 'attackTotal', label: 'Total', compute: r => String(attackTotal(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'killPct', label: 'Kill%', sortKey: 'attackKill', compute: r => fmtPct(killPct(r.attackKill, r.attackError, r.attackAttempt)) },
        { key: 'eff', label: 'Eff', sortKey: 'attackKill', compute: r => fmtEff(attackEfficiency(r.attackKill, r.attackError, r.attackAttempt)) },
      ]
    case 'serve':
      return [
        { key: 'serveAce', label: 'SA', compute: r => String(r.serveAce) },
        { key: 'serveError', label: 'SE', compute: r => String(r.serveError) },
        { key: 'serveAttempt', label: 'In', compute: r => String(r.serveAttempt) },
        { key: 'serveTotal', label: 'Total', compute: r => String(serveTotal(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'acePct', label: 'Ace%', sortKey: 'serveAce', compute: r => fmtPct(serveAcePct(r.serveAce, r.serveError, r.serveAttempt)) },
        { key: 'errPct', label: 'Err%', sortKey: 'serveError', compute: r => fmtPct(serveErrorPct(r.serveAce, r.serveError, r.serveAttempt)) },
      ]
    case 'reception':
      return [
        { key: 'receptionPerfect', label: '3 (P)', compute: r => String(r.receptionPerfect) },
        { key: 'receptionGood', label: '2 (G)', compute: r => String(r.receptionGood) },
        { key: 'receptionOk', label: '1 (OK)', compute: r => String(r.receptionOk) },
        { key: 'receptionError', label: '0 (E)', compute: r => String(r.receptionError) },
        { key: 'total', label: 'Total', compute: r => String(r.receptionPerfect + r.receptionGood + r.receptionOk + r.receptionError) },
        { key: 'passEff', label: 'Eff', sortKey: 'receptionPerfect', compute: r => fmt2(passEfficiency(r.receptionPerfect, r.receptionGood, r.receptionOk, r.receptionError)) },
      ]
    case 'block':
      return [
        { key: 'blockSolo', label: 'BS', compute: r => String(r.blockSolo) },
        { key: 'blockAssist', label: 'BA', compute: r => String(r.blockAssist) },
        { key: 'blockError', label: 'BE', compute: r => String(r.blockError) },
        { key: 'blockRebound', label: 'BR', compute: r => String(r.blockRebound) },
        { key: 'blockTotal', label: 'Total', sortKey: 'blockSolo', compute: r => fmt2(blockTotal(r.blockSolo, r.blockAssist)) },
      ]
    case 'set':
      return [
        { key: 'setAssist', label: 'Ast', compute: r => String(r.setAssist) },
        { key: 'setBallHandlingError', label: 'BHE', compute: r => String(r.setBallHandlingError) },
        { key: 'setTotal', label: 'Total', compute: r => String(setTotal(r.setAssist, r.setBallHandlingError)) },
        { key: 'setEff', label: 'Eff', sortKey: 'setAssist', compute: r => fmtPct(setEfficiency(r.setAssist, r.setBallHandlingError)) },
      ]
    case 'dig':
      return [
        { key: 'dig', label: 'D', compute: r => String(r.dig) },
        { key: 'digError', label: 'DE', compute: r => String(r.digError) },
        { key: 'digAttempt', label: 'Att', compute: r => String(r.digAttempt) },
        { key: 'digSucc', label: 'Succ%', sortKey: 'dig', compute: r => fmtPct(digSuccessRate(r.dig, r.digError, r.digAttempt)) },
      ]
    case 'points':
      return [
        { key: 'attackKill', label: 'K', compute: r => String(r.attackKill) },
        { key: 'serveAce', label: 'SA', compute: r => String(r.serveAce) },
        { key: 'blockSolo', label: 'BS', compute: r => String(r.blockSolo) },
        { key: 'blockAssistHalf', label: 'BA*.5', compute: r => fmt2(r.blockAssist * 0.5) },
        { key: 'pts', label: 'PTS', sortKey: 'attackKill', compute: r => String(pointsTotal(r.attackKill, r.serveAce, r.blockSolo, r.blockAssist)) },
      ]
    default:
      return []
  }
}
