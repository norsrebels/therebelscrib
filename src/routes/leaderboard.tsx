import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useMemo, useCallback, useEffect } from 'react'
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
import { BarChart2, X, ChevronDown, Download, Trophy, ArrowRightLeft } from 'lucide-react'

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

const POSITION_LABELS: Record<string, string> = {
  OS: 'Open Spiker', OPP: 'Opposite Spiker', MB: 'Middle Blocker', S: 'Setter', L: 'Libero',
}

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

function PlayerStatsPage() {
  const { stats, players, schedules } = Route.useLoaderData() as any
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [selectedRanking, setSelectedRanking] = useState<RankingKey>('totalPts')
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null)
  
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [comparePlayerA, setComparePlayerA] = useState<number | ''>('')
  const [comparePlayerB, setComparePlayerB] = useState<number | ''>('')

  const router = useRouter()
  useEffect(() => {
    const REFRESH_MS = 15000
    const refresh = () => {
      if (document.visibilityState === 'visible') router.invalidate()
    }
    const timer = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router])

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
      
      return {
        playerId: pid,
        name: info?.nickname ?? `Player ${id}`,
        jersey: info?.jerseyNumber,
        position: info?.position ?? '',
        totalSets,
        totalRec: agg.receptionPerfect + agg.receptionGood + agg.receptionOk + agg.receptionError,
        totalDigAtt: agg.digAttempt > 0 ? agg.digAttempt : agg.dig + agg.digError,
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

  const availablePositions = useMemo(
    () => Array.from(new Set(aggregated.map(p => p.position).filter(Boolean))).sort(),
    [aggregated],
  )

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

  const podium = useMemo(() => ranked.slice(0, 3), [ranked])
  const leaderboardList = useMemo(() => ranked.slice(3), [ranked])

  const playerAData = useMemo(() => aggregated.find(p => p.playerId === Number(comparePlayerA)), [aggregated, comparePlayerA])
  const playerBData = useMemo(() => aggregated.find(p => p.playerId === Number(comparePlayerB)), [aggregated, comparePlayerB])

  const getLeaderCompare = (valA: any, valB: any, lowerBetter = false) => {
    if (valA === undefined || valA === null || valA === '—') return { a: false, b: false }
    if (valB === undefined || valB === null || valB === '—') return { a: false, b: false }
    const numA = typeof valA === 'string' ? parseFloat(valA.replace('%', '')) : valA
    const numB = typeof valB === 'string' ? parseFloat(valB.replace('%', '')) : valB
    if (isNaN(numA) || isNaN(numB)) return { a: false, b: false }
    if (numA === numB) return { a: false, b: false }
    const leadA = lowerBetter ? numA < numB : numA > numB
    return { a: leadA, b: !leadA }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-[rgb(var(--border-soft))] pb-6">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-500 flex items-center justify-center">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Player Statistics</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))] font-medium">
              {[
                selectedScheduleName || 'All schedules',
                selectedPositionFilter ? (POSITION_LABELS[selectedPositionFilter] ?? selectedPositionFilter) : 'All positions',
              ].join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {schedules.length > 0 && (
            <div className="relative">
              <select value={selectedScheduleId} onChange={handleScheduleChange}
                className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-semibold bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] focus:outline-none focus:ring-1 focus:ring-blue-550 cursor-pointer">
                <option value="">All schedules</option>
                {schedules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" size={14} />
            </div>
          )}
          <div className="relative">
            <select value={selectedPositionFilter} onChange={handlePositionChange}
              className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-semibold bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] focus:outline-none focus:ring-1 focus:ring-blue-550 cursor-pointer">
              <option value="">All positions</option>
              {availablePositions.map(pos => (
                <option key={pos} value={pos}>{POSITION_LABELS[pos] ?? pos}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" size={14} />
          </div>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600/20 transition-colors cursor-pointer"
            title="Compare two players side-by-side"
          >
            <ArrowRightLeft size={14} /> Compare
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors cursor-pointer"
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
              <div key={group} className="bg-[rgb(var(--surface))]/40 p-2.5 rounded-2xl border border-[rgb(var(--border-soft))]">
                <h2 className="text-[10px] font-bold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-2 px-2">{group}</h2>
                <div className="space-y-1">
                  {items.map(r => (
                    <button key={r.key} onClick={() => setSelectedRanking(r.key)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selectedRanking === r.key ? 'bg-blue-600 text-white shadow-md' : 'text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))]'}`}>
                      <div>{r.label}</div>
                      {r.minLabel && <div className={`text-[9px] mt-0.5 font-normal ${selectedRanking === r.key ? 'text-blue-200' : 'text-[rgb(var(--muted-fg))]'}`}>{r.minLabel}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          {podium.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {podium[1] && (
                <div onClick={() => setSelectedPlayer(podium[1].playerId)}
                  className="glass border border-zinc-400/25 hover:border-zinc-400/40 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer transition-all shadow-[0_4px_20px_rgba(255,255,255,0.02)] hover:-translate-y-1 relative order-2 md:order-1">
                  <div className="absolute top-3 left-3 bg-zinc-400/20 text-zinc-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-zinc-400/30">🥈 2nd Place</div>
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-400 text-lg mb-3 shadow">#{podium[1].jersey ?? '?'}</div>
                  <h3 className="font-extrabold text-sm text-zinc-200 mb-0.5">{podium[1].name}</h3>
                  <span className="text-[10px] bg-[rgb(var(--surface-hover))] px-1.5 py-0.5 rounded text-[rgb(var(--muted-fg))] mb-4">{podium[1].position ? (POSITION_LABELS[podium[1].position] ?? podium[1].position) : 'No Position'}</span>
                  <div className="text-2xl font-black font-mono text-zinc-450 tabular-nums">{formatValue(podium[1])}</div>
                  <span className="text-[10px] text-[rgb(var(--muted-fg))] font-medium uppercase mt-1">{RANKINGS.find(r => r.key === selectedRanking)?.label}</span>
                </div>
              )}
              {podium[0] && (
                <div onClick={() => setSelectedPlayer(podium[0].playerId)}
                  className="glass border border-yellow-500/25 hover:border-yellow-500/45 rounded-3xl p-6 flex flex-col items-center text-center cursor-pointer transition-all shadow-[0_8px_30px_rgba(234,179,8,0.06)] hover:-translate-y-1 relative order-1 md:order-2 md:scale-105 border-2">
                  <div className="absolute top-4 left-4 bg-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-yellow-500/35 flex items-center gap-1"><Trophy size={10} /> 👑 1st Place</div>
                  <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center font-black text-yellow-400 text-xl mb-3 shadow-[0_0_15px_rgba(234,179,8,0.2)]">#{podium[0].jersey ?? '?'}</div>
                  <h3 className="font-extrabold text-base text-zinc-100 mb-0.5">{podium[0].name}</h3>
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full font-bold mb-4">{podium[0].position ? (POSITION_LABELS[podium[0].position] ?? podium[0].position) : 'No Position'}</span>
                  <div className="text-3xl font-black font-mono text-yellow-400 tabular-nums leading-none">{formatValue(podium[0])}</div>
                  <span className="text-[10px] text-[rgb(var(--muted-fg))] font-bold uppercase mt-1.5 tracking-wider">{RANKINGS.find(r => r.key === selectedRanking)?.label}</span>
                </div>
              )}
              {podium[2] && (
                <div onClick={() => setSelectedPlayer(podium[2].playerId)}
                  className="glass border border-amber-700/25 hover:border-amber-700/40 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer transition-all shadow-[0_4px_20px_rgba(180,83,9,0.02)] hover:-translate-y-1 relative order-3">
                  <div className="absolute top-3 left-3 bg-amber-700/20 text-amber-500 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-700/30">🥉 3rd Place</div>
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-amber-600 text-lg mb-3 shadow">#{podium[2].jersey ?? '?'}</div>
                  <h3 className="font-extrabold text-sm text-zinc-200 mb-0.5">{podium[2].name}</h3>
                  <span className="text-[10px] bg-[rgb(var(--surface-hover))] px-1.5 py-0.5 rounded text-[rgb(var(--muted-fg))] mb-4">{podium[2].position ? (POSITION_LABELS[podium[2].position] ?? podium[2].position) : 'No Position'}</span>
                  <div className="text-2xl font-black font-mono text-amber-655 tabular-nums">{formatValue(podium[2])}</div>
                  <span className="text-[10px] text-[rgb(var(--muted-fg))] font-medium uppercase mt-1">{RANKINGS.find(r => r.key === selectedRanking)?.label}</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border))] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-blue-400" size={15} />
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">Leaderboard Rankings {podium.length > 0 && '(Rank 4+)'}</span>
              </div>
              {isLowerBetter && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/10">lower is better</span>}
            </div>
            {ranked.length === 0 ? (
              <div className="text-center py-16 text-[rgb(var(--muted-fg))] text-sm font-medium">
                {!selectedScheduleId
                  ? <span>Pick a schedule from the dropdown above to see the rankings.</span>
                  : <span>No statistical data recorded yet for this schedule.</span>
                }
              </div>
            ) : leaderboardList.length === 0 && podium.length > 0 ? (
              <div className="text-center py-6 text-[rgb(var(--muted-fg))] text-[11px] font-medium">Showing all filtered records on the podium above.</div>
            ) : (
              <div className="divide-y divide-[rgb(var(--border-soft))]">
                {leaderboardList.map((p, i) => {
                  const actualRank = i + 4;
                  return (
                    <button key={p.playerId} onClick={() => setSelectedPlayer(p.playerId)} className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[rgb(var(--surface-hover))] transition-colors text-left ${i % 2 !== 0 ? 'bg-[rgb(var(--surface-hover))]/20' : ''}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] border border-[rgb(var(--border-soft))]">{actualRank}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-zinc-200">{p.name}</span>
                          <span className="text-[11px] text-[rgb(var(--muted-fg))] font-mono">#{p.jersey ?? '?'}</span>
                          {p.position && (<span className="text-[9px] font-bold px-1.5 py-0.5 bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] rounded text-[rgb(var(--muted-fg))] uppercase">{p.position}</span>)}
                        </div>
                        <div className="text-[9px] text-[rgb(var(--muted-fg))] mt-0.5 font-bold uppercase tracking-wider">{p.totalSets} set{p.totalSets !== 1 ? 's' : ''} played</div>
                      </div>
                      <div className="text-base font-black font-mono text-blue-450 tabular-nums">{formatValue(p)}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPlayerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)} />
          <div className="relative bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 border-b border-[rgb(var(--border-soft))] pb-4">
              <div>
                <h3 className="text-lg font-black text-zinc-100">#{selectedPlayerData.jersey ?? '?'} {selectedPlayerData.name}</h3>
                <p className="text-xs text-[rgb(var(--muted-fg))] font-bold uppercase tracking-wider">{selectedPlayerData.position ? POSITION_LABELS[selectedPlayerData.position] : 'General Player'} · {selectedPlayerData.totalSets} set{selectedPlayerData.totalSets !== 1 ? 's' : ''} played</p>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-white transition-colors cursor-pointer"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <StatSection label="Attack Performance">
                <StatCard label="Kills" value={String(selectedPlayerData.attackKill)} />
                <StatCard label="Errors" value={String(selectedPlayerData.attackError)} />
                <StatCard label="In Play" value={String(selectedPlayerData.attackAttempt)} />
                <StatCard label="Total Attacks" value={String(selectedPlayerData.attackKill + selectedPlayerData.attackError + selectedPlayerData.attackAttempt)} />
                <StatCard highlight label="Kill %" value={fmtPct(selectedPlayerData.killPctVal)} />
                <StatCard highlight label="Efficiency" value={fmtEff(selectedPlayerData.attackEffVal)} />
              </StatSection>
              <StatSection label="Serve Performance">
                <StatCard label="Aces" value={String(selectedPlayerData.serveAce)} />
                <StatCard label="Errors" value={String(selectedPlayerData.serveError)} />
                <StatCard label="In Play" value={String(selectedPlayerData.serveAttempt)} />
                <StatCard highlight label="Ace %" value={fmtPct(selectedPlayerData.acePctVal)} />
              </StatSection>
              <StatSection label="Reception Details">
                <StatCard label="Perfect (3)" value={String(selectedPlayerData.receptionPerfect)} />
                <StatCard label="Good (2)" value={String(selectedPlayerData.receptionGood)} />
                <StatCard label="OK (1)" value={String(selectedPlayerData.receptionOk)} />
                <StatCard label="Error (0)" value={String(selectedPlayerData.receptionError)} />
                <StatCard highlight label="Pass eff" value={fmt2(selectedPlayerData.passEffVal)} />
                <StatCard label="Error %" value={fmtPct(selectedPlayerData.recErrPctVal)} />
              </StatSection>
              <StatSection label="Set Assists">
                <StatCard label="Assists" value={String(selectedPlayerData.setAssist)} />
                <StatCard label="BHE (Errors)" value={String(selectedPlayerData.setBallHandlingError)} />
                <StatCard highlight label="Efficiency" value={fmtPct(selectedPlayerData.setEffVal)} />
                <StatCard highlight label="Assists / set" value={fmt2(selectedPlayerData.setAssistPerSetVal)} />
              </StatSection>
              <StatSection label="Block Performance">
                <StatCard label="Solo Blocks" value={String(selectedPlayerData.blockSolo)} />
                <StatCard label="Block Assists" value={String(selectedPlayerData.blockAssist)} />
                <StatCard label="Errors" value={String(selectedPlayerData.blockError)} />
                <StatCard highlight label="Blocks / set" value={fmt2(selectedPlayerData.blocksPerSetVal)} />
              </StatSection>
              <StatSection label="Defense & Digs">
                <StatCard label="Digs" value={String(selectedPlayerData.dig)} />
                <StatCard label="Errors" value={String(selectedPlayerData.digError)} />
                <StatCard highlight label="Success %" value={fmtPct(selectedPlayerData.digSuccessRateVal)} />
                <StatCard highlight label="Digs / set" value={fmt2(selectedPlayerData.digsPerSetVal)} />
              </StatSection>
              <StatSection label="Point Contributions">
                <StatCard highlight label="Total Points" value={fmtPts(selectedPlayerData.totalPts)} />
                <StatCard highlight label="Points / Set" value={fmt2(selectedPlayerData.ptsPerSetVal)} />
                <StatCard label="Sets Played" value={String(selectedPlayerData.totalSets)} />
              </StatSection>
            </div>
          </div>
        </div>
      )}

      {isCompareOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsCompareOpen(false)} />
          <div className="relative bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col z-50">
            <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-600/10 text-blue-500"><ArrowRightLeft size={18} /></div>
                <div>
                  <h3 className="text-lg font-black text-zinc-100 uppercase tracking-wide">Player Comparison</h3>
                  <p className="text-[10px] text-[rgb(var(--muted-fg))] font-bold uppercase tracking-wider">Analyze statistics side-by-side</p>
                </div>
              </div>
              <button onClick={() => setIsCompareOpen(false)} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-white transition-colors cursor-pointer"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-[rgb(var(--muted-fg))] tracking-wider">Compare Player A</label>
                <select value={comparePlayerA} onChange={(e) => setComparePlayerA(e.target.value ? Number(e.target.value) : '')} className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-blue-550">
                  <option value="">Select player...</option>
                  {aggregated.map(p => (<option key={p.playerId} value={p.playerId} disabled={p.playerId === Number(comparePlayerB)}>#{p.jersey ?? '?'} {p.name} ({p.position})</option>))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-[rgb(var(--muted-fg))] tracking-wider">Compare Player B</label>
                <select value={comparePlayerB} onChange={(e) => setComparePlayerB(e.target.value ? Number(e.target.value) : '')} className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-blue-550">
                  <option value="">Select player...</option>
                  {aggregated.map(p => (<option key={p.playerId} value={p.playerId} disabled={p.playerId === Number(comparePlayerA)}>#{p.jersey ?? '?'} {p.name} ({p.position})</option>))}
                </select>
              </div>
            </div>
            {playerAData && playerBData ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--border))] text-zinc-400 font-bold uppercase text-[10px] tracking-wider text-center">
                      <th className="py-2.5 text-left">{playerAData.name}</th>
                      <th className="py-2.5 text-zinc-500">Metric</th>
                      <th className="py-2.5 text-right">{playerBData.name}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-soft))] font-semibold">
                    <CompareRow label="Jersey Number" valA={playerAData.jersey} valB={playerBData.jersey} />
                    <CompareRow label="Position" valA={playerAData.position} valB={playerBData.position} />
                    <CompareRow label="Sets Played" valA={playerAData.totalSets} valB={playerBData.totalSets} lead={getLeaderCompare(playerAData.totalSets, playerBData.totalSets)} />
                    <CompareRow label="Total Points" valA={playerAData.totalPts} valB={playerBData.totalPts} lead={getLeaderCompare(playerAData.totalPts, playerBData.totalPts)} />
                    <CompareRow label="Points / Set" valA={fmt2(playerAData.ptsPerSetVal)} valB={fmt2(playerBData.ptsPerSetVal)} lead={getLeaderCompare(playerAData.ptsPerSetVal, playerBData.ptsPerSetVal)} />
                    <CompareRow label="Kills" valA={playerAData.attackKill} valB={playerBData.attackKill} lead={getLeaderCompare(playerAData.attackKill, playerBData.attackKill)} />
                    <CompareRow label="Kill %" valA={fmtPct(playerAData.killPctVal)} valB={fmtPct(playerBData.killPctVal)} lead={getLeaderCompare(playerAData.killPctVal, playerBData.killPctVal)} />
                    <CompareRow label="Attack Efficiency" valA={fmtEff(playerAData.attackEffVal)} valB={fmtEff(playerBData.attackEffVal)} lead={getLeaderCompare(playerAData.attackEffVal, playerBData.attackEffVal)} />
                    <CompareRow label="Aces" valA={playerAData.serveAce} valB={playerBData.serveAce} lead={getLeaderCompare(playerAData.serveAce, playerBData.serveAce)} />
                    <CompareRow label="Ace %" valA={fmtPct(playerAData.acePctVal)} valB={fmtPct(playerBData.acePctVal)} lead={getLeaderCompare(playerAData.acePctVal, playerBData.acePctVal)} />
                    <CompareRow label="Pass Efficiency" valA={fmt2(playerAData.passEffVal)} valB={fmt2(playerBData.passEffVal)} lead={getLeaderCompare(playerAData.passEffVal, playerBData.passEffVal)} />
                    <CompareRow label="Reception Error %" valA={fmtPct(playerAData.recErrPctVal)} valB={fmtPct(playerBData.recErrPctVal)} lead={getLeaderCompare(playerAData.recErrPctVal, playerBData.recErrPctVal, true)} />
                    <CompareRow label="Set Assists" valA={playerAData.setAssist} valB={playerBData.setAssist} lead={getLeaderCompare(playerAData.setAssist, playerBData.setAssist)} />
                    <CompareRow label="Assists / Set" valA={fmt2(playerAData.setAssistPerSetVal)} valB={fmt2(playerBData.setAssistPerSetVal)} lead={getLeaderCompare(playerAData.setAssistPerSetVal, playerBData.setAssistPerSetVal)} />
                    <CompareRow label="Total Digs" valA={playerAData.dig} valB={playerBData.dig} lead={getLeaderCompare(playerAData.dig, playerBData.dig)} />
                    <CompareRow label="Dig Success %" valA={fmtPct(playerAData.digSuccessRateVal)} valB={fmtPct(playerBData.digSuccessRateVal)} lead={getLeaderCompare(playerAData.digSuccessRateVal, playerBData.digSuccessRateVal)} />
                    <CompareRow label="Solo Blocks" valA={playerAData.blockSolo} valB={playerBData.blockSolo} lead={getLeaderCompare(playerAData.blockSolo, playerBData.blockSolo)} />
                    <CompareRow label="Blocks / Set" valA={fmt2(playerAData.blocksPerSetVal)} valB={fmt2(playerBData.blocksPerSetVal)} lead={getLeaderCompare(playerAData.blocksPerSetVal, playerBData.blocksPerSetVal)} />
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[rgb(var(--border))] rounded-2xl py-12 text-[rgb(var(--muted-fg))] gap-2 text-center">
                <ArrowRightLeft size={28} className="opacity-30" />
                <p className="text-sm font-semibold">Select two players to compare</p>
                <p className="text-xs max-w-xs mx-auto">Choose two members from the dropdowns above to compare their performance parameters side-by-side.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CompareRow({ label, valA, valB, lead }: { label: string; valA: any; valB: any; lead?: { a: boolean; b: boolean } }) {
  return (
    <tr className="hover:bg-[rgb(var(--surface-hover))]/20 transition-colors">
      <td className={`py-2 text-left font-mono text-xs tabular-nums ${lead?.a ? 'text-green-400 font-bold' : 'text-zinc-350'}`}>{valA !== null && valA !== undefined ? valA : '—'}</td>
      <td className="py-2 text-center text-zinc-500 font-bold text-[11px] uppercase tracking-wide">{label}</td>
      <td className={`py-2 text-right font-mono text-xs tabular-nums ${lead?.b ? 'text-green-400 font-bold' : 'text-zinc-350'}`}>{valB !== null && valB !== undefined ? valB : '—'}</td>
    </tr>
  )
}

function StatSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[rgb(var(--surface-hover))]/10 p-3 rounded-2xl border border-[rgb(var(--border-soft))]">
      <h4 className="text-[10px] font-bold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-2.5 px-1">{label}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-xl border transition-all ${highlight ? 'border-blue-500/20 bg-blue-500/5 text-blue-400 shadow-sm' : 'border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))]'}`}>
      <div className="text-[9px] text-[rgb(var(--muted-fg))] uppercase font-bold tracking-wider">{label}</div>
      <div className={`text-base font-extrabold font-mono tabular-nums mt-0.5 ${highlight ? 'text-blue-400' : 'text-zinc-100'}`}>{value}</div>
    </div>
  )
}
