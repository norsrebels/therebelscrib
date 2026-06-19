const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

content = content.replace(
  "(['teams', 'matches', 'leaderboard', 'settings'] as const)",
  "(['teams', 'matches', 'leaderboard', 'player db', 'settings'] as const)"
);

content = content.replace(
  "{tab === 'leaderboard' && <LeaderboardTab state={state} />}",
  "{tab === 'leaderboard' && <LeaderboardTab state={state} />}\n            {tab === 'player db' && <PlayerDatabaseTab state={state} setState={setState} />}"
);

const playerDbCode = `
function PlayerDatabaseTab({ state, setState }: { state: TournamentState, setState: (s: TournamentState) => void }) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  
  // Players might be scattered across teams. We should manage them across the tournament, or maybe the tournament has a central player pool?
  // Let's check state.teams[].players.
  const allPlayers = state.teams.flatMap(t => t.players.map(p => ({ ...p, teamId: t.id, teamName: t.name })))

  const updatePlayer = (teamId: string, playerId: string, updates: Partial<Player>) => {
    setState({
      ...state,
      teams: state.teams.map(t => t.id === teamId ? {
        ...t,
        players: t.players.map(p => p.id === playerId ? { ...p, ...updates } : p)
      } : t)
    })
  }

  const deletePlayer = (teamId: string, playerId: string) => {
    setState({
      ...state,
      teams: state.teams.map(t => t.id === teamId ? {
        ...t,
        players: t.players.filter(p => p.id !== playerId)
      } : t)
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[rgb(var(--fg))]">Player Database</h2>
      </div>
      <div className="grid gap-4">
        {allPlayers.map(p => (
          <div key={p.id} className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[rgb(var(--border-soft))] rounded-full overflow-hidden shrink-0">
                {p.profilePicture ? (
                  <img src={p.profilePicture} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[rgb(var(--muted-fg))] text-xs font-bold">{p.name.charAt(0)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <input 
                  className="bg-transparent border-none text-[rgb(var(--fg))] font-bold text-sm focus:ring-0 p-0"
                  value={p.name}
                  onChange={e => updatePlayer(p.teamId, p.id, { name: e.target.value })}
                  placeholder="Player Name"
                />
                <div className="flex items-center gap-2 mt-1">
                  <select 
                    className="text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded px-1.5 py-0.5 text-[rgb(var(--muted-fg))]"
                    value={p.position}
                    onChange={e => updatePlayer(p.teamId, p.id, { position: e.target.value as any })}
                  >
                    <option value="">Position...</option>
                    <option value="Setter">Setter</option>
                    <option value="Outside Hitter">Outside Hitter</option>
                    <option value="Libero">Libero</option>
                    <option value="Middle Blocker">Middle Blocker</option>
                    <option value="Opposite">Opposite</option>
                  </select>
                  <select 
                    className="text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded px-1.5 py-0.5 text-[rgb(var(--muted-fg))]"
                    value={p.skillLevel}
                    onChange={e => updatePlayer(p.teamId, p.id, { skillLevel: e.target.value as any })}
                  >
                    <option value="">Skill Level...</option>
                    <option value="Developmental">1 - Developmental</option>
                    <option value="Formative">2 - Formative</option>
                    <option value="Intermediate">3 - Intermediate</option>
                    <option value="Competitive">4 - Competitive</option>
                    <option value="Advance">5 - Advance</option>
                  </select>
                  <span className="text-[10px] text-[rgb(var(--muted-fg))] italic ml-2">Team: {p.teamName}</span>
                </div>
                <div className="mt-2">
                  <input
                    className="text-[10px] bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded px-1.5 py-0.5 text-[rgb(var(--muted-fg))] w-full max-w-[200px]"
                    placeholder="Profile Picture URL"
                    value={p.profilePicture || ''}
                    onChange={e => updatePlayer(p.teamId, p.id, { profilePicture: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <button onClick={() => deletePlayer(p.teamId, p.id)} className="text-red-400 hover:text-red-500 p-2"><Trash2 size={16} /></button>
          </div>
        ))}
        {allPlayers.length === 0 && (
          <div className="text-center py-16 text-[rgb(var(--muted-fg))] italic">No players added to teams yet.</div>
        )}
      </div>
    </div>
  )
}
`;

// insert playerDbCode before SettingsTab
const endPlayoffs = content.indexOf('function SettingsTab');
content = content.substring(0, endPlayoffs) + playerDbCode + '\n' + content.substring(endPlayoffs);

fs.writeFileSync('src/components/TournamentApp.tsx', content);

