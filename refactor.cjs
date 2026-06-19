const fs = require('fs');

let content = fs.readFileSync('src/components/TournamentApp.tsx', 'utf8');

const replacement = `
function PlayerCard({ p, updatePlayer, deletePlayer }: { p: any, updatePlayer: any, deletePlayer: any }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await uploadPlayerImage({ data: formData });
      if (res.success && res.url) {
        updatePlayer(p.teamId, p.id, { profilePicture: res.url });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-5 flex flex-col gap-4 relative group">
      <button 
        onClick={() => deletePlayer(p.teamId, p.id)} 
        className="absolute top-2 right-2 text-[rgb(var(--muted-fg))] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex items-center gap-4">
        <div 
          className="relative w-20 h-20 bg-[rgb(var(--border-soft))] rounded-full overflow-hidden shrink-0 group/avatar cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity">
              <Upload size={20} />
            </div>
          )}
          {p.profilePicture ? (
            <img src={p.profilePicture} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[rgb(var(--muted-fg))] text-xl font-bold bg-[rgb(var(--border-soft))]">
              {p.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1">
          <input 
            className="bg-transparent border-none text-[rgb(var(--fg))] font-bold text-base focus:ring-0 p-0 w-full"
            value={p.name}
            onChange={e => updatePlayer(p.teamId, p.id, { name: e.target.value })}
            placeholder="Player Name"
          />
          <div className="text-xs text-[rgb(var(--muted-fg))] italic">Team: {p.teamName}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <select 
          className="text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-2 py-1.5 text-[rgb(var(--muted-fg))]"
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
          className="text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-2 py-1.5 text-[rgb(var(--muted-fg))]"
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
      </div>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

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
    <div className="space-y-6 max-w-6xl mx-auto">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {allPlayers.map(p => (
          <PlayerCard key={p.id} p={p} updatePlayer={updatePlayer} deletePlayer={deletePlayer} />
        ))}
        {allPlayers.length === 0 && (
          <div className="col-span-full text-center py-16 text-[rgb(var(--muted-fg))] italic">No players added to teams yet.</div>
        )}
      </div>
    </div>
  )
}
`;

const startIndex = content.indexOf('function PlayerDatabaseTab');
const endIndex = content.indexOf('type LiveFilter');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + '\n\n  ' + content.substring(endIndex);
  fs.writeFileSync('src/components/TournamentApp.tsx', content);
  console.log('Replaced successfully');
} else {
  console.log('Failed to find indices', { startIndex, endIndex });
}
