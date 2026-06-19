const fs = require('fs');
let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

const replacement = `
function PlayerDatabaseTab({ state, setState }: { state: TournamentState, setState: (s: TournamentState) => void }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  
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
  
  const addPlayer = () => {
    if (!selectedTeamId) {
      alert("Please select a team to add the player to.");
      return;
    }
    setState({
      ...state,
      teams: state.teams.map(t => t.id === selectedTeamId ? {
        ...t,
        players: [...t.players, { id: crypto.randomUUID(), name: 'New Player', position: '', skillLevel: '', paymentStatus: 'Pending', profilePicture: '' }]
      } : t)
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-lg font-bold text-[rgb(var(--fg))]">Player Database</h2>
        <div className="flex items-center gap-2">
          <select 
            className="text-sm bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-3 py-2 text-[rgb(var(--fg))]"
            value={selectedTeamId}
            onChange={e => setSelectedTeamId(e.target.value)}
          >
            <option value="">Select Team...</option>
            {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={addPlayer} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-full font-bold text-sm tracking-normal px-5 py-2">
            <Plus size={16} /> ADD PLAYER
          </button>
        </div>
      </div>
      <div className="grid gap-4">
`;

content = content.replace(/function PlayerDatabaseTab\(\{[^]*?<div className="grid gap-4">/, replacement);
fs.writeFileSync('src/components/TournamentApp.tsx', content);
