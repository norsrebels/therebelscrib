import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  listMatches,
  createMatch,
  getMatchData,
  addPlayerToMatch,
  removePlayerFromMatch,
  saveSetStats,
  getLeaderboard,
  deleteMatch,
  findMatchByTournamentMatchId,
} from '../server/vis.functions'
import {
  Lock, Plus, ChevronRight, BarChart2, Users, Trash2,
  Download, Trophy, X, Check, ChevronDown, ChevronUp,
  Shield, Zap, Target, Save, RefreshCw,
  ClipboardList, Link2, AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/lib/use-toast'
import { ToastBar } from '@/components/Modals'

export const Route = createFileRoute('/vis-stats')({
  validateSearch: (search: Record<string, unknown>) => ({
    // Tournament deep-link params
    tournamentId: typeof search.tournamentId === 'string' ? search.tournamentId : undefined,
    matchId: typeof search.matchId === 'string' ? search.matchId : undefined,
    teamA: typeof search.teamA === 'string' ? search.teamA : undefined,
    teamB: typeof search.teamB === 'string' ? search.teamB : undefined,
    date: typeof search.date === 'string' ? search.date : undefined,
    venue: typeof search.venue === 'string' ? search.venue : undefined,
    sets: typeof search.sets === 'string' ? search.sets : undefined,
    // Players for The Rebels side: JSON-encoded [{name,jersey}]
    players: typeof search.players === 'string' ? search.players : undefined,
  }),
  loader: async () => {
    try {
      const [matches, leaderboard] = await Promise.all([listMatches(), getLeaderboard()])
      return { matches, leaderboard }
    } catch {
      return { matches: [], leaderboard: [] }
    }
  },
  component: VisStatsPage,
})

// ─── Types ────────────────────────────────────────────────────

type StatRow = {
  spikeKill: number; spikeError: number; spikeAttempt: number
  blockKill: number; blockError: number; blockRebound: number
  serveAce: number; serveError: number; serveAttempt: number
  digExcellent: number; digFault: number; digAttempt: number
  setExcellent: number; setFault: number; setAttempt: number
  receiveExcellent: number; receiveError: number; receiveAttempt: number
}

const EMPTY_STATS = (): StatRow => ({
  spikeKill: 0, spikeError: 0, spikeAttempt: 0,
  blockKill: 0, blockError: 0, blockRebound: 0,
  serveAce: 0, serveError: 0, serveAttempt: 0,
  digExcellent: 0, digFault: 0, digAttempt: 0,
  setExcellent: 0, setFault: 0, setAttempt: 0,
  receiveExcellent: 0, receiveError: 0, receiveAttempt: 0,
})

// ─── Hub (lock screen) ────────────────────────────────────────

function VisStatsPage() {
  const { matches = [], leaderboard = [] } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [view, setView] = useState<'hub' | 'match' | 'dashboard'>('hub')
  const [activeMatch, setActiveMatch] = useState<any>(null)
  const [activeMatchData, setActiveMatchData] = useState<any>(null)
  const [tournamentContext, setTournamentContext] = useState<{
    tournamentId: string
    matchId: string
    teamA: string
    teamB: string
    date: string
    venue: string
    sets: number
    players: { name: string; jersey: number }[]
  } | null>(null)
  const { toast, showToast } = useToast()

  // Parse tournament deep-link context
  useEffect(() => {
    if (search.tournamentId && search.matchId) {
      setTournamentContext({
        tournamentId: search.tournamentId,
        matchId: search.matchId,
        teamA: search.teamA ?? 'The Rebels',
        teamB: search.teamB ?? 'Opponent',
        date: search.date ?? new Date().toISOString().slice(0, 10),
        venue: search.venue ?? '',
        sets: parseInt(search.sets ?? '3') || 3,
        players: (() => {
          try { return JSON.parse(search.players ?? '[]') } catch { return [] }
        })(),
      })
    }
  }, [search.tournamentId, search.matchId])

  // With a tournament context, surface any already-linked match for this game
  useEffect(() => {
    if (!tournamentContext) return
    const autoOpenTournamentMatch = async () => {
      try {
        // Check if a VIS match already exists for this tournament match
        const existing = await findMatchByTournamentMatchId({
          data: {
            tournamentId: tournamentContext.tournamentId,
            tournamentMatchId: tournamentContext.matchId,
          }
        })
        if (existing) {
          showToast(`Found existing stats for ${existing.teamName} vs ${existing.opponentName}. Open it below.`, 'success')
          return // user will use the MatchCard in hub
        }
      } catch {
        // No existing match — the hub will show the pre-filled form
      }
    }
    autoOpenTournamentMatch()
  }, [tournamentContext])

  if (view === 'dashboard') {
    return (
      <Dashboard
        leaderboard={leaderboard}
        onBack={() => setView('hub')}
        showToast={showToast}
      />
    )
  }

  if (view === 'match' && activeMatch && activeMatchData) {
    return (
      <MatchTally
        match={activeMatch}
        matchData={activeMatchData}
        onBack={() => {
          setView('hub')
          setActiveMatch(null)
          setActiveMatchData(null)
          // Clear tournament params from URL when going back
          if (tournamentContext) {
            navigate({ to: '/vis-stats', search: {} })
            setTournamentContext(null)
          }
        }}
        showToast={showToast}
        onDataRefresh={async () => {
          const data = await getMatchData({ data: { matchId: activeMatch.id } })
          setActiveMatchData(data)
        }}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {toast && <ToastBar toast={toast} />}
      {/* Deprecation notice */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
        <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-400">Legacy System — Use New VIS Stats</p>
          <p className="text-sm text-[rgb(var(--muted-fg))] mt-0.5">
            This page is being phased out. All new stat entry should be done via <strong>Tournaments → your tournament → VIS Stats tab</strong>. Existing matches below are preserved for reference only.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={20} className="text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight">VIS Stats Hub</h1>
          </div>
          <p className="text-sm text-[rgb(var(--muted-fg))]">The Rebels · Match Statistics</p>
        </div>
        <button
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2 px-4 py-2 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl text-sm font-medium hover:bg-[rgb(var(--surface-hover))] transition-colors"
        >
          <Trophy size={15} />
          Dashboard
        </button>
      </div>

      {/* Tournament context banner */}
      {tournamentContext && (
        <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-3">
          <Link2 size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-300">Linked from Tournament</p>
            <p className="text-xs text-[rgb(var(--muted-fg))] mt-0.5">
              {tournamentContext.teamA} vs {tournamentContext.teamB} · {tournamentContext.date}
              {tournamentContext.venue && ` · ${tournamentContext.venue}`}
            </p>
            <p className="text-xs text-blue-400 mt-1">
              Create a new VIS match below to start tracking stats for this game, or open an existing one.
            </p>
          </div>
        </div>
      )}

      {/* New match — pre-filled if tournament context */}
      <NewMatchForm
        showToast={showToast}
        tournamentContext={tournamentContext}
        onCreated={async (matchId) => {
          const data = await getMatchData({ data: { matchId } })
          setActiveMatch(data.match)
          setActiveMatchData(data)
          setView('match')
        }}
      />

      {/* Matches list */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-3">Recent Matches</h2>
        {matches.length === 0 ? (
          <div className="text-center py-12 text-[rgb(var(--muted-fg))] text-sm">No matches yet. Create one above.</div>
        ) : (
          <div className="space-y-2">
            {matches.map((m: any) => (
              <MatchCard key={m.id} match={m} showToast={showToast}
                highlighted={!!(tournamentContext && m.tournamentMatchId === tournamentContext.matchId)}
                onOpen={async () => {
                  const data = await getMatchData({ data: { matchId: m.id } })
                  setActiveMatch(data.match)
                  setActiveMatchData(data)
                  setView('match')
                }}
                onDeleted={() => window.location.reload()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── New Match Form ───────────────────────────────────────────

function NewMatchForm({ showToast, onCreated, tournamentContext }: {
  showToast: (msg: string, t: 'success' | 'error') => void
  onCreated: (matchId: number) => void
  tournamentContext?: {
    tournamentId: string
    matchId: string
    teamA: string
    teamB: string
    date: string
    venue: string
    sets: number
    players: { name: string; jersey: number }[]
  } | null
}) {
  const [open, setOpen] = useState(!!tournamentContext)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    matchDate: tournamentContext?.date ?? new Date().toISOString().slice(0, 10),
    teamName: tournamentContext?.teamA ?? 'The Rebels',
    opponentName: tournamentContext?.teamB ?? '',
    location: tournamentContext?.venue ?? '',
    totalSets: tournamentContext?.sets ?? 3,
  })
  const [players, setPlayers] = useState<{ jerseyNumber: number; playerName: string }[]>(
    tournamentContext?.players?.length
      ? tournamentContext.players.map(p => ({ jerseyNumber: p.jersey, playerName: p.name }))
      : [{ jerseyNumber: 0, playerName: '' }]
  )

  // Sync form if tournament context arrives after mount
  useEffect(() => {
    if (tournamentContext) {
      setOpen(true)
      setForm({
        matchDate: tournamentContext.date,
        teamName: tournamentContext.teamA,
        opponentName: tournamentContext.teamB,
        location: tournamentContext.venue,
        totalSets: tournamentContext.sets,
      })
      if (tournamentContext.players.length > 0) {
        setPlayers(tournamentContext.players.map(p => ({ jerseyNumber: p.jersey, playerName: p.name })))
      }
    }
  }, [tournamentContext?.matchId])

  const submit = async () => {
    if (!form.opponentName) {
      showToast('Opponent name is required', 'error')
      return
    }
    const validPlayers = players.filter(p => p.playerName.trim())
    setLoading(true)
    try {
      const { id } = await createMatch({
        data: {
          ...form,
          players: validPlayers,
          tournamentId: tournamentContext?.tournamentId,
          tournamentMatchId: tournamentContext?.matchId,
        }
      })
      showToast('Match created!', 'success')
      onCreated(id)
    } catch (e: any) {
      showToast(e.message || 'Failed to create match', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-semibold transition-colors"
      >
        <Plus size={18} /> New Match
      </button>
    )
  }

  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">New Match</h2>
          {tournamentContext && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full flex items-center gap-1">
              <Link2 size={10} /> From Tournament
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Team Name</label>
          <input value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Opponent *</label>
          <input value={form.opponentName} onChange={e => setForm(f => ({ ...f, opponentName: e.target.value }))}
            placeholder="Opponent team"
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Date</label>
          <input type="date" value={form.matchDate} onChange={e => setForm(f => ({ ...f, matchDate: e.target.value }))}
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Max Sets</label>
          <select value={form.totalSets} onChange={e => setForm(f => ({ ...f, totalSets: +e.target.value }))}
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-[rgb(var(--muted-fg))] mb-1 block">Location</label>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="Gym / venue"
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Players */}
      <div className="mb-4">
        <label className="text-xs text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-2 block">
          {tournamentContext?.players?.length ? 'Players (pre-filled from tournament roster)' : 'Players (optional — add now or later)'}
        </label>
        {players.map((p, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input type="number" value={p.jerseyNumber || ''} onChange={e => {
              const v = [...players]; v[i].jerseyNumber = +e.target.value; setPlayers(v)
            }} placeholder="#" className="w-16 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-center" />
            <input value={p.playerName} onChange={e => {
              const v = [...players]; v[i].playerName = e.target.value; setPlayers(v)
            }} placeholder="Player name" className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
            <button onClick={() => setPlayers(p => p.filter((_, j) => j !== i))}
              className="text-[rgb(var(--muted-fg))] hover:text-red-400"><X size={15} /></button>
          </div>
        ))}
        <button onClick={() => setPlayers(p => [...p, { jerseyNumber: 0, playerName: '' }])}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
          <Plus size={13} /> Add player
        </button>
      </div>

      <button onClick={submit} disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
        {loading ? 'Creating…' : 'Create Match & Open Tally'}
      </button>
    </div>
  )
}

// ─── Match Card ───────────────────────────────────────────────

function MatchCard({ match, showToast, onOpen, onDeleted, highlighted }: {
  match: any
  showToast: (msg: string, t: 'success' | 'error') => void
  onOpen: () => void
  onDeleted: () => void
  highlighted?: boolean
}) {
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDel, setShowDel] = useState(false)

  const open = () => {
    onOpen()
  }

  const del = async () => {
    setLoading(true)
    try {
      await deleteMatch({ data: { matchId: match.id } })
      showToast('Match deleted', 'success')
      onDeleted()
    } catch (e: any) {
      setErr(e.message || 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bg-[rgb(var(--surface))] border rounded-2xl overflow-hidden transition-colors ${highlighted ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-[rgb(var(--border))]'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{match.teamName} vs {match.opponentName}</span>
            {match.tournamentMatchId && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-0.5">
                <Link2 size={8} /> Tournament
              </span>
            )}
            {highlighted && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">
                This match
              </span>
            )}
          </div>
          <div className="text-xs text-[rgb(var(--muted-fg))] mt-0.5">
            {match.matchDate} · Best of {match.totalSets} sets
            {match.location && ` · ${match.location}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowDel(d => !d); setErr('') }}
            className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-xl">
            <Trash2 size={14} />
          </button>
          <button onClick={open}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgb(var(--surface-hover))] rounded-xl text-xs font-medium hover:bg-[rgb(var(--border))] transition-colors">
            <Lock size={12} />
            Open
          </button>
        </div>
      </div>

      {showDel && (
        <div className="border-t border-[rgb(var(--border))] px-4 py-3 bg-[rgb(var(--bg))]">
          <p className="text-xs text-red-400 mb-2">Delete this match and all its stats? This cannot be undone.</p>
          {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
          <button onClick={del} disabled={loading}
            className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg">
            {loading ? '…' : 'Yes, Delete'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Match Tally Sheet ────────────────────────────────────────

function MatchTally({ match, matchData, onBack, showToast, onDataRefresh }: {
  match: any; matchData: any
  onBack: () => void
  showToast: (msg: string, t: 'success' | 'error') => void
  onDataRefresh: () => void
}) {
  const [currentSet, setCurrentSet] = useState(1)
  const [players, setPlayers] = useState<any[]>(matchData.players)
  const [stats, setStats] = useState<Record<string, StatRow>>(() => {
    const init: Record<string, StatRow> = {}
    for (const p of matchData.players) {
      const existing = matchData.stats.find((s: any) => s.playerId === p.id && s.setNumber === 1)
      init[p.id] = existing ? { ...existing } : EMPTY_STATS()
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [newJersey, setNewJersey] = useState('')
  const [newName, setNewName] = useState('')
  const [saved, setSaved] = useState(false)

  // Load stats for a set
  const loadSetStats = (setNum: number) => {
    const newStats: Record<string, StatRow> = {}
    for (const p of players) {
      const existing = matchData.stats.find((s: any) => s.playerId === p.id && s.setNumber === setNum)
      newStats[p.id] = existing ? { ...existing } : EMPTY_STATS()
    }
    setStats(newStats)
  }

  const changeSet = (n: number) => {
    setCurrentSet(n)
    loadSetStats(n)
  }

  const increment = (playerId: number, field: keyof StatRow) => {
    setStats(s => ({ ...s, [playerId]: { ...s[playerId], [field]: (s[playerId]?.[field] || 0) + 1 } }))
    setSaved(false)
  }

  const decrement = (playerId: number, field: keyof StatRow) => {
    setStats(s => ({ ...s, [playerId]: { ...s[playerId], [field]: Math.max(0, (s[playerId]?.[field] || 0) - 1) } }))
    setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const p of players) {
        await saveSetStats({
          data: {
            matchId: match.id,
            playerId: p.id,
            setNumber: currentSet,
            stats: stats[p.id] || EMPTY_STATS(),
          }
        })
      }
      setSaved(true)
      showToast('Stats saved!', 'success')
      await onDataRefresh()
    } catch (e: any) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addPlayer = async () => {
    if (!newName.trim()) return
    try {
      const player = await addPlayerToMatch({
        data: { matchId: match.id, jerseyNumber: +newJersey || 0, playerName: newName.trim() }
      })
      setPlayers(p => [...p, player])
      setStats(s => ({ ...s, [player.id]: EMPTY_STATS() }))
      setNewJersey(''); setNewName(''); setAddingPlayer(false)
      showToast('Player added', 'success')
    } catch (e: any) {
      showToast(e.message || 'Failed to add player', 'error')
    }
  }

  const removePlayer = async (playerId: number) => {
    try {
      await removePlayerFromMatch({ data: { playerId, matchId: match.id } })
      setPlayers(p => p.filter(x => x.id !== playerId))
      setStats(s => { const n = { ...s }; delete n[playerId]; return n })
      showToast('Player removed', 'success')
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error')
    }
  }

  const downloadCard = useCallback(() => {
    const canvas = document.createElement('canvas')
    const W = 1200, H = 800 + players.length * 60
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    // Background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)
    // Header gradient
    const grad = ctx.createLinearGradient(0, 0, W, 100)
    grad.addColorStop(0, '#1d4ed8')
    grad.addColorStop(1, '#7c3aed')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, 100)
    // Header text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px -apple-system, sans-serif'
    ctx.fillText('The Rebels', 40, 45)
    ctx.font = '20px -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(`vs ${match.opponentName} · Set ${currentSet} · ${match.matchDate}`, 40, 80)
    // Watermark
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'right'
    ctx.fillText('REBELS VIS STATS', W - 40, 55)
    ctx.textAlign = 'left'

    const offenseCols = ['SK', 'SE', 'SA', 'BK', 'BE', 'SAce', 'SErr']
    const defenseCols = ['DX', 'DF', 'SX', 'SF', 'RX', 'RE']
    const allCols = [...offenseCols, ...defenseCols]

    // Column headers
    ctx.fillStyle = '#374151'
    ctx.fillRect(0, 100, W, 50)
    ctx.fillStyle = '#9ca3af'
    ctx.font = 'bold 14px monospace'
    const colW = (W - 300) / allCols.length
    ctx.fillText('#  Name', 20, 132)
    allCols.forEach((col, i) => {
      const x = 300 + i * colW
      ctx.fillText(col, x, 132)
    })

    // Offense/Defense divider line
    const offX = 300 + offenseCols.length * colW
    ctx.strokeStyle = '#4b5563'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(offX - 5, 100); ctx.lineTo(offX - 5, H); ctx.stroke()

    // Labels
    ctx.fillStyle = '#3b82f6'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText('← OFFENSE', 310, 118)
    ctx.fillStyle = '#8b5cf6'
    ctx.fillText('← DEFENSE', offX + 5, 118)

    players.forEach((p, idx) => {
      const y = 150 + idx * 55
      const row = stats[p.id] || EMPTY_STATS()
      ctx.fillStyle = idx % 2 === 0 ? '#111' : '#1a1a1a'
      ctx.fillRect(0, y - 5, W, 55)
      ctx.fillStyle = '#e5e7eb'
      ctx.font = '16px -apple-system, sans-serif'
      ctx.fillText(`${p.jerseyNumber}  ${p.playerName}`, 20, y + 25)

      const vals = [
        row.spikeKill, row.spikeError, row.spikeAttempt,
        row.blockKill, row.blockError, row.serveAce, row.serveError,
        row.digExcellent, row.digFault, row.setExcellent, row.setFault,
        row.receiveExcellent, row.receiveError,
      ]
      vals.forEach((val, i) => {
        const x = 300 + i * colW
        const isPositive = [0, 3, 5, 7, 9, 11].includes(i)
        const isNegative = [1, 4, 6, 8, 10, 12].includes(i)
        ctx.fillStyle = isPositive ? '#34d399' : isNegative ? '#f87171' : '#9ca3af'
        ctx.font = 'bold 18px monospace'
        ctx.fillText(String(val), x, y + 25)
      })
    })

    // Footer
    const fy = 150 + players.length * 55 + 20
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, fy, W, 60)
    ctx.fillStyle = '#6b7280'
    ctx.font = '14px sans-serif'
    ctx.fillText('THE REBELS · VIS Match Statistics System', 40, fy + 35)
    ctx.textAlign = 'right'
    ctx.fillText('rebels-vb.netlify.app', W - 40, fy + 35)

    const a = document.createElement('a')
    a.download = `rebels-stats-vs-${match.opponentName}-set${currentSet}.jpg`.replace(/\s+/g, '-')
    a.href = canvas.toDataURL('image/jpeg', 0.92)
    a.click()
    showToast('Image downloaded!', 'success')
  }, [players, stats, match, currentSet, showToast])

  return (
    <div className="max-w-full px-3 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors">
          <X size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{match.teamName} vs {match.opponentName}</h1>
          <p className="text-xs text-[rgb(var(--muted-fg))]">{match.matchDate}{match.location && ` · ${match.location}`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCard}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-medium transition-colors">
            <Download size={13} /> JPG
          </button>
          <button onClick={saveAll} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Set selector */}
      <div className="flex gap-2 mb-5">
        {Array.from({ length: match.totalSets }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => changeSet(n)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentSet === n ? 'bg-blue-600 text-white' : 'bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'}`}>
            Set {n}
          </button>
        ))}
      </div>

      {/* OFFENSE TABLE */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={15} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Offense</h2>
        </div>
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgb(var(--border))]">
                  <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))] sticky left-0 bg-[rgb(var(--surface))]">Player</th>
                  {[
                    { key: 'spikeKill', label: 'SK+', color: 'text-green-400', group: 'Spike' },
                    { key: 'spikeError', label: 'SE-', color: 'text-red-400', group: 'Spike' },
                    { key: 'spikeAttempt', label: 'SA0', color: 'text-[rgb(var(--muted-fg))]', group: 'Spike' },
                    { key: 'blockKill', label: 'BK+', color: 'text-green-400', group: 'Block' },
                    { key: 'blockError', label: 'BE-', color: 'text-red-400', group: 'Block' },
                    { key: 'blockRebound', label: 'BR', color: 'text-[rgb(var(--muted-fg))]', group: 'Block' },
                    { key: 'serveAce', label: 'Ace+', color: 'text-green-400', group: 'Serve' },
                    { key: 'serveError', label: 'SE-', color: 'text-red-400', group: 'Serve' },
                    { key: 'serveAttempt', label: 'SIn', color: 'text-[rgb(var(--muted-fg))]', group: 'Serve' },
                  ].map(col => (
                    <th key={col.key} className={`px-2 py-2.5 font-semibold ${col.color} whitespace-nowrap`}>{col.label}</th>
                  ))}
                  <th className="px-2 py-2.5 text-[rgb(var(--muted-fg))]"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, idx) => {
                  const row = stats[p.id] || EMPTY_STATS()
                  const pts = row.spikeKill + row.blockKill + row.serveAce
                  return (
                    <tr key={p.id} className={`border-b border-[rgb(var(--border-soft))] ${idx % 2 === 0 ? '' : 'bg-[rgb(var(--surface-hover))]'}`}>
                      <td className="px-3 py-2 sticky left-0 bg-inherit whitespace-nowrap">
                        <span className="text-[rgb(var(--muted-fg))] mr-1.5 font-mono">#{p.jerseyNumber}</span>
                        <span className="font-medium">{p.playerName}</span>
                      </td>
                      {(['spikeKill','spikeError','spikeAttempt','blockKill','blockError','blockRebound','serveAce','serveError','serveAttempt'] as (keyof StatRow)[]).map(field => (
                        <td key={field} className="px-1 py-1.5 text-center">
                          <TallyCell value={(row[field] as number) || 0}
                            onInc={() => increment(p.id, field)}
                            onDec={() => decrement(p.id, field)}
                            positive={['spikeKill','blockKill','serveAce'].includes(field)}
                            negative={['spikeError','blockError','serveError'].includes(field)}
                          />
                        </td>
                      ))}
                      <td className="px-2 text-center">
                        <span className="text-xs font-bold text-blue-400">{pts}pts</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DEFENSE TABLE */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={15} className="text-purple-400" />
          <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Defense & Ball Handling</h2>
        </div>
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgb(var(--border))]">
                  <th className="text-left px-3 py-2.5 font-medium text-[rgb(var(--muted-fg))] sticky left-0 bg-[rgb(var(--surface))]">Player</th>
                  {[
                    { key: 'digExcellent', label: 'DX+', color: 'text-green-400' },
                    { key: 'digFault', label: 'DF-', color: 'text-red-400' },
                    { key: 'digAttempt', label: 'DA', color: 'text-[rgb(var(--muted-fg))]' },
                    { key: 'setExcellent', label: 'SX+', color: 'text-green-400' },
                    { key: 'setFault', label: 'SF-', color: 'text-red-400' },
                    { key: 'setAttempt', label: 'SAtt', color: 'text-[rgb(var(--muted-fg))]' },
                    { key: 'receiveExcellent', label: 'RX+', color: 'text-green-400' },
                    { key: 'receiveError', label: 'RE-', color: 'text-red-400' },
                    { key: 'receiveAttempt', label: 'RA', color: 'text-[rgb(var(--muted-fg))]' },
                  ].map(col => (
                    <th key={col.key} className={`px-2 py-2.5 font-semibold ${col.color} whitespace-nowrap`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p, idx) => {
                  const row = stats[p.id] || EMPTY_STATS()
                  return (
                    <tr key={p.id} className={`border-b border-[rgb(var(--border-soft))] ${idx % 2 === 0 ? '' : 'bg-[rgb(var(--surface-hover))]'}`}>
                      <td className="px-3 py-2 sticky left-0 bg-inherit whitespace-nowrap">
                        <span className="text-[rgb(var(--muted-fg))] mr-1.5 font-mono">#{p.jerseyNumber}</span>
                        <span className="font-medium">{p.playerName}</span>
                      </td>
                      {(['digExcellent','digFault','digAttempt','setExcellent','setFault','setAttempt','receiveExcellent','receiveError','receiveAttempt'] as (keyof StatRow)[]).map(field => (
                        <td key={field} className="px-1 py-1.5 text-center">
                          <TallyCell value={(row[field] as number) || 0}
                            onInc={() => increment(p.id, field)}
                            onDec={() => decrement(p.id, field)}
                            positive={['digExcellent','setExcellent','receiveExcellent'].includes(field)}
                            negative={['digFault','setFault','receiveError'].includes(field)}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add player */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-4">
        <button onClick={() => setAddingPlayer(a => !a)}
          className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]">
          <Plus size={15} /> {addingPlayer ? 'Cancel' : 'Add player to this match'}
        </button>
        {addingPlayer && (
          <div className="flex gap-2 mt-3">
            <input type="number" value={newJersey} onChange={e => setNewJersey(e.target.value)}
              placeholder="#" className="w-16 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-center" />
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="Player name"
              className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
            <button onClick={addPlayer}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium">Add</button>
          </div>
        )}
        {players.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[rgb(var(--surface-hover))] rounded-lg text-xs">
                <span className="text-[rgb(var(--muted-fg))]">#{p.jerseyNumber}</span>
                <span>{p.playerName}</span>
                <button onClick={() => removePlayer(p.id)} className="text-[rgb(var(--muted-fg))] hover:text-red-400 ml-1">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tally Cell — tap + / – for live entry ───────────────────

function TallyCell({ value, onInc, onDec, positive, negative }: {
  value: number; onInc: () => void; onDec: () => void
  positive?: boolean; negative?: boolean
}) {
  const color = positive ? 'text-green-400' : negative ? 'text-red-400' : 'text-[rgb(var(--fg))]'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button onClick={onInc}
        className="w-7 h-5 flex items-center justify-center bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border))] rounded text-[10px] leading-none transition-colors">
        +
      </button>
      <span className={`font-mono font-bold text-sm min-w-[1.5rem] text-center ${color}`}>{value}</span>
      <button onClick={onDec}
        className="w-7 h-5 flex items-center justify-center bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border))] rounded text-[10px] leading-none transition-colors">
        –
      </button>
    </div>
  )
}

// ─── Dashboard / Top 10 Leaderboard ──────────────────────────

const SKILLS = [
  { key: 'totalPoints', label: 'Total Points', icon: Trophy, color: 'yellow', format: (v: any) => v },
  { key: 'spikeKill', label: 'Spike Kills', icon: Zap, color: 'blue', format: (v: any) => v },
  { key: 'spikeEff', label: 'Spike Efficiency %', icon: Target, color: 'green', format: (v: any) => `${v}%` },
  { key: 'blockKill', label: 'Block Kills', icon: Shield, color: 'purple', format: (v: any) => v },
  { key: 'blocksPerSet', label: 'Blocks/Set', icon: Shield, color: 'indigo', format: (v: any) => v },
  { key: 'serveAce', label: 'Serve Aces', icon: Zap, color: 'orange', format: (v: any) => v },
  { key: 'acesPerSet', label: 'Aces/Set', icon: Zap, color: 'amber', format: (v: any) => v },
  { key: 'digExcellent', label: 'Dig Excellents', icon: Shield, color: 'teal', format: (v: any) => v },
  { key: 'digsPerSet', label: 'Digs/Set', icon: Shield, color: 'cyan', format: (v: any) => v },
  { key: 'receiveEff', label: 'Receive Efficiency %', icon: Target, color: 'emerald', format: (v: any) => `${v}%` },
]

const colorMap: Record<string, string> = {
  yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  blue: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  green: 'text-green-400 bg-green-400/10 border-green-400/30',
  purple: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  orange: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  amber: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  teal: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  cyan: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
}

function Dashboard({ leaderboard, onBack, showToast }: {
  leaderboard: any[]; onBack: () => void
  showToast: (msg: string, t: 'success' | 'error') => void
}) {
  const [activeSkill, setActiveSkill] = useState(SKILLS[0])

  const top10 = [...(leaderboard ?? [])]
    .filter(p => {
      const v = p[activeSkill.key]
      return v !== '—' && +v > 0
    })
    .sort((a, b) => parseFloat(b[activeSkill.key]) - parseFloat(a[activeSkill.key]))
    .slice(0, 10)

  const max = top10.length > 0 ? parseFloat(top10[0][activeSkill.key]) : 1

  const downloadDashboard = () => {
    const canvas = document.createElement('canvas')
    const W = 1000, H = 700
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, W, 100)
    grad.addColorStop(0, '#1d4ed8'); grad.addColorStop(1, '#7c3aed')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 100)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px -apple-system, sans-serif'
    ctx.fillText('The Rebels', 40, 42)
    ctx.font = '18px -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(`Top 10 · ${activeSkill.label}`, 40, 78)
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'right'
    ctx.fillText('REBELS VIS STATS', W - 40, 55)
    ctx.textAlign = 'left'

    top10.forEach((p, i) => {
      const y = 130 + i * 55
      const barW = Math.max(10, ((parseFloat(p[activeSkill.key]) / max) * (W - 400)))
      ctx.fillStyle = i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#1d4ed8'
      ctx.fillRect(300, y, barW, 35)
      ctx.fillStyle = '#e5e7eb'
      ctx.font = `bold 18px -apple-system, sans-serif`
      ctx.fillText(`${i + 1}. #${p.jerseyNumber} ${p.playerName}`, 20, y + 25)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px monospace'
      ctx.fillText(activeSkill.format(p[activeSkill.key]), 310 + barW, y + 25)
    })

    const fy = H - 50
    ctx.fillStyle = '#1f2937'; ctx.fillRect(0, fy, W, 50)
    ctx.fillStyle = '#6b7280'; ctx.font = '13px sans-serif'
    ctx.fillText('THE REBELS · rebels-vb.netlify.app', 40, fy + 32)

    const a = document.createElement('a')
    a.download = `rebels-top10-${activeSkill.key}.jpg`.replace(/\s+/g, '-')
    a.href = canvas.toDataURL('image/jpeg', 0.92)
    a.click()
    showToast('Image downloaded!', 'success')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={onBack} className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"><X size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-xs text-[rgb(var(--muted-fg))]">All-time across all matches</p>
        </div>
        <button onClick={downloadDashboard}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-xl text-sm font-medium transition-colors">
          <Download size={14} /> Download JPG
        </button>
      </div>

      {/* Skill pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SKILLS.map(s => (
          <button key={s.key} onClick={() => setActiveSkill(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${activeSkill.key === s.key ? colorMap[s.color] + ' border' : 'bg-[rgb(var(--surface))] border-[rgb(var(--border))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
        <div className={`px-5 py-3 border-b border-[rgb(var(--border))] ${colorMap[activeSkill.color]} flex items-center gap-2`}>
          <activeSkill.icon size={15} />
          <span className="font-semibold text-sm">Top 10 · {activeSkill.label}</span>
        </div>

        {top10.length === 0 ? (
          <div className="text-center py-12 text-[rgb(var(--muted-fg))] text-sm">No data yet. Record some matches first!</div>
        ) : (
          <div>
            {top10.map((p, i) => (
              <div key={p.playerName + i}
                className={`flex items-center gap-4 px-5 py-3.5 border-b border-[rgb(var(--border-soft))] ${i % 2 === 0 ? '' : 'bg-[rgb(var(--surface-hover))]'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' : i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' : i === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' : 'bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))]'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.playerName}</span>
                    <span className="text-xs text-[rgb(var(--muted-fg))] font-mono">#{p.jerseyNumber}</span>
                  </div>
                  <div className="mt-1.5 bg-[rgb(var(--bg))] rounded-full overflow-hidden h-1.5">
                    <div className={`h-full rounded-full transition-all ${activeSkill.color === 'yellow' ? 'bg-yellow-400' : activeSkill.color === 'green' ? 'bg-green-400' : activeSkill.color === 'purple' ? 'bg-purple-400' : 'bg-blue-500'}`}
                      style={{ width: `${Math.max(4, (parseFloat(p[activeSkill.key]) / max) * 100)}%` }} />
                  </div>
                </div>
                <div className={`text-base font-bold tabular-nums ${colorMap[activeSkill.color].split(' ')[0]}`}>
                  {activeSkill.format(p[activeSkill.key])}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
