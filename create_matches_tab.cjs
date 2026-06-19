const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

const matchesTabCode = `
function MatchesTab({ state, setState }: { state: TournamentState, setState: (s: TournamentState) => void }) {
  const updateMatch = (id: string, updates: Partial<PoolMatch>) => {
    setState({
      ...state,
      poolMatches: state.poolMatches.map(m => m.id === id ? { ...m, ...updates } : m)
    })
  }

  const poolA = state.teams.filter(t => t.pool === 'A').length
  const poolB = state.teams.filter(t => t.pool === 'B').length
  const template = buildBracketTemplate(poolA, poolB)
  const resolvedPlayoffs = resolvePlayoffGames(template, state.teams, state.poolMatches, state.playoffGames, state.settings.maxScore)

  const updateScore = (slot: string, field: 'scoreA'|'scoreB', val: string) => {
    const num = val === '' ? null : parseInt(val)
    const newGames = [...state.playoffGames]
    const idx = newGames.findIndex(g => g.slot === slot)
    
    if (idx >= 0) {
      newGames[idx] = { ...newGames[idx], [field]: isNaN(num!) ? null : num }
    } else {
      const g = resolvedPlayoffs.find(x => x.slot === slot)!
      newGames.push({ ...g, [field]: isNaN(num!) ? null : num })
    }
    setState({ ...state, playoffGames: newGames })
  }

  const updateCourt = (slot: string, val: string) => {
    const newGames = [...state.playoffGames]
    const idx = newGames.findIndex(g => g.slot === slot)
    if (idx >= 0) {
      newGames[idx] = { ...newGames[idx], court: val }
    } else {
      const g = resolvedPlayoffs.find(x => x.slot === slot)!
      newGames.push({ ...g, court: val })
    }
    setState({ ...state, playoffGames: newGames })
  }

  const updateIsFinal = (slot: string, val: boolean) => {
    const newGames = [...state.playoffGames]
    const idx = newGames.findIndex(g => g.slot === slot)
    if (idx >= 0) {
      newGames[idx] = { ...newGames[idx], isFinal: val }
    } else {
      const g = resolvedPlayoffs.find(x => x.slot === slot)!
      newGames.push({ ...g, isFinal: val })
    }
    setState({ ...state, playoffGames: newGames })
  }

  if (state.poolMatches.length === 0 && template.length === 0) {
    return (
      <div className="text-center py-16 text-[rgb(var(--muted-fg))]">
        <Calendar size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No matches scheduled yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {state.poolMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2 border-b border-[rgb(var(--border-soft))] pb-2">
            <h3 className="text-sm font-bold tracking-tight text-[rgb(var(--fg))]">Round Robin Phase</h3>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded-full">Pool Play</span>
          </div>
          <div className="grid gap-3">
            {state.poolMatches.slice().sort((a,b) => a.gameNum - b.gameNum).map(m => (
              <PoolMatchRow key={m.id} match={m} state={state} updateMatch={updateMatch} />
            ))}
          </div>
        </div>
      )}

      {resolvedPlayoffs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2 border-b border-[rgb(var(--border-soft))] pb-2">
            <h3 className="text-sm font-bold tracking-tight text-[rgb(var(--fg))]">Bracket Phase</h3>
            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[10px] font-bold rounded-full">Playoffs</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resolvedPlayoffs.map(g => {
              const tA = g.teamAId ? state.teams.find(t => t.id === g.teamAId) : null
              const tB = g.teamBId ? state.teams.find(t => t.id === g.teamBId) : null
              return (
                <div key={g.slot} className={cn('glass border rounded-xl p-4', g.phase === 'championship' ? 'border-[rgb(var(--fg)/0.3)]' : 'border-[rgb(var(--border))]')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateIsFinal(g.slot, !g.isFinal)}
                        className={cn("p-1 rounded flex items-center justify-center transition-colors", g.isFinal ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-[rgb(var(--muted-fg))] hover:bg-[rgb(var(--border-soft))] hover:text-[rgb(var(--fg))]")}
                        title={g.isFinal ? "Unlock score" : "Lock score (mark as final)"}
                      >
                        {g.isFinal ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <span className="text-xs font-mono text-[rgb(var(--muted-fg))]">{g.slot}</span>
                      <input
                        disabled={g.isFinal} className="w-16 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] text-[10px] text-center px-1 py-0.5 rounded text-[rgb(var(--fg))]"
                        placeholder="Court"
                        value={g.court}
                        onChange={(e) => updateCourt(g.slot, e.target.value)}
                      />
                    </div>
                    <span className={cn('text-[10px] font-bold tracking-normal ', PHASE_COLORS[g.phase as PlayoffPhase])}>{g.label}</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { t: tA, lbl: g.teamALabel, sc: g.scoreA, f: 'scoreA' as const },
                      { t: tB, lbl: g.teamBLabel, sc: g.scoreB, f: 'scoreB' as const }
                    ].map((row, i) => {
                      const hasAnyScore = g.scoreA !== null || g.scoreB !== null
                      const isComplete = isGameComplete(g, state.settings.maxScore)
                      const isWinner = isComplete && ((row.f === 'scoreA' && g.scoreA! > g.scoreB!) || (row.f === 'scoreB' && g.scoreB! > g.scoreA!))
                      const isLoser = isComplete && ((row.f === 'scoreA' && g.scoreA! < g.scoreB!) || (row.f === 'scoreB' && g.scoreB! < g.scoreA!))
                      return (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 truncate">
                          {isWinner && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">W</span>}
                          {isLoser && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">L</span>}
                          <span className={cn('text-sm font-semibold truncate', isWinner ? 'text-[rgb(var(--fg))]' : isComplete ? 'text-[rgb(var(--muted-fg))]' : 'text-[rgb(var(--fg))]', !row.t && 'text-[rgb(var(--muted-fg))] italic')}>
                            {row.t?.name ?? row.lbl}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasAnyScore && !isComplete && row.t && !g.isFinal && (
                            <button onClick={() => updateScore(g.slot, row.f, String(Math.max(0, (row.sc ?? 0) - 1)))} className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-red-500/15 text-red-400 font-bold text-sm hover:bg-red-500/25">-</button>
                          )}
                          <input type="number" min="0" disabled={!row.t || g.isFinal} className="w-14 shrink-0 text-center bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl py-1.5 font-bold disabled:opacity-30 text-[rgb(var(--fg))]" value={row.sc ?? ''} onChange={e => updateScore(g.slot, row.f, e.target.value)} />
                          {hasAnyScore && !isComplete && row.t && !g.isFinal && (
                            <button onClick={() => updateScore(g.slot, row.f, String((row.sc ?? 0) + 1))} className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-blue-500/10 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25">+</button>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
`;

// remove ScheduleTab
const startSchedule = content.indexOf('function ScheduleTab');
const endSchedule = content.indexOf('function LeaderboardTab');
content = content.substring(0, startSchedule) + matchesTabCode + '\n' + content.substring(endSchedule);

// remove PlayoffsTab
const startPlayoffs = content.indexOf('function PlayoffsTab');
const endPlayoffs = content.indexOf('function SettingsTab');
content = content.substring(0, startPlayoffs) + content.substring(endPlayoffs);

fs.writeFileSync('src/components/TournamentApp.tsx', content);

