import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useCallback } from 'react'
import { getAllPlayerStats } from '@/server/stats.functions'
import {
  type PlayerStatRow,
  attackEfficiency,
  killPct,
  passEfficiency,
  blocksPerSet,
  pointsTotal,
  pointsPerSet,
  perSet,
  serveAcePct,
  setEfficiency,
  digSuccessRate,
  receptionErrorPct,
  fmtPct,
  fmtEff,
  fmt2,
  fmtPts,
  aggregateTeamStats,
} from '@/lib/stats/formulas'
import { BarChart2, X, ChevronDown, Download, Copy, Check } from 'lucide-react'

export const Route = createFileRoute('/leaderboard')({
  validateSearch: (search: Record<string, unknown>) => ({
    schedule: typeof search.schedule === 'string' ? search.schedule : undefined,
    position: typeof search.position === 'string' ? search.position : undefined,
  }),
  loader: async ({ location }) => {
    try {
      const search = location.search as { schedule?: string }
      const { stats, players, schedules } = await getAllPlayerStats({
        data: { tournamentId: search.schedule },
      })
      return { stats, players, schedules }
    } catch {
      return { stats: [], players: [], schedules: [] }
    }
  },
  component: PlayerStatsPage,
})

const MIN_ATTACK_ATT  = 10
const MIN_SERVE_ATT   = 10
const MIN_RECEPTIONS  = 10
const MIN_SET_ATT     = 10
const MIN_DIG_ATT     = 5
const MIN_SETS        = 2

type RankingKey =
  | 'totalPts' | 'ptsPerSet'
  | 'killPct' | 'attackEff'
  | 'aces' | 'acePct'
  | 'passEff' | 'recErrPct'
  | 'setAssistPerSet' | 'setEff'
  | 'digsPerSet' | 'digSuccessRate'
  | 'blocksPerSet'

const RANKINGS: { key: RankingKey; label: string; minLabel?: string; group: string }[] = [
  { key: 'totalPts',        label: 'Total points',      group: 'Points' },
  { key: 'ptsPerSet',       label: 'Points / set',      minLabel: `min ${MIN_SETS} sets`,   group: 'Points' },
  { key: 'killPct',         label: 'Kill %',            minLabel: `min ${MIN_ATTACK_ATT} att`, group: 'Attack' },
  { key: 'attackEff',       label: 'Attack efficiency', minLabel: `min ${MIN_ATTACK_ATT} att`, group: 'Attack' },
  { key: 'aces',            label: 'Aces',              group: 'Serve' },
  { key: 'acePct',          label: 'Ace %',             minLabel: `min ${MIN_SERVE_ATT} att`,  group: 'Serve' },
  { key: 'passEff',         label: 'Pass efficiency',   minLabel: `min ${MIN_RECEPTIONS} rec`, group: 'Reception' },
  { key: 'recErrPct',       label: 'Reception err %',   minLabel: `min ${MIN_RECEPTIONS} rec`, group: 'Reception' },
  { key: 'setAssistPerSet', label: 'Assists / set',     minLabel: `min ${MIN_SETS} sets`,   group: 'Set' },
  { key: 'setEff',          label: 'Set efficiency',    minLabel: `min ${MIN_SET_ATT} att`, group: 'Set' },
  { key: 'digsPerSet',      label: 'Digs / set',        minLabel: `min ${MIN_SETS} sets`,   group: 'Dig' },
  { key: 'digSuccessRate',  label: 'Dig success %',     minLabel: `min ${MIN_DIG_ATT} att`, group: 'Dig' },
  { key: 'blocksPerSet',    label: 'Blocks / set',      minLabel: `min ${MIN_SETS} sets`,   group: 'Block' },
]

const RANKING_GROUPS = ['Points', 'Attack', 'Serve', 'Reception', 'Set', 'Dig', 'Block'] as const

