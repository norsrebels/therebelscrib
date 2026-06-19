import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  loadState,
  saveState,
  generateRoundRobin,
  arrangePoolMatchesByGameNumber,
  computeStandings,
  buildBracketTemplate,
  resolvePlayoffGames,
  exportCSV,
  exportJSON,
  defaultState,
  isGameComplete,
  PHASE_LABELS,
  PHASE_COLORS,
  type TournamentState,
  type Team,
  type Pool,
  type TeamStanding,
  type Player,
  type PaymentStatus,
  type PlayerPosition,
  type SkillLevel,
  type PlayoffPhase,
  type PoolMatch,
  hasSecondRound,
  secondRoundHasScores,
  generateSecondRound,
  removeSecondRound,
  getOriginalRoundBoundary,
} from "@/lib/tournament";
import { useToast } from "@/lib/use-toast";
import { ToastBar } from "@/components/Modals";
import {
  Calendar,
  Lock,
  Unlock,
  RefreshCw,
  Download,
  Trash2,
  Plus,
  X,
  Link2,
  Moon,
  Sun,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Mail,
  Loader2,
  Upload,
  BarChart2,
} from "lucide-react";
import { Save, Check, AlertTriangle, Copy } from "lucide-react";
import { uploadPlayerImage } from "../server/player.functions";
import { VISStatsTab } from "./VISStatsTab";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const POSITIONS: PlayerPosition[] = [
  "OS",
  "OPP",
  "MB",
  "S",
  "L",
];