function PlayerStatsPage() {
  const { stats, players, schedules } = Route.useLoaderData() as any
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [selectedRanking, setSelectedRanking] = useState<RankingKey>('totalPts')
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const handleCopy = useCallback((e: React.MouseEvent, p: any, value: string) => {
    e.stopPropagation()
    const label = RANKINGS.find(r => r.key === selectedRanking)?.label ?? selectedRanking
    const text = `${p.name} — ${label}: ${value}`
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(p.playerId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }, [selectedRanking])

  const handleExportCSV = useCallback(() => {
    const headers = ['Rank', 'Name', 'Jersey', 'Position', 'Sets', 'K', 'E', 'Att', 'Eff', 'Kill%', 'SA', 'SE', 'BS', 'BA', 'Blk Pts', 'D', 'DE', 'FB', 'Ast', 'PTS']
    const rows = ranked.map((p: any, i: number) => [
      i + 1,
      p.name,
      p.jersey ?? '',
      p.position ?? '',
      p.totalSets,
      p.attackKill, p.attackError,
      p.attackKill + p.attackError + p.attackAttempt,
      p.attackKill + p.attackError + p.attackAttempt > 0
        ? ((p.attackKill - p.attackError) / (p.attackKill + p.attackError + p.attackAttempt)).toFixed(3)
        : '—',
      p.attackKill + p.attackError + p.attackAttempt > 0
        ? ((p.attackKill / (p.attackKill + p.attackError + p.attackAttempt)) * 100).toFixed(1) + '%'
        : '—',
      p.serveAce, p.serveError,
      p.blockSolo, p.blockAssist,
      (p.blockSolo + p.blockAssist * 0.5).toFixed(1),
      p.dig, p.digError, p.freeballDig ?? 0,
      p.setAssist,
      p.attackKill + p.serveAce + p.blockSolo + Math.round(p.blockAssist * 0.5),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rebels_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [ranked])

  const selectedScheduleId = search.schedule ?? ''
  const selectedScheduleName = schedules.find((s: any) => s.id === selectedScheduleId)?.name ?? ''

  const selectedPositionFilter = search.position ?? ''

  const handleScheduleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    navigate({ search: { schedule: val || undefined, position: selectedPositionFilter || undefined } })
  }

  const handlePositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    navigate({ search: { schedule: selectedScheduleId || undefined, position: val || undefined } })
  }

  const playerMap = useMemo(() => {
    const map: Record<number, { nickname: string; jerseyNumber: number | null; position: string }> = {}
    for (const p of players) map[p.id] = { nickname: p.nickname, jerseyNumber: p.jerseyNumber, position: p.position }
    return map
  }, [players])

  const aggregated = useMemo(() => {
    const byPlayer: Record<number, { rows: PlayerStatRow[]; sets: Set<string> }> = {}
    for (const s of stats) {
      if (!byPlayer[s.playerId]) byPlayer[s.playerId] = { rows: [], sets: new Set() }
      byPlayer[s.playerId].rows.push(s as any)
      if (s.setNumber > 0) byPlayer[s.playerId].sets.add(`${s.matchId}-${s.setNumber}`)
    }
    return Object.entries(byPlayer).map(([id, data]) => {
      const agg = aggregateTeamStats(data.rows)
      const totalSets = Math.max(data.sets.size, 1)
      const pid = Number(id)
      const info = playerMap[pid]
      const pts = pointsTotal(agg.attackKill, agg.serveAce, agg.blockSolo, agg.blockAssist)
      const totalRec = agg.receptionPerfect + agg.receptionGood + agg.receptionOk + agg.receptionError
      const totalDigAtt = agg.digAttempt > 0 ? agg.digAttempt : agg.dig + agg.digError

      return {
        playerId: pid,
        name: info?.nickname ?? `Player ${id}`,
        jersey: info?.jerseyNumber,
        position: info?.position ?? '',
        totalSets, totalRec, totalDigAtt,
        ...agg,
        killPctVal:         killPct(agg.attackKill, agg.attackError, agg.attackAttempt),
        attackEffVal:       attackEfficiency(agg.attackKill, agg.attackError, agg.attackAttempt),
        acePctVal:          serveAcePct(agg.serveAce, agg.serveError, agg.serveAttempt),
        passEffVal:         passEfficiency(agg.receptionPerfect, agg.receptionGood, agg.receptionOk, agg.receptionError),
        recErrPctVal:       receptionErrorPct(agg.receptionError, agg.receptionPerfect, agg.receptionGood, agg.receptionOk),
        setAssistPerSetVal: perSet(agg.setAssist, totalSets),
        setEffVal:          setEfficiency(agg.setAssist, agg.setBallHandlingError),
        digsPerSetVal:      perSet(agg.dig, totalSets),
        digSuccessRateVal:  digSuccessRate(agg.dig, agg.digError, agg.digAttempt),
        blocksPerSetVal:    blocksPerSet(agg.blockSolo, agg.blockAssist, totalSets),
        totalPts:           pts,
        ptsPerSetVal:       pointsPerSet(pts, totalSets),
      }
    })
  }, [stats, playerMap])

  const ranked = useMemo(() => {
    let f = selectedPositionFilter
      ? aggregated.filter(p => p.position === selectedPositionFilter)
      : [...aggregated]
    switch (selectedRanking) {
      case 'totalPts':        f.sort((a, b) => b.totalPts - a.totalPts); break
      case 'ptsPerSet':       f = f.filter(p => p.totalSets >= MIN_SETS); f.sort((a, b) => (b.ptsPerSetVal ?? 0) - (a.ptsPerSetVal ?? 0)); break
      case 'killPct':         f = f.filter(p => (p.attackKill + p.attackError + p.attackAttempt) >= MIN_ATTACK_ATT); f.sort((a, b) => (b.killPctVal ?? -1) - (a.killPctVal ?? -1)); break
      case 'attackEff':       f = f.filter(p => (p.attackKill + p.attackError + p.attackAttempt) >= MIN_ATTACK_ATT); f.sort((a, b) => (b.attackEffVal ?? -1) - (a.attackEffVal ?? -1)); break
      case 'aces':            f.sort((a, b) => b.serveAce - a.serveAce); break
      case 'acePct':          f = f.filter(p => (p.serveAce + p.serveError + p.serveAttempt) >= MIN_SERVE_ATT); f.sort((a, b) => (b.acePctVal ?? -1) - (a.acePctVal ?? -1)); break
      case 'passEff':         f = f.filter(p => p.totalRec >= MIN_RECEPTIONS); f.sort((a, b) => (b.passEffVal ?? -1) - (a.passEffVal ?? -1)); break
      case 'recErrPct':       f = f.filter(p => p.totalRec >= MIN_RECEPTIONS); f.sort((a, b) => (a.recErrPctVal ?? 101) - (b.recErrPctVal ?? 101)); break
      case 'setAssistPerSet': f = f.filter(p => p.totalSets >= MIN_SETS); f.sort((a, b) => (b.setAssistPerSetVal ?? 0) - (a.setAssistPerSetVal ?? 0)); break
      case 'setEff':          f = f.filter(p => (p.setAssist + p.setBallHandlingError) >= MIN_SET_ATT); f.sort((a, b) => (b.setEffVal ?? -1) - (a.setEffVal ?? -1)); break
      case 'digsPerSet':      f = f.filter(p => p.totalSets >= MIN_SETS); f.sort((a, b) => (b.digsPerSetVal ?? 0) - (a.digsPerSetVal ?? 0)); break
      case 'digSuccessRate':  f = f.filter(p => p.totalDigAtt >= MIN_DIG_ATT); f.sort((a, b) => (b.digSuccessRateVal ?? -1) - (a.digSuccessRateVal ?? -1)); break
      case 'blocksPerSet':    f = f.filter(p => p.totalSets >= MIN_SETS); f.sort((a, b) => (b.blocksPerSetVal ?? 0) - (a.blocksPerSetVal ?? 0)); break
    }
    return f
  }, [aggregated, selectedRanking, selectedPositionFilter])

  const formatValue = (p: typeof aggregated[0]): string => {
    switch (selectedRanking) {
      case 'totalPts':        return fmtPts(p.totalPts)
      case 'ptsPerSet':       return fmt2(p.ptsPerSetVal)
      case 'killPct':         return fmtPct(p.killPctVal)
      case 'attackEff':       return fmtEff(p.attackEffVal)
      case 'aces':            return String(p.serveAce)
      case 'acePct':          return fmtPct(p.acePctVal)
      case 'passEff':         return fmt2(p.passEffVal)
      case 'recErrPct':       return fmtPct(p.recErrPctVal)
      case 'setAssistPerSet': return fmt2(p.setAssistPerSetVal)
      case 'setEff':          return fmtPct(p.setEffVal)
      case 'digsPerSet':      return fmt2(p.digsPerSetVal)
      case 'digSuccessRate':  return fmtPct(p.digSuccessRateVal)
      case 'blocksPerSet':    return fmt2(p.blocksPerSetVal)
    }
  }

  const isLowerBetter = selectedRanking === 'recErrPct'
  const selectedPlayerData = selectedPlayer ? aggregated.find(p => p.playerId === selectedPlayer) : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3 flex-1">
          <BarChart2 className="text-blue-400 flex-shrink-0" size={24} />
          <div>
            <h1 className="text-2xl font-bold">Player Statistics</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))]">
              {[
                selectedScheduleName || 'All schedules',
                selectedPositionFilter ? { OS: 'Open Spikers', OPP: 'Opposite Spikers', MB: 'Middle Blockers', S: 'Setters', L: 'Liberos' }[selectedPositionFilter] : 'All positions',
              ].join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {schedules.length > 0 && (
            <div className="relative">
              <select value={selectedScheduleId} onChange={handleScheduleChange}
                className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-medium bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer">
                <option value="">All schedules</option>
                {schedules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" size={14} />
            </div>
          )}
          <div className="relative">
            <select value={selectedPositionFilter} onChange={handlePositionChange}
              className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-medium bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer">
              <option value="">All positions</option>
              <option value="OS">Open Spiker</option>
              <option value="OPP">Opposite Spiker</option>
              <option value="MB">Middle Blocker</option>
              <option value="S">Setter</option>
              <option value="L">Libero</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" size={14} />
          </div>
          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
            title="Export leaderboard as CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          {RANKING_GROUPS.map(group => {
            const items = RANKINGS.filter(r => r.group === group)
            return (
              <div key={group}>
                <h2 className="text-[10px] font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-1.5 px-1">{group}</h2>
                <div className="space-y-1">
                  {items.map(r => (
                    <button key={r.key} onClick={() => setSelectedRanking(r.key)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedRanking === r.key ? 'bg-blue-600 text-white' : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))]'}`}>
                      <div>{r.label}</div>
                      {r.minLabel && <div className={`text-[10px] mt-0.5 ${selectedRanking === r.key ? 'text-blue-200' : 'text-[rgb(var(--muted-fg))]'}`}>{r.minLabel}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgb(var(--border))] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="text-blue-400" size={15} />
              <span className="font-semibold text-sm">{RANKINGS.find(r => r.key === selectedRanking)?.label}</span>
            </div>
            {isLowerBetter && <span className="text-[10px] text-[rgb(var(--muted-fg))] bg-[rgb(var(--surface-hover))] px-2 py-0.5 rounded-full">lower is better</span>}
          </div>

          {ranked.length === 0 ? (
            <div className="text-center py-16 text-[rgb(var(--muted-fg))] text-sm">No data yet — or no players meet the minimum threshold.</div>
          ) : (
            <div>
              {ranked.map((p, i) => (
                <button key={p.playerId} onClick={() => setSelectedPlayer(p.playerId)}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 border-b border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--surface-hover))] transition-colors text-left ${i % 2 !== 0 ? 'bg-[rgb(var(--surface-hover))]' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' : i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' : i === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' : 'bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))]'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-xs text-[rgb(var(--muted-fg))] font-mono">#{p.jersey ?? '?'}</span>
                      {p.position && <span className="text-[10px] px-1.5 py-0.5 bg-[rgb(var(--surface-hover))] rounded text-[rgb(var(--muted-fg))]">{p.position}</span>}
                    </div>
                    <div className="text-[10px] text-[rgb(var(--muted-fg))] mt-0.5">{p.totalSets} set{p.totalSets !== 1 ? 's' : ''} played</div>
                  </div>
                  <div className="text-base font-bold tabular-nums text-blue-400">{formatValue(p)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPlayerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)} />
          <div className="relative bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold">#{selectedPlayerData.jersey ?? '?'} {selectedPlayerData.name}</h3>
                <p className="text-xs text-[rgb(var(--muted-fg))]">{selectedPlayerData.position || 'No position'} · {selectedPlayerData.totalSets} set{selectedPlayerData.totalSets !== 1 ? 's' : ''} played</p>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <StatSection label="Attack">
                <StatCard label="Kills" value={String(selectedPlayerData.attackKill)} />
                <StatCard label="Errors" value={String(selectedPlayerData.attackError)} />
                <StatCard label="In Play" value={String(selectedPlayerData.attackAttempt)} />
                <StatCard label="Total Att" value={String(selectedPlayerData.attackKill + selectedPlayerData.attackError + selectedPlayerData.attackAttempt)} />
                <StatCard label="Kill %" value={fmtPct(selectedPlayerData.killPctVal)} />
                <StatCard label="Efficiency" value={fmtEff(selectedPlayerData.attackEffVal)} />
              </StatSection>

              <StatSection label="Serve">
                <StatCard label="Aces" value={String(selectedPlayerData.serveAce)} />
                <StatCard label="Errors" value={String(selectedPlayerData.serveError)} />
                <StatCard label="In Play" value={String(selectedPlayerData.serveAttempt)} />
                <StatCard label="Total Att" value={String(selectedPlayerData.serveAce + selectedPlayerData.serveError + selectedPlayerData.serveAttempt)} />
                <StatCard label="Ace %" value={fmtPct(selectedPlayerData.acePctVal)} />
              </StatSection>

              <StatSection label="Reception">
                <StatCard label="Perfect (3)" value={String(selectedPlayerData.receptionPerfect)} />
                <StatCard label="Good (2)" value={String(selectedPlayerData.receptionGood)} />
                <StatCard label="OK (1)" value={String(selectedPlayerData.receptionOk)} />
                <StatCard label="Error (0)" value={String(selectedPlayerData.receptionError)} />
                <StatCard label="Pass eff" value={fmt2(selectedPlayerData.passEffVal)} />
                <StatCard label="Error %" value={fmtPct(selectedPlayerData.recErrPctVal)} />
              </StatSection>

              <StatSection label="Set">
                <StatCard label="Assists" value={String(selectedPlayerData.setAssist)} />
                <StatCard label="Total Att" value={String(selectedPlayerData.setAssist + selectedPlayerData.setBallHandlingError)} />
                <StatCard label="BHE" value={String(selectedPlayerData.setBallHandlingError)} />
                <StatCard label="Efficiency" value={fmtPct(selectedPlayerData.setEffVal)} />
                <StatCard label="Assists/set" value={fmt2(selectedPlayerData.setAssistPerSetVal)} />
              </StatSection>

              <StatSection label="Block">
                <StatCard label="Solo" value={String(selectedPlayerData.blockSolo)} />
                <StatCard label="Assist" value={String(selectedPlayerData.blockAssist)} />
                <StatCard label="Errors" value={String(selectedPlayerData.blockError)} />
                <StatCard label="Blocks/set" value={fmt2(selectedPlayerData.blocksPerSetVal)} />
              </StatSection>

              <StatSection label="Dig">
                <StatCard label="Digs" value={String(selectedPlayerData.dig)} />
                <StatCard label="Errors" value={String(selectedPlayerData.digError)} />
                <StatCard label="Total Att" value={String(selectedPlayerData.dig + selectedPlayerData.digError)} />
                <StatCard label="Success %" value={fmtPct(selectedPlayerData.digSuccessRateVal)} />
                <StatCard label="Digs/set" value={fmt2(selectedPlayerData.digsPerSetVal)} />
              </StatSection>

              <StatSection label="Points">
                <StatCard highlight label="Total" value={fmtPts(selectedPlayerData.totalPts)} />
                <StatCard highlight label="Per set" value={fmt2(selectedPlayerData.ptsPerSetVal)} />
                <StatCard label="Sets played" value={String(selectedPlayerData.totalSets)} />
              </StatSection>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-2">{label}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`px-3 py-2.5 rounded-xl border ${highlight ? 'border-blue-500/30 bg-blue-500/10' : 'border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))]'}`}>
      <div className="text-[10px] text-[rgb(var(--muted-fg))] uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${highlight ? 'text-blue-400' : ''}`}>{value}</div>
    </div>
  )
}