const POSITION_LABELS: Record<PlayerPosition, string> = {
  OS:  "Open Spiker",
  OPP: "Opposite Spiker",
  MB:  "Middle Blocker",
  S:   "Setter",
  L:   "Libero",
};
const SKILL_LEVELS: SkillLevel[] = [
  "Developmental",
  "Formative",
  "Intermediate",
  "Competitive",
  "Advanced",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Partial", "Paid"];

function formatDateTimeRange(
  date: string,
  startTime: string,
  endTime: string,
): string {
  const datePart = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const timePart = [startTime, endTime].filter(Boolean).join(" - ");
  return [datePart, timePart].filter(Boolean).join(" | ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerAutocomplete({
  onSelect,
}: {
  onSelect: (p: {
    name: string;
    id?: string;
    position?: PlayerPosition | "";
    skillLevel?: SkillLevel | "";
  }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    {
      id: string;
      name: string;
      position: PlayerPosition | "";
      skillLevel: SkillLevel | "";
    }[]
  >([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.players);
        }
      } catch (e) {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleManualAdd = () => {
    if (!query.trim()) return;
    onSelect({ name: query.trim() });
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-3 py-2 text-[rgb(var(--fg))] text-sm placeholder:text-[rgb(var(--muted-fg))] focus:border-[rgb(var(--fg))]"
          placeholder="Search master player profile or type name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
        />
        <button
          onClick={handleManualAdd}
          className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-full font-bold text-xs px-3 py-2 rounded-xl"
        >
          Add
        </button>
      </div>
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onSelect(r);
                setQuery("");
                setResults([]);
              }}
              className="w-full text-left px-4 py-2 hover:bg-[rgb(var(--bg))] text-sm text-[rgb(var(--fg))]"
            >
              <div className="font-semibold">{r.name}</div>
              <div className="text-[10px] text-[rgb(var(--muted-fg))]  tracking-normal">
                {r.position || "No Pos"} · {r.skillLevel || "No Skill"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamEditor({
  team,
  updateTeam,
}: {
  team: Team;
  updateTeam: (t: Team) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const addPlayer = (p: {
    name: string;
    id?: string;
    position?: PlayerPosition | "";
    skillLevel?: SkillLevel | "";
  }) => {
    const newPlayer: Player = {
      id: p.id || uid(),
      name: p.name,
      position: p.position || "",
      skillLevel: p.skillLevel || "",
      paymentStatus: "Pending",
    };
    updateTeam({ ...team, players: [...team.players, newPlayer] });
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    updateTeam({
      ...team,
      players: team.players.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    });
  };

  const removePlayer = (id: string) => {
    updateTeam({ ...team, players: team.players.filter((p) => p.id !== id) });
  };

  return (
    <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-[rgb(var(--fg))]">
            {team.name}
          </h4>
          <p className="text-xs text-[rgb(var(--muted-fg))] tracking-normal ">
            {team.players.length} Players
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded px-2 py-1 text-xs text-[rgb(var(--fg))]"
            value={team.paymentStatus}
            onChange={(e) =>
              updateTeam({
                ...team,
                paymentStatus: e.target.value as PaymentStatus,
              })
            }
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                Team: {s}
              </option>
            ))}
          </select>
          <select
            className="bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded px-2 py-1 text-xs text-[rgb(var(--fg))]"
            value={team.pool}
            onChange={(e) =>
              updateTeam({ ...team, pool: e.target.value as Pool })
            }
          >
            <option value="A">Pool A</option>
            <option value="B">Pool B</option>
          </select>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-[rgb(var(--fg))] border border-[rgb(var(--border-soft))] rounded px-2 py-1"
          >
            {expanded ? "Close Roster" : "Edit Roster"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[rgb(var(--border-soft))] space-y-4">
          <PlayerAutocomplete onSelect={addPlayer} />

          <div className="space-y-2">
            {team.players.map((p, i) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 bg-[rgb(var(--bg))] p-2 rounded-xl"
              >
                <span className="text-xs text-[rgb(var(--muted-fg))] w-4">
                  {i + 1}
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="w-16 bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded px-1.5 py-1 text-sm font-bold text-center text-[rgb(var(--fg))]"
                  placeholder="#"
                  value={p.jerseyNumber ?? ''}
                  onChange={(e) => updatePlayer(p.id, { jerseyNumber: parseInt(e.target.value) || null })}
                />
                <input
                  className="flex-1 min-w-[120px] bg-transparent border-none text-sm font-semibold text-[rgb(var(--fg))] focus:outline-none"
                  value={p.name}
                  onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                />
                <select
                  className="glass border border-[rgb(var(--border-soft))] rounded px-1.5 py-1 text-[10px] text-[rgb(var(--fg))]  tracking-normal"
                  value={p.position}
                  onChange={(e) =>
                    updatePlayer(p.id, {
                      position: e.target.value as PlayerPosition,
                    })
                  }
                >
                  <option value="">Pos...</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {POSITION_LABELS[pos]}
                    </option>
                  ))}
                </select>
                <select
                  className="glass border border-[rgb(var(--border-soft))] rounded px-1.5 py-1 text-[10px] text-[rgb(var(--fg))]  tracking-normal"
                  value={p.skillLevel}
                  onChange={(e) =>
                    updatePlayer(p.id, {
                      skillLevel: e.target.value as SkillLevel,
                    })
                  }
                >
                  <option value="">Skill...</option>
                  {SKILL_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className={cn(
                    "border rounded px-1.5 py-1 text-[10px]  tracking-normal font-bold",
                    p.paymentStatus === "Paid"
                      ? "border-green-500/50 text-green-500 bg-green-500/10"
                      : p.paymentStatus === "Partial"
                        ? "border-yellow-500/50 text-yellow-500 bg-yellow-500/10"
                        : "border-red-500/50 text-red-500 bg-red-500/10",
                  )}
                  value={p.paymentStatus}
                  onChange={(e) =>
                    updatePlayer(p.id, {
                      paymentStatus: e.target.value as PaymentStatus,
                    })
                  }
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removePlayer(p.id)}
                  className="text-[rgb(var(--muted-fg))] hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {team.players.length < 6 && (
              <p className="text-xs text-red-400 italic">
                Warning: Minimum 6 players recommended.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  confirmColor = "blue",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: "blue" | "red";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const colorClasses =
    confirmColor === "red"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative glass border border-[rgb(var(--border))] rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-amber-500/10">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <h3 className="text-sm font-bold text-[rgb(var(--fg))]">{title}</h3>
        </div>
        <p className="text-xs text-[rgb(var(--muted-fg))] mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--bg))]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl text-white shadow-sm",
              colorClasses,
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamsTab({
  state,
  setState,
}: {
  state: TournamentState;
  setState: (s: TournamentState) => void;
}) {
  const [name, setName] = useState("");
  const { toast, showToast } = useToast();
  const [pool, setPool] = useState<Pool>("A");
  const [csvPreview, setCsvPreview] = useState<{ jerseyNumber: number | null; name: string; position: string }[] | null>(null);
  const [csvTargetTeam, setCsvTargetTeam] = useState("");

  const addTeam = () => {
    if (!name.trim()) return;
    const team: Team = {
      id: uid(),
      name: name.trim(),
      pool,
      paymentStatus: "Pending",
      players: [],
    };
    setState({ ...state, teams: [...state.teams, team] });
    setName("");
  };

  const updateTeam = (updated: Team) => {
    setState({
      ...state,
      teams: state.teams.map((t) => (t.id === updated.id ? updated : t)),
    });
  };

  const removeTeam = (id: string) => {
    setState({
      ...state,
      teams: state.teams.filter((t) => t.id !== id),
      poolMatches: state.poolMatches
        .filter((m) => m.teamAId !== id && m.teamBId !== id)
        .map((m) =>
          m.officiatingTeamId === id ? { ...m, officiatingTeamId: null } : m,
        ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-5">
        <h3 className="text-xs font-bold tracking-tight  text-[rgb(var(--fg))] mb-4">
          Register Team
        </h3>
        <div className="flex gap-3 flex-wrap">
          <input
            className="flex-1 min-w-[200px] bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))] text-sm"
            placeholder="Team name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTeam()}
          />
          <select
            className="bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-[rgb(var(--fg))] text-sm"
            value={pool}
            onChange={(e) => setPool(e.target.value as Pool)}
          >
            <option value="A">Pool A</option>
            <option value="B">Pool B</option>
          </select>
          <button
            onClick={addTeam}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-full font-bold text-sm tracking-normal px-5 py-2.5 rounded-full"
          >
            <Plus size={16} /> ADD
          </button>
        </div>
      </div>

      {/* CSV Import */}
      {state.teams.length > 0 && (
        <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))] mb-3">Import Players (CSV)</h3>
          <div className="flex gap-3 items-center flex-wrap">
            <select
              className="bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-[rgb(var(--fg))] text-sm"
              value={csvTargetTeam}
              onChange={e => setCsvTargetTeam(e.target.value)}
            >
              <option value="">Select team...</option>
              {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="flex items-center gap-2 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm cursor-pointer hover:bg-[rgb(var(--surface))]">
              <Upload size={14} />
              Choose CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = evt => {
                    const text = evt.target?.result as string
                    if (!text) return
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                    if (lines.length < 2) return
                    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
                    const jerseyIdx = headers.findIndex(h => /^(jersey|#|number|jersey_number|jerseynumber)$/i.test(h))
                    const nameIdx = headers.findIndex(h => /^(name|full.?name|player.?name|player)$/i.test(h))
                    const posIdx = headers.findIndex(h => /^(pos|position)$/i.test(h))
                    if (nameIdx === -1) { alert('Could not find a "name" column in CSV'); return }
                    const rows = lines.slice(1).map(line => {
                      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
                      return {
                        jerseyNumber: jerseyIdx >= 0 ? parseInt(cols[jerseyIdx]) || null : null,
                        name: cols[nameIdx] || '',
                        position: posIdx >= 0 ? cols[posIdx] || '' : '',
                      }
                    }).filter(r => r.name)
                    setCsvPreview(rows)
                  }
                  reader.readAsText(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {csvPreview && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-[rgb(var(--muted-fg))]">{csvPreview.length} players found. Preview:</p>
              <div className="max-h-48 overflow-y-auto bg-[rgb(var(--bg))] rounded-xl border border-[rgb(var(--border-soft))] divide-y divide-[rgb(var(--border-soft))]">
                {csvPreview.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                    <span className="font-mono font-bold text-[rgb(var(--muted-fg))] w-8">#{r.jerseyNumber ?? '?'}</span>
                    <span className="font-medium">{r.name}</span>
                    {r.position && <span className="text-[rgb(var(--muted-fg))]">{r.position}</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!csvTargetTeam) { alert('Select a team first'); return }
                    const team = state.teams.find(t => t.id === csvTargetTeam)
                    if (!team) return
                    const newPlayers = csvPreview.map(r => ({
                      id: uid(),
                      name: r.name,
                      position: (r.position || '') as PlayerPosition | '',
                      skillLevel: '' as SkillLevel | '',
                      paymentStatus: 'Pending' as const,
                      jerseyNumber: r.jerseyNumber,
                    }))
                    const updatedTeam = { ...team, players: [...team.players, ...newPlayers] }
                    setState({ ...state, teams: state.teams.map(t => t.id === csvTargetTeam ? updatedTeam : t) })
                    setCsvPreview(null)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-xl text-xs font-bold"
                >
                  Import {csvPreview.length} Players
                </button>
                <button onClick={() => setCsvPreview(null)} className="px-4 py-2 text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {state.teams.map((team) => (
          <div key={team.id} className="relative">
            <button
              onClick={() => removeTeam(team.id)}
              className="absolute top-4 right-4 z-10 text-[rgb(var(--muted-fg))] hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
            <TeamEditor team={team} updateTeam={updateTeam} />
          </div>
        ))}
      </div>

      {state.teams.length >= 2 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => {
              const poolA = state.teams
                .filter((t) => t.pool === "A")
                .map((t) => t.id);
              const poolB = state.teams
                .filter((t) => t.pool === "B")
                .map((t) => t.id);
              const matchesA =
                poolA.length >= 2 ? generateRoundRobin(poolA, "A") : [];
              const matchesB =
                poolB.length >= 2 ? generateRoundRobin(poolB, "B") : [];
              const arranged = arrangePoolMatchesByGameNumber([
                ...matchesA,
                ...matchesB,
              ]);
              setState({ ...state, poolMatches: arranged, playoffGames: [] });
              showToast("Schedule generated successfully", "success");
            }}
            className="flex items-center gap-2 border border-[rgb(var(--fg))] text-[rgb(var(--fg))] font-bold text-sm tracking-normal px-6 py-3 rounded-xl hover:bg-[rgb(var(--fg))] hover:text-[rgb(var(--bg))]"
          >
            <Calendar size={16} /> GENERATE SCHEDULE
          </button>
        </div>
      )}
      <ToastBar toast={toast} />
    </div>
  );
}

function PoolMatchRow({
  match,
  state,
  updateMatch,
  tournamentId,
}: {
  match: PoolMatch;
  state: TournamentState;
  updateMatch: (id: string, updates: Partial<PoolMatch>) => void;
  tournamentId: string;
}) {
  const m = match;
  const tA = state.teams.find((t) => t.id === m.teamAId);
  const tB = state.teams.find((t) => t.id === m.teamBId);
  const done = isGameComplete(m, state.settings.maxScore, state.settings.leadScore);
  const winA = done && m.scoreA! > m.scoreB!;
  const winB = done && m.scoreB! > m.scoreA!;
  return (
    <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-3 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between border-b border-[rgb(var(--border-soft))] pb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-normal  text-[rgb(var(--fg))]">
            Pool {m.pool}
          </span>
          <span className="text-[rgb(var(--muted-fg))] text-xs font-mono font-bold">
            G{m.gameNum} · R{m.round}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateMatch(m.id, { isFinal: !m.isFinal })}
            className={cn(
              "p-1.5 rounded-md flex items-center justify-center transition-colors",
              m.isFinal
                ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                : "text-[rgb(var(--muted-fg))] hover:bg-[rgb(var(--border-soft))] hover:text-[rgb(var(--fg))]",
            )}
            title={m.isFinal ? "Unlock score" : "Lock score (mark as final)"}
          >
            {m.isFinal ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <span className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] hidden sm:inline">
            Court
          </span>
          <input
            disabled={m.isFinal}
            className="w-16 text-center text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded px-1.5 py-0.5 text-[rgb(var(--fg))]  placeholder:text-[rgb(var(--muted-fg))]/50"
            placeholder="Court"
            value={m.court}
            onChange={(e) => updateMatch(m.id, { court: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <span
            className={cn(
              "text-sm font-semibold truncate",
              winA
                ? "text-[rgb(var(--fg))]"
                : done
                  ? "text-[rgb(var(--muted-fg))]"
                  : "text-[rgb(var(--fg))]",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {winA && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 shrink-0">
                  W
                </span>
              )}
              {winB && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">
                  L
                </span>
              )}
              <span className="truncate">{tA?.name ?? "—"}</span>
            </span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {(m.scoreA !== null || m.scoreB !== null) && !m.isFinal && (
              <button
                onClick={() =>
                  updateMatch(m.id, {
                    scoreA: Math.max(0, (m.scoreA ?? 0) - 1),
                  })
                }
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-red-500/15 text-red-400 font-bold text-sm hover:bg-red-500/25"
              >
                -
              </button>
            )}
            <input
              type="number"
              min="0"
              disabled={m.isFinal}
              className="w-14 shrink-0 text-center bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl py-1.5 text-[rgb(var(--fg))] font-bold"
              value={m.scoreA ?? ""}
              onChange={(e) =>
                updateMatch(m.id, {
                  scoreA: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            {(m.scoreA !== null || m.scoreB !== null) && !m.isFinal && (
              <button
                onClick={() =>
                  updateMatch(m.id, { scoreA: (m.scoreA ?? 0) + 1 })
                }
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-blue-500/10 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25"
              >
                +
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 min-w-0">
          <span
            className={cn(
              "text-sm font-semibold truncate",
              winB
                ? "text-[rgb(var(--fg))]"
                : done
                  ? "text-[rgb(var(--muted-fg))]"
                  : "text-[rgb(var(--fg))]",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {winB && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 shrink-0">
                  W
                </span>
              )}
              {winA && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">
                  L
                </span>
              )}
              <span className="truncate">{tB?.name ?? "—"}</span>
            </span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {(m.scoreA !== null || m.scoreB !== null) && !m.isFinal && (
              <button
                onClick={() =>
                  updateMatch(m.id, {
                    scoreB: Math.max(0, (m.scoreB ?? 0) - 1),
                  })
                }
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-red-500/15 text-red-400 font-bold text-sm hover:bg-red-500/25"
              >
                -
              </button>
            )}
            <input
              type="number"
              min="0"
              disabled={m.isFinal}
              className="w-14 shrink-0 text-center bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl py-1.5 text-[rgb(var(--fg))] font-bold"
              value={m.scoreB ?? ""}
              onChange={(e) =>
                updateMatch(m.id, {
                  scoreB: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            {(m.scoreA !== null || m.scoreB !== null) && !m.isFinal && (
              <button
                onClick={() =>
                  updateMatch(m.id, { scoreB: (m.scoreB ?? 0) + 1 })
                }
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-blue-500/10 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25"
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-[rgb(var(--border-soft))]">
        <span className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] shrink-0">
          Refs
        </span>
        <select
          disabled={m.isFinal}
          className="flex-1 min-w-0 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-2.5 py-1.5 text-[rgb(var(--fg))] text-xs"
          value={m.officiatingTeamId ?? ""}
          onChange={(e) =>
            updateMatch(m.id, { officiatingTeamId: e.target.value || null })
          }
        >
          <option value="">Select team</option>
          {state.teams
            .filter((t) => t.id !== m.teamAId && t.id !== m.teamBId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </div>

      {/* VIS Stats deep-link */}
      <Link
        to="/vis-stats"
        search={{
          tournamentId,
          matchId: m.id,
          teamA: tA?.name ?? 'The Rebels',
          teamB: tB?.name ?? 'Opponent',
          date: state.settings.date || new Date().toISOString().slice(0, 10),
          venue: state.settings.venue || '',
          sets: '3',
          players: tA?.players?.length
            ? JSON.stringify(
                tA.players.filter((p: Player) => p.name).map((p: Player) => ({ name: p.name, jersey: p.jerseyNumber ?? 0 }))
              )
            : undefined,
        }}
        className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] font-semibold tracking-wide text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors"
      >
        <BarChart2 size={11} />
        VIS STATS
      </Link>
    </div>
  );
}

function MatchesTab({
  state,
  setState,
  tournamentId,
}: {
  state: TournamentState;
  setState: (s: TournamentState) => void;
  tournamentId: string;
}) {
  const [showGenModal, setShowGenModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showDEModal, setShowDEModal] = useState(false);
  const [showRemoveDEModal, setShowRemoveDEModal] = useState(false);

  const updateMatch = (id: string, updates: Partial<PoolMatch>) => {
    setState({
      ...state,
      poolMatches: state.poolMatches.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    });
  };

  const poolA = state.teams.filter((t) => t.pool === "A").length;
  const poolB = state.teams.filter((t) => t.pool === "B").length;

  // DE controls — read from settings, default to false/undefined for all existing tournaments
  const isDE = state.settings.useDEBracket === true;
  const deBye = state.settings.deBye;

  // Build the bracket template based on current mode
  // SE (auto): derives bracket from pool counts — all existing formats unchanged
  // DE: uses the double-elimination bracket for this team count
  const variant = isDE ? "de" : "auto";
  const template = buildBracketTemplate(poolA, poolB, variant, deBye);

  // Whether a DE bracket is available for the current team count
  // The button hides automatically for counts with no DE defined (e.g. 4+4, 5+5)
  const deBracketExists =
    poolB === 0 && buildBracketTemplate(poolA, poolB, "de").length > 0;

  // Whether any playoff scores have been entered — used to guard the remove DE action
  const playoffHasScores = state.playoffGames.some(
    (g) => g.scoreA !== null || g.scoreB !== null,
  );

  const resolvedPlayoffs = resolvePlayoffGames(
    template,
    state.teams,
    state.poolMatches,
    state.playoffGames,
    state.settings.maxScore,
    state.settings.leadScore,
  );

  // ── DE handlers ────────────────────────────────────────────────────────────

  // Generate DE: switch to double-elimination bracket, clear any existing playoff scores
  const handleGenerateDE = () => {
    setState({
      ...state,
      settings: { ...state.settings, useDEBracket: true },
      playoffGames: [],
    });
    setShowDEModal(false);
  };

  // Remove DE: return to SE (auto) bracket, clear playoff scores
  const handleRemoveDE = () => {
    setState({
      ...state,
      settings: {
        ...state.settings,
        useDEBracket: false,
        deBye: undefined,
      },
      playoffGames: [],
    });
    setShowRemoveDEModal(false);
  };

  const updateScore = (
    slot: string,
    field: "scoreA" | "scoreB",
    val: string,
  ) => {
    const num = val === "" ? null : parseInt(val);
    const newGames = [...state.playoffGames];
    const idx = newGames.findIndex((g) => g.slot === slot);

    if (idx >= 0) {
      newGames[idx] = { ...newGames[idx], [field]: isNaN(num!) ? null : num };
    } else {
      const g = resolvedPlayoffs.find((x) => x.slot === slot)!;
      newGames.push({ ...g, [field]: isNaN(num!) ? null : num });
    }
    setState({ ...state, playoffGames: newGames });
  };

  const updateCourt = (slot: string, val: string) => {
    const newGames = [...state.playoffGames];
    const idx = newGames.findIndex((g) => g.slot === slot);
    if (idx >= 0) {
      newGames[idx] = { ...newGames[idx], court: val };
    } else {
      const g = resolvedPlayoffs.find((x) => x.slot === slot)!;
      newGames.push({ ...g, court: val });
    }
    setState({ ...state, playoffGames: newGames });
  };

  const updateIsFinal = (slot: string, val: boolean) => {
    const newGames = [...state.playoffGames];
    const idx = newGames.findIndex((g) => g.slot === slot);
    if (idx >= 0) {
      newGames[idx] = { ...newGames[idx], isFinal: val };
    } else {
      const g = resolvedPlayoffs.find((x) => x.slot === slot)!;
      newGames.push({ ...g, isFinal: val });
    }
    setState({ ...state, playoffGames: newGames });
  };

  const has2nd = hasSecondRound(state.poolMatches);
  const canRemove2nd = has2nd && !secondRoundHasScores(state.poolMatches);
  const round1Boundary = getOriginalRoundBoundary(state.poolMatches);

  const handleGenerate2nd = () => {
    setState({ ...state, poolMatches: generateSecondRound(state.poolMatches) });
    setShowGenModal(false);
  };

  const handleRemove2nd = () => {
    setState({
      ...state,
      poolMatches: removeSecondRound(state.poolMatches),
    });
    setShowRemoveModal(false);
  };

  if (state.poolMatches.length === 0 && template.length === 0) {
    return (
      <div className="text-center py-16 text-[rgb(var(--muted-fg))]">
        <Calendar size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No matches scheduled yet.</p>
      </div>
    );
  }

  const sortedMatches = state.poolMatches.slice().sort((a, b) => a.gameNum - b.gameNum);

  return (
    <div className="space-y-8">
      <ConfirmationModal
        open={showGenModal}
        title="Generate 2nd Round"
        message="This will duplicate all current pool matches into a second round. Teams will play the same matchups again with fresh scores. Continue?"
        confirmLabel="Generate 2nd Round"
        onConfirm={handleGenerate2nd}
        onCancel={() => setShowGenModal(false)}
      />
      <ConfirmationModal
        open={showRemoveModal}
        title="Remove 2nd Round"
        message="This will permanently remove all 2nd round matches. This action cannot be undone."
        confirmLabel="Remove 2nd Round"
        confirmColor="red"
        onConfirm={handleRemove2nd}
        onCancel={() => setShowRemoveModal(false)}
      />
      <ConfirmationModal
        open={showDEModal}
        title="Generate Double Elimination"
        message="This will switch the bracket to Double Elimination. Every team must lose twice to be eliminated. Any existing playoff scores will be cleared. Continue?"
        confirmLabel="Generate DE Bracket"
        onConfirm={handleGenerateDE}
        onCancel={() => setShowDEModal(false)}
      />
      <ConfirmationModal
        open={showRemoveDEModal}
        title="Remove Double Elimination"
        message="This will switch back to the standard Single Elimination bracket and clear all current playoff scores. Continue?"
        confirmLabel="Remove DE Bracket"
        confirmColor="red"
        onConfirm={handleRemoveDE}
        onCancel={() => setShowRemoveDEModal(false)}
      />

      {state.poolMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2 border-b border-[rgb(var(--border-soft))] pb-2">
            <h3 className="text-sm font-bold tracking-tight text-[rgb(var(--fg))]">
              Round Robin Phase
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded-full">
                Pool Play
              </span>
              {!has2nd && state.poolMatches.length > 0 && (
                <button
                  onClick={() => setShowGenModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-blue-500/50 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <Copy size={10} /> Generate 2nd Round
                </button>
              )}
              {canRemove2nd && (
                <button
                  onClick={() => setShowRemoveModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={10} /> Remove 2nd Round
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3">
            {sortedMatches.map((m, i) => {
              const isFirstR2 =
                has2nd &&
                m.round > round1Boundary &&
                (i === 0 || sortedMatches[i - 1].round <= round1Boundary);
              return (
                <div key={m.id}>
                  {i === 0 && has2nd && (
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-[rgb(var(--border-soft))]" />
                      <span className="text-[10px] font-bold tracking-widest text-[rgb(var(--muted-fg))]">
                        1ST ROUND
                      </span>
                      <div className="h-px flex-1 bg-[rgb(var(--border-soft))]" />
                    </div>
                  )}
                  {isFirstR2 && (
                    <div className="flex items-center gap-3 mb-3 mt-6">
                      <div className="h-px flex-1 bg-blue-500/30" />
                      <span className="text-[10px] font-bold tracking-widest text-blue-400">
                        2ND ROUND
                      </span>
                      <div className="h-px flex-1 bg-blue-500/30" />
                    </div>
                  )}
                  <PoolMatchRow
                    match={m}
                    state={state}
                    updateMatch={updateMatch}
                    tournamentId={tournamentId}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {resolvedPlayoffs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2 border-b border-[rgb(var(--border-soft))] pb-2">
            <h3 className="text-sm font-bold tracking-tight text-[rgb(var(--fg))]">
              Bracket Phase
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[10px] font-bold rounded-full">
                {isDE ? "Double Elim" : "Playoffs"}
              </span>
              {/* Generate DE — shown when a DE bracket exists for this team count and DE is not yet active */}
              {!isDE && deBracketExists && (
                <button
                  onClick={() => setShowDEModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-orange-500/50 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
                >
                  <Copy size={10} /> Generate DE
                </button>
              )}
              {/* Remove DE — shown when DE is active and no playoff scores exist yet */}
              {isDE && !playoffHasScores && (
                <button
                  onClick={() => setShowRemoveDEModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={10} /> Remove DE
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resolvedPlayoffs.map((g) => {
              const tA = g.teamAId
                ? state.teams.find((t) => t.id === g.teamAId)
                : null;
              const tB = g.teamBId
                ? state.teams.find((t) => t.id === g.teamBId)
                : null;
              return (
                <div
                  key={g.slot}
                  className={cn(
                    "glass border rounded-xl p-4",
                    g.phase === "championship"
                      ? "border-[rgb(var(--fg)/0.3)]"
                      : "border-[rgb(var(--border))]",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateIsFinal(g.slot, !g.isFinal)}
                        className={cn(
                          "p-1 rounded flex items-center justify-center transition-colors",
                          g.isFinal
                            ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                            : "text-[rgb(var(--muted-fg))] hover:bg-[rgb(var(--border-soft))] hover:text-[rgb(var(--fg))]",
                        )}
                        title={
                          g.isFinal
                            ? "Unlock score"
                            : "Lock score (mark as final)"
                        }
                      >
                        {g.isFinal ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <span className="text-xs font-mono text-[rgb(var(--muted-fg))]">
                        {g.slot}
                      </span>
                      <input
                        disabled={g.isFinal}
                        className="w-16 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] text-[10px] text-center px-1 py-0.5 rounded text-[rgb(var(--fg))]"
                        placeholder="Court"
                        value={g.court}
                        onChange={(e) => updateCourt(g.slot, e.target.value)}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold tracking-normal ",
                        PHASE_COLORS[g.phase as PlayoffPhase],
                      )}
                    >
                      {g.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        t: tA,
                        lbl: g.teamALabel,
                        sc: g.scoreA,
                        f: "scoreA" as const,
                      },
                      {
                        t: tB,
                        lbl: g.teamBLabel,
                        sc: g.scoreB,
                        f: "scoreB" as const,
                      },
                    ].map((row, i) => {
                      const hasAnyScore =
                        g.scoreA !== null || g.scoreB !== null;
                      const isComplete = isGameComplete(
                        g,
                        state.settings.maxScore,
                        state.settings.leadScore,
                      );
                      const isWinner =
                        isComplete &&
                        ((row.f === "scoreA" && g.scoreA! > g.scoreB!) ||
                          (row.f === "scoreB" && g.scoreB! > g.scoreA!));
                      const isLoser =
                        isComplete &&
                        ((row.f === "scoreA" && g.scoreA! < g.scoreB!) ||
                          (row.f === "scoreB" && g.scoreB! < g.scoreA!));
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isWinner && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                W
                              </span>
                            )}
                            {isLoser && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                                L
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-sm font-semibold truncate",
                                isWinner
                                  ? "text-[rgb(var(--fg))]"
                                  : isComplete
                                    ? "text-[rgb(var(--muted-fg))]"
                                    : "text-[rgb(var(--fg))]",
                                !row.t && "text-[rgb(var(--muted-fg))] italic",
                              )}
                            >
                              {row.t?.name ?? row.lbl}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasAnyScore &&
                              !isComplete &&
                              row.t &&
                              !g.isFinal && (
                                <button
                                  onClick={() =>
                                    updateScore(
                                      g.slot,
                                      row.f,
                                      String(Math.max(0, (row.sc ?? 0) - 1)),
                                    )
                                  }
                                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-red-500/15 text-red-400 font-bold text-sm hover:bg-red-500/25"
                                >
                                  -
                                </button>
                              )}
                            <input
                              type="number"
                              min="0"
                              disabled={!row.t || g.isFinal}
                              className="w-14 shrink-0 text-center bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl py-1.5 font-bold disabled:opacity-30 text-[rgb(var(--fg))]"
                              value={row.sc ?? ""}
                              onChange={(e) =>
                                updateScore(g.slot, row.f, e.target.value)
                              }
                            />
                            {hasAnyScore &&
                              !isComplete &&
                              row.t &&
                              !g.isFinal && (
                                <button
                                  onClick={() =>
                                    updateScore(
                                      g.slot,
                                      row.f,
                                      String((row.sc ?? 0) + 1),
                                    )
                                  }
                                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-blue-500/10 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25"
                                >
                                  +
                                </button>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardTab({ state }: { state: TournamentState }) {
  const renderTable = (standings: TeamStanding[], poolLabel: string) => (
    <div className="mb-8">
      <h3 className="text-xs font-bold tracking-tight  text-[rgb(var(--fg))] mb-4">
        {poolLabel}
      </h3>
      <div className="overflow-x-auto glass rounded-xl border border-[rgb(var(--border-soft))] shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
              {["#", "TEAM", "W", "L", "GP", "PF", "PA", "QUOTIENT"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-4 text-xs font-bold tracking-tight text-[rgb(var(--muted-fg))] last:text-right"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-6 text-[rgb(var(--muted-fg))] italic"
                >
                  No results yet
                </td>
              </tr>
            ) : (
              standings.map((s) => (
                <tr
                  key={s.team.id}
                  className="border-b border-[rgb(var(--border-soft))] last:border-0 hover:bg-[rgb(var(--bg))]"
                >
                  <td className="py-3 px-4 text-[rgb(var(--muted-fg))] font-mono text-xs">
                    {s.rank}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[rgb(var(--fg))]">
                    {s.team.name}
                  </td>
                  <td className="py-3 px-4 font-bold text-[rgb(var(--fg))]">
                    {s.wins}
                  </td>
                  <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">
                    {s.losses}
                  </td>
                  <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">
                    {s.gamesPlayed}
                  </td>
                  <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">
                    {s.pointsFor}
                  </td>
                  <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">
                    {s.pointsAgainst}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[rgb(var(--fg))]">
                    {s.quotient.toFixed(3)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const sA = computeStandings(
    state.teams,
    state.poolMatches,
    "A",
    state.settings.maxScore,
    state.settings.leadScore,
  );
  const sB = computeStandings(
    state.teams,
    state.poolMatches,
    "B",
    state.settings.maxScore,
    state.settings.leadScore,
  );

  if (sA.length === 0 && sB.length === 0) {
    return (
      <div className="text-center py-16 text-[rgb(var(--muted-fg))]">
        No teams or results.
      </div>
    );
  }

  return (
    <div>
      {sA.length > 0 && renderTable(sA, "Pool A Standings")}
      {sB.length > 0 && renderTable(sB, "Pool B Standings")}
    </div>
  );
}

function PlayerCard({
  p,
  updatePlayer,
  deletePlayer,
}: {
  p: any;
  updatePlayer: any;
  deletePlayer: any;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await uploadPlayerImage({ data: formData });
      if (res.success && res.url) {
        updatePlayer(p.teamId, p.id, { profilePicture: res.url });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            <img
              src={p.profilePicture}
              alt={p.name}
              className="w-full h-full object-cover"
            />
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
            onChange={(e) =>
              updatePlayer(p.teamId, p.id, { name: e.target.value })
            }
            placeholder="Player Name"
          />
          <div className="text-xs text-[rgb(var(--muted-fg))] italic">
            Team: {p.teamName}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <select
          className="text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-2 py-1.5 text-[rgb(var(--muted-fg))]"
          value={p.position}
          onChange={(e) =>
            updatePlayer(p.teamId, p.id, { position: e.target.value as any })
          }
        >
          <option value="">Position...</option>
          <option value="OS">Open Spiker</option>
          <option value="OPP">Opposite Spiker</option>
          <option value="MB">Middle Blocker</option>
          <option value="S">Setter</option>
          <option value="L">Libero</option>
        </select>
        <select
          className="text-xs bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-2 py-1.5 text-[rgb(var(--muted-fg))]"
          value={p.skillLevel}
          onChange={(e) =>
            updatePlayer(p.teamId, p.id, { skillLevel: e.target.value as any })
          }
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

type LiveFilter = "all" | "ongoing" | "next";
type LiveGameStatus = "done" | "ongoing" | "next" | "pending";

type LiveGameCard = {
  id: string;
  type: "pool" | "playoff";
  pool?: Pool;
  order: number;
  title: string;
  subtitle: string;
  teamAName: string;
  teamBName: string;
  scoreA: number | null;
  scoreB: number | null;
  isComplete: boolean;
  isOngoing: boolean;
  status: LiveGameStatus;
};

function LiveView({
  state,
  lastUpdated,
}: {
  state: TournamentState;
  lastUpdated: Date | null;
}) {
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [now, setNow] = useState(new Date());
  const standingsA = computeStandings(
    state.teams,
    state.poolMatches,
    "A",
    state.settings.maxScore,
    state.settings.leadScore,
  );
  const standingsB = computeStandings(
    state.teams,
    state.poolMatches,
    "B",
    state.settings.maxScore,
    state.settings.leadScore,
  );

  // Tick every second to update the "ago" timer
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const liveCards = useMemo(() => {
    const poolCards: LiveGameCard[] = state.poolMatches
      .slice()
      .sort((a, b) => {
        if (a.gameNum !== b.gameNum) return a.gameNum - b.gameNum;
        return a.pool.localeCompare(b.pool);
      })
      .map((match) => {
        const teamA = state.teams.find((team) => team.id === match.teamAId);
        const teamB = state.teams.find((team) => team.id === match.teamBId);
        const hasAnyScore = match.scoreA !== null || match.scoreB !== null;
        const isComplete = isGameComplete(match, state.settings.maxScore, state.settings.leadScore);

        return {
          id: match.id,
          type: "pool",
          pool: match.pool,
          order: match.gameNum,
          title: `Pool ${match.pool} · Game ${match.gameNum}`,
          subtitle: `Round ${match.round}${match.court ? ` · Court ${match.court}` : ""} · Simultaneous Slot ${match.gameNum}`,
          teamAName: teamA?.name ?? "TBD",
          teamBName: teamB?.name ?? "TBD",
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          isComplete,
          isOngoing: hasAnyScore && !isComplete,
          status: "pending",
        };
      });

    const playoffTemplate = buildBracketTemplate(
      state.teams.filter((team) => team.pool === "A").length,
      state.teams.filter((team) => team.pool === "B").length,
      state.settings.useDEBracket ? "de" : "auto",
      state.settings.deBye,
    );
    const playoffGames = resolvePlayoffGames(
      playoffTemplate,
      state.teams,
      state.poolMatches,
      state.playoffGames,
      state.settings.maxScore,
      state.settings.leadScore,
    );
    const playoffCards: LiveGameCard[] = playoffGames.map((game, index) => {
      const teamA = game.teamAId
        ? state.teams.find((team) => team.id === game.teamAId)
        : null;
      const teamB = game.teamBId
        ? state.teams.find((team) => team.id === game.teamBId)
        : null;
      const hasAnyScore = game.scoreA !== null || game.scoreB !== null;
      const isComplete = isGameComplete(game, state.settings.maxScore, state.settings.leadScore);

      return {
        id: game.slot,
        type: "playoff",
        order: index + 1,
        title: game.slot,
        subtitle: `${PHASE_LABELS[game.phase]}${game.court ? ` • Court ${game.court}` : ""}`,
        teamAName: teamA?.name ?? game.teamALabel,
        teamBName: teamB?.name ?? game.teamBLabel,
        scoreA: game.scoreA,
        scoreB: game.scoreB,
        isComplete,
        isOngoing: hasAnyScore && !isComplete,
        status: "pending",
      };
    });

    // Determine status per simultaneous slot for pool games. Pool A's gameNum N
    // and Pool B's gameNum N share a slot — they play at the same time, so they
    // share status. A slot is "ongoing" if any game in it has started.
    const slotMap = new Map<number, LiveGameCard[]>();
    for (const card of poolCards) {
      const arr = slotMap.get(card.order) ?? [];
      arr.push(card);
      slotMap.set(card.order, arr);
    }
    const slotKeys = [...slotMap.keys()].sort((a, b) => a - b);

    let foundNext = false;
    const poolWithStatus: LiveGameCard[] = [];
    for (const slotNum of slotKeys) {
      const cards = slotMap.get(slotNum)!;
      const allDone = cards.every((c) => c.isComplete);
      const anyStarted = cards.some((c) => c.isOngoing || c.isComplete);
      let slotStatus: LiveGameStatus;
      if (allDone) slotStatus = "done";
      else if (anyStarted) slotStatus = "ongoing";
      else if (!foundNext) {
        slotStatus = "next";
        foundNext = true;
      } else slotStatus = "pending";
      for (const c of cards) poolWithStatus.push({ ...c, status: slotStatus });
    }

    const playoffWithStatus: LiveGameCard[] = playoffCards.map((c) => {
      let status: LiveGameStatus = "pending";
      if (c.isComplete) status = "done";
      else if (c.isOngoing) status = "ongoing";
      else if (!foundNext) {
        status = "next";
        foundNext = true;
      }
      return { ...c, status };
    });

    return [...poolWithStatus, ...playoffWithStatus];
  }, [state]);

  const ongoingCards = liveCards.filter((card) => card.status === "ongoing");
  const nextCards = liveCards.filter((card) => card.status === "next");

  const groupCardsBySlot = (cards: LiveGameCard[]) => {
    const poolGroups = new Map<number, LiveGameCard[]>();
    const playoffSolo: LiveGameCard[] = [];
    for (const c of cards) {
      if (c.type === "pool") {
        const arr = poolGroups.get(c.order) ?? [];
        arr.push(c);
        poolGroups.set(c.order, arr);
      } else {
        playoffSolo.push(c);
      }
    }
    const groups: {
      key: string;
      label: string | null;
      cards: LiveGameCard[];
    }[] = [];
    for (const [slotNum, slotCards] of [...poolGroups.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const sorted = slotCards
        .slice()
        .sort((a, b) => (a.pool ?? "").localeCompare(b.pool ?? ""));
      const label =
        slotCards.length > 1
          ? `Slot ${slotNum} · Simultaneous`
          : `Slot ${slotNum}`;
      groups.push({ key: `slot-${slotNum}`, label, cards: sorted });
    }
    for (const c of playoffSolo) {
      groups.push({ key: `playoff-${c.id}`, label: null, cards: [c] });
    }
    return groups;
  };

  const filteredCards = useMemo(() => {
    if (filter === "ongoing") return []; // already rendered in highlight section
    if (filter === "next") return nextCards;
    return liveCards.filter((card) => card.status !== "ongoing");
  }, [filter, liveCards, nextCards]);

  return (
    <div className="space-y-6">
      <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight ">
              Live Match Center
            </h2>
            <p className="text-xs text-[rgb(var(--muted-fg))] tracking-normal mt-1">
              Public scoreboard and next-game callouts
            </p>
            {lastUpdated && (
              <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1 flex items-center gap-1.5">
                <RefreshCw
                  size={10}
                  className="animate-spin"
                  style={{ animationDuration: "3s" }}
                />
                Auto-refreshing every 5s &middot; Last updated{" "}
                {lastUpdated.toLocaleTimeString()} (
                {Math.max(
                  0,
                  Math.floor((now.getTime() - lastUpdated.getTime()) / 1000),
                )}
                s ago)
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "ongoing", "next"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold tracking-normal  border transition-colors",
                  filter === option
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-full border-[rgb(var(--fg))]"
                    : "border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HIGHLIGHT ONGOING GAMES AT CENTER TOP */}
      {(filter === "all" || filter === "ongoing") &&
        ongoingCards.length > 0 && (
          <div className="flex flex-col items-center mb-8 space-y-6">
            <h2 className="text-xl font-semibold tracking-tight  text-blue-500 animate-pulse">
              Live Now
            </h2>
            <div className="w-full max-w-5xl space-y-6">
              {groupCardsBySlot(ongoingCards).map((group) => (
                <div key={`ongoing-${group.key}`} className="space-y-3">
                  {group.label && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold tracking-tight  text-blue-500">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-amber-500/30" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "grid gap-4",
                      group.cards.length > 1
                        ? "grid-cols-1 md:grid-cols-2"
                        : "grid-cols-1",
                    )}
                  >
                    {group.cards.map((card) => (
                      <div
                        key={`ongoing-${card.id}`}
                        className="glass border-2 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] rounded-xl p-6 text-center transform hover:scale-[1.02] transition-transform"
                      >
                        <p className="text-sm font-bold tracking-tight  text-blue-500 mb-1">
                          {card.title}
                        </p>
                        <p className="text-xs text-[rgb(var(--muted-fg))] mb-4">
                          {card.subtitle}
                        </p>
                        <div className="flex justify-center items-center gap-4 sm:gap-6">
                          <div className="flex-1 text-right">
                            <p className="font-bold text-base sm:text-lg line-clamp-2">
                              {card.teamAName}
                            </p>
                          </div>
                          <div className="bg-blue-500/10 px-4 py-2 rounded-xl font-semibold text-2xl sm:text-3xl text-blue-500 min-w-[90px]">
                            {card.scoreA ?? 0} - {card.scoreB ?? 0}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-bold text-base sm:text-lg line-clamp-2">
                              {card.teamBName}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {(standingsA.length > 0 || standingsB.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {standingsA.length > 0 && (
            <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4">
              <h3 className="text-xs font-bold tracking-tight  mb-3">
                Pool A Leaderboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="text-[rgb(var(--muted-fg))] tracking-normal ">
                      {["#", "Team", "W", "L", "PF", "PA", "Quotient"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="py-2 text-left font-bold last:text-right"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {standingsA.map((team) => (
                      <tr
                        key={team.team.id}
                        className="border-t border-[rgb(var(--border-soft))]"
                      >
                        <td className="py-2 font-mono text-[rgb(var(--muted-fg))]">
                          {team.rank}
                        </td>
                        <td className="py-2 font-semibold">{team.team.name}</td>
                        <td className="py-2">{team.wins}</td>
                        <td className="py-2">{team.losses}</td>
                        <td className="py-2">{team.pointsFor}</td>
                        <td className="py-2">{team.pointsAgainst}</td>
                        <td className="py-2 text-right font-mono">
                          {team.quotient.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {standingsB.length > 0 && (
            <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4">
              <h3 className="text-xs font-bold tracking-tight  mb-3">
                Pool B Leaderboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="text-[rgb(var(--muted-fg))] tracking-normal ">
                      {["#", "Team", "W", "L", "PF", "PA", "Quotient"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="py-2 text-left font-bold last:text-right"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {standingsB.map((team) => (
                      <tr
                        key={team.team.id}
                        className="border-t border-[rgb(var(--border-soft))]"
                      >
                        <td className="py-2 font-mono text-[rgb(var(--muted-fg))]">
                          {team.rank}
                        </td>
                        <td className="py-2 font-semibold">{team.team.name}</td>
                        <td className="py-2">{team.wins}</td>
                        <td className="py-2">{team.losses}</td>
                        <td className="py-2">{team.pointsFor}</td>
                        <td className="py-2">{team.pointsAgainst}</td>
                        <td className="py-2 text-right font-mono">
                          {team.quotient.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {filteredCards.length === 0 ? (
        <div className="text-center py-14 rounded-xl border border-[rgb(var(--border-soft))] shadow-sm glass text-[rgb(var(--muted-fg))]">
          No games to display for this filter.
        </div>
      ) : (
        <div className="space-y-5">
          {groupCardsBySlot(filteredCards).map((group) => (
            <div key={`list-${group.key}`} className="space-y-2">
              {group.label && group.cards.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold tracking-tight  text-[rgb(var(--muted-fg))]">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-[rgb(var(--border))]" />
                </div>
              )}
              <div
                className={cn(
                  "grid gap-4",
                  group.cards.length > 1
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 lg:grid-cols-2",
                )}
              >
                {group.cards.map((card) => (
                  <div
                    key={card.id}
                    className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold tracking-tight ">
                          {card.title}
                        </p>
                        <p className="text-[11px] text-[rgb(var(--muted-fg))]">
                          {card.subtitle}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold tracking-tight  px-2 py-1 rounded",
                          card.status === "done"
                            ? "bg-blue-500/10 text-blue-500"
                            : card.status === "ongoing"
                              ? "bg-amber-500/15 text-blue-500"
                              : card.status === "next"
                                ? "bg-blue-500/15 text-blue-400"
                                : "bg-slate-500/15 text-slate-400",
                        )}
                      >
                        {card.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold truncate inline-flex items-center gap-1.5">
                          {card.isComplete &&
                            card.scoreA !== null &&
                            card.scoreB !== null &&
                            card.scoreA > card.scoreB && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                W
                              </span>
                            )}
                          {card.isComplete &&
                            card.scoreA !== null &&
                            card.scoreB !== null &&
                            card.scoreA < card.scoreB && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                                L
                              </span>
                            )}
                          {card.teamAName}
                        </span>
                        <span className="font-mono text-base">
                          {card.scoreA ?? "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold truncate inline-flex items-center gap-1.5">
                          {card.isComplete &&
                            card.scoreA !== null &&
                            card.scoreB !== null &&
                            card.scoreB > card.scoreA && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                W
                              </span>
                            )}
                          {card.isComplete &&
                            card.scoreA !== null &&
                            card.scoreB !== null &&
                            card.scoreB < card.scoreA && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                                L
                              </span>
                            )}
                          {card.teamBName}
                        </span>
                        <span className="font-mono text-base">
                          {card.scoreB ?? "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  state,
  setState,
}: {
  state: TournamentState;
  setState: (s: TournamentState) => void;
}) {
  const [localSettings, setLocalSettings] = useState(state.settings);
  const [isSaved, setIsSaved] = useState(false);

  // Update local state if parent state changes (e.g. on initial load or remote sync)
  useEffect(() => {
    setLocalSettings(state.settings);
  }, [state.settings]);

  const handleSave = () => {
    setState({ ...state, settings: localSettings });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))]">
            Event Details
          </h3>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            {isSaved ? (
              <>
                <Check size={14} /> Saved
              </>
            ) : (
              <>
                <Save size={14} /> Save Settings
              </>
            )}
          </button>
        </div>
        <div>
          <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
            Schedule Name
          </label>
          <input
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
            value={localSettings.scheduleName}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                scheduleName: e.target.value,
              })
            }
          />
        </div>
        <div>
          <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
            Venue
          </label>
          <input
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
            value={localSettings.venue}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, venue: e.target.value })
            }
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex-1">
            <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
              Date
            </label>
            <input
              type="date"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
              value={localSettings.date}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, date: e.target.value })
              }
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
              From Time
            </label>
            <input
              type="time"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
              value={localSettings.startTime}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  startTime: e.target.value,
                })
              }
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
              To Time
            </label>
            <input
              type="time"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
              value={localSettings.endTime}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, endTime: e.target.value })
              }
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
            Max Score Per Game
          </label>
          <input
            type="number"
            min="1"
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
            placeholder="e.g. 25 (leave empty for manual completion)"
            value={localSettings.maxScore ?? ""}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                maxScore: e.target.value ? parseInt(e.target.value) : null,
              })
            }
          />
          <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1">
            When set, a game is only marked as Done when a team reaches this
            score
          </p>
        </div>
        <div>
          <label className="text-[10px] tracking-normal  text-[rgb(var(--muted-fg))] block mb-1">
            Lead Score Required
          </label>
          <input
            type="number"
            min="1"
            className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
            placeholder="e.g. 2 (leave empty for win by 1)"
            value={localSettings.leadScore ?? ""}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                leadScore: e.target.value ? parseInt(e.target.value) : null,
              })
            }
          />
          <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1">
            When set, a team must lead by at least this many points to win
          </p>
        </div>

        <div className="pt-4 border-t border-[rgb(var(--border-soft))] mt-4">
          <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))] mb-4">
            Social & Contact Links
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] tracking-normal text-[rgb(var(--muted-fg))] block mb-1">
                Facebook URL
              </label>
              <input
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
                placeholder="https://facebook.com/..."
                value={localSettings.facebookUrl || ""}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    facebookUrl: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] tracking-normal text-[rgb(var(--muted-fg))] block mb-1">
                Instagram URL
              </label>
              <input
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
                placeholder="https://instagram.com/..."
                value={localSettings.instagramUrl || ""}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    instagramUrl: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] tracking-normal text-[rgb(var(--muted-fg))] block mb-1">
                Contact Us URL (e.g. mailto: or link)
              </label>
              <input
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded p-2 text-sm text-[rgb(var(--fg))]"
                placeholder="mailto:hello@example.com"
                value={localSettings.contactUrl || ""}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    contactUrl: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-5">
        <h3 className="text-xs font-bold tracking-tight  text-[rgb(var(--fg))] mb-4">
          Export Data
        </h3>
        <div className="space-y-2">
          <button
            onClick={() =>
              exportCSV(state.teams, state.poolMatches, state.settings.maxScore, state.settings.leadScore)
            }
            className="w-full flex items-center justify-center gap-3 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl py-3 text-sm font-bold"
          >
            <Download size={16} /> Export Standings to CSV
          </button>
          <button
            onClick={() => exportJSON(state)}
            className="w-full flex items-center justify-center gap-3 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl py-3 text-sm font-bold"
          >
            <Download size={16} /> Download Backup (JSON)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function TournamentApp({
  tournamentId,
  defaultView = "admin",
  lockView = false,
}: {
  tournamentId: string;
  defaultView?: "admin" | "players";
  lockView?: boolean;
}) {
  const cacheKey = `rebels_tournament_v2_${tournamentId}`;
  const [state, setStateRaw] = useState<TournamentState>(defaultState);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<
    "teams" | "matches" | "leaderboard" | "vis stats" | "settings"
  >("teams");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("tr_theme");
    const initialTheme = savedTheme === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);

    const local = loadState(cacheKey);
    setStateRaw(local);
    setMounted(true);

    const fetchRemote = async (retries = 3): Promise<void> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const res = await fetch(
            `/api/tournament/${encodeURIComponent(tournamentId)}`,
            { headers: { "Cache-Control": "no-cache" } },
          );
          if (res.ok) {
            const data = await res.json();
            if (data.exists) {
              setStateRaw(data.state);
              saveState(data.state, cacheKey);
              setLastUpdated(new Date());
            } else if (defaultView === "admin") {
              await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(local),
              });
            }
            setSyncError(null);
            setIsLoading(false);
            return;
          }
          if (res.status >= 500 && attempt < retries - 1) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            continue;
          }
          setIsLoading(false);
          return;
        } catch (e) {
          if (attempt < retries - 1) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            continue;
          }
          setSyncError("Unable to connect — using local data");
          setIsLoading(false);
        }
      }
    };
    fetchRemote();

    if (defaultView === "players") {
      const interval = setInterval(() => fetchRemote(1), 5000);
      return () => clearInterval(interval);
    }
  }, [cacheKey, tournamentId, defaultView]);

  const setState = useCallback(
    (next: TournamentState) => {
      setStateRaw(next);
      saveState(next, cacheKey);
      setSyncError(null);

      const persistRemote = async (retries = 3) => {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(next),
            });
            if (res.ok) {
              setSyncError(null);
              return;
            }
            if (res.status >= 500 && attempt < retries - 1) {
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
              continue;
            }
            setSyncError("Save failed — changes stored locally");
            return;
          } catch (e) {
            if (attempt < retries - 1) {
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
              continue;
            }
            setSyncError("Offline — changes stored locally");
          }
        }
      };
      persistRemote();
    },
    [cacheKey, tournamentId],
  );

  if (!mounted)
    return (
      <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center">
        Loading…
      </div>
    );

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("tr_theme", nextTheme);
  };

  const copyLiveLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/live/${encodeURIComponent(tournamentId)}`,
    );
    alert("Link Copied!");
  };

  const scheduleRange = formatDateTimeRange(
    state.settings.date,
    state.settings.startTime,
    state.settings.endTime,
  );

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--fg))]">
      {isLoading && (
        <div className="bg-blue-600/90 text-white text-xs text-center py-2 px-4 flex items-center justify-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          Connecting to server…
        </div>
      )}
      {syncError && (
        <div className="bg-amber-600/90 text-white text-xs text-center py-2 px-4">
          {syncError}
        </div>
      )}
      <div className="glass border-b border-[rgb(var(--border))] py-3 px-4 sm:px-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between text-xs font-bold tracking-normal ">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Rebels Volleyball logo"
              className="h-8 w-8 rounded-xl object-cover border border-[rgb(var(--border-soft))]"
            />
            <span>{state.settings.scheduleName || "Unnamed Event"}</span>
          </div>
          {state.settings.venue && (
            <span className="flex items-center gap-1 text-[rgb(var(--muted-fg))]">
              <MapPin size={12} /> {state.settings.venue}
            </span>
          )}
          {scheduleRange && (
            <span className="flex items-center gap-1 text-[rgb(var(--muted-fg))]">
              <Clock size={12} /> {scheduleRange}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/tournaments"
            search={{ id: undefined }}
            className="flex items-center gap-1 border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] px-3 py-1.5 rounded"
          >
            Home
          </Link>
          <Link
            to="/gallery"
            search={{ admin: true }}
            className="flex items-center gap-1 border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] px-3 py-1.5 rounded"
          >
            Gallery
          </Link>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 border border-[rgb(var(--border-soft))] text-[rgb(var(--fg))] px-3 py-1.5 rounded"
          >
            {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {!lockView && (
            <button
              onClick={copyLiveLink}
              className="flex items-center gap-1 border border-green-500/50 text-green-400 bg-green-500/10 px-3 py-1.5 rounded"
            >
              <Link2 size={12} /> Live Link
            </button>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {defaultView === "players" ? (
          <LiveView state={state} lastUpdated={lastUpdated} />
        ) : (
          <>
            <div className="flex gap-1 mb-6 glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-1.5 overflow-x-auto">
              {(
                [
                  "teams",
                  "matches",
                  "leaderboard",
                  "vis stats",
                  "settings",
                ] as const
              ).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold tracking-normal  whitespace-nowrap transition-colors",
                    tab === t
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-full"
                      : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "teams" && <TeamsTab state={state} setState={setState} />}
            {tab === "matches" && (
              <MatchesTab state={state} setState={setState} tournamentId={tournamentId} />
            )}
            {tab === "leaderboard" && <LeaderboardTab state={state} />}
            {tab === "vis stats" && <VISStatsTab state={state} tournamentId={tournamentId} />}
            {tab === "settings" && (
              <SettingsTab state={state} setState={setState} />
            )}
          </>
        )}

        <footer className="mt-16 pb-8 border-t border-[rgb(var(--border-soft))] pt-8 text-center flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            {state.settings.facebookUrl && (
              <a
                href={state.settings.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[rgb(var(--muted-fg))] hover:text-blue-500 transition-colors"
              >
                <Facebook size={24} />
              </a>
            )}
            {state.settings.instagramUrl && (
              <a
                href={state.settings.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[rgb(var(--muted-fg))] hover:text-pink-500 transition-colors"
              >
                <Instagram size={24} />
              </a>
            )}
            {state.settings.contactUrl && (
              <a
                href={state.settings.contactUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors px-4 py-2 border border-[rgb(var(--border-soft))] rounded-full hover:bg-[rgb(var(--bg))]"
              >
                <Mail size={16} /> Contact Us
              </a>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
