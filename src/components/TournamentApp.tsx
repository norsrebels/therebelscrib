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
  isPlayoffGameComplete,
  setsToWin,
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
import { LiveIntroSplash } from "@/components/LiveIntroSplash";
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
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Mail,
  Loader2,
  Upload,
  BarChart2,
} from "lucide-react";
import { Save, Check, AlertTriangle, Copy, Globe, Radio, ChevronRight, Share2, Trophy, Image as ImageIcon, Users, TrendingUp, BarChart3, Settings as SettingsIcon, Search } from "lucide-react";
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

      {/* Payment Status Summary */}
      {state.teams.length > 0 && (() => {
        const allPlayers = state.teams.flatMap(t => t.players ?? []);
        const paid = allPlayers.filter(p => p.paymentStatus === 'Paid').length;
        const partial = allPlayers.filter(p => p.paymentStatus === 'Partial').length;
        const pending = allPlayers.filter(p => p.paymentStatus === 'Pending').length;
        const total = allPlayers.length;
        if (total === 0) return null;
        return (
          <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))]">Payment Status</h3>
              <span className="text-xs text-[rgb(var(--muted-fg))]">{total} players total</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-[rgb(var(--surface-hover))] overflow-hidden flex mb-3">
              <div className="bg-green-500 transition-all" style={{ width: `${(paid/total)*100}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${(partial/total)*100}%` }} />
              <div className="bg-red-400/50 transition-all" style={{ width: `${(pending/total)*100}%` }} />
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /><span className="font-bold text-green-400">{paid}</span> Paid</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /><span className="font-bold text-amber-400">{partial}</span> Partial</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400/70 inline-block" /><span className="font-bold text-red-400">{pending}</span> Pending</span>
            </div>
          </div>
        );
      })()}

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
        <div className="flex flex-col items-center mt-8 gap-3">
          {(() => {
            // Warn when the Double-Pool format is selected but the two pools are
            // uneven (or one is too small) — top-2-per-pool assumes balanced pools.
            if (state.settings.formatType !== "pool2") return null;
            const a = state.teams.filter((t) => t.pool === "A").length;
            const b = state.teams.filter((t) => t.pool === "B").length;
            if (a >= 2 && b >= 2 && a === b) return null;
            let msg = "";
            if (a < 2 || b < 2) msg = `Double Pool needs at least 2 teams in each pool (currently A=${a}, B=${b}).`;
            else msg = `Pools are uneven (A=${a}, B=${b}). Double Pool advances the top 2 from each pool — even pools are recommended for fairness.`;
            return (
              <div className="flex items-start gap-2 max-w-md text-left px-4 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-600 dark:text-amber-400">{msg}</span>
              </div>
            );
          })()}
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

// ─── Bracket Visual ────────────────────────────────────────────────────────────
function BracketVisual({ resolvedPlayoffs, teams, maxScore, leadScore }: {
  resolvedPlayoffs: any[];
  teams: any[];
  maxScore: number | null;
  leadScore: number | null;
}) {
  // Group games by phase for column layout
  const phaseOrder = ['quarterfinal', 'semifinal', 'third', 'championship'];
  const grouped: Record<string, any[]> = {};
  for (const g of resolvedPlayoffs) {
    const phase = g.phase ?? 'other';
    if (!grouped[phase]) grouped[phase] = [];
    grouped[phase].push(g);
  }
  const phases = phaseOrder.filter(p => grouped[p]?.length);
  if (phases.length === 0) return null;

  const getTeamName = (id: string | null | undefined, label: string) =>
    id ? (teams.find((t: any) => t.id === id)?.name ?? label) : label;

  const isComplete = (g: any) =>
    g.scoreA !== null && g.scoreB !== null &&
    (maxScore ? (g.scoreA >= maxScore || g.scoreB >= maxScore) : g.scoreA !== g.scoreB);

  const getWinner = (g: any) => {
    if (!isComplete(g)) return null;
    return g.scoreA > g.scoreB
      ? getTeamName(g.teamAId, g.teamALabel)
      : getTeamName(g.teamBId, g.teamBLabel);
  };

  const phaseLabels: Record<string, string> = {
    quarterfinal: 'QF', semifinal: 'SF', third: '3rd', championship: 'Final'
  };

  return (
    <div className="glass border border-[rgb(var(--border-soft))] rounded-xl p-4 overflow-x-auto">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--muted-fg))] mb-3">Bracket</p>
      <div className="flex items-start gap-0 min-w-max">
        {phases.map((phase, phaseIdx) => (
          <div key={phase} className="flex items-center">
            {/* Phase column */}
            <div className="flex flex-col gap-3 min-w-[140px] max-w-[160px]">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider text-center mb-1">
                {phaseLabels[phase] ?? phase}
              </p>
              {(grouped[phase] ?? []).map((g: any, i: number) => {
                const nameA = getTeamName(g.teamAId, g.teamALabel ?? 'TBD');
                const nameB = getTeamName(g.teamBId, g.teamBLabel ?? 'TBD');
                const done = isComplete(g);
                const winner = getWinner(g);
                const aWon = done && winner === nameA;
                const bWon = done && winner === nameB;
                return (
                  <div key={g.slot} className={`rounded-xl border overflow-hidden text-xs ${done ? 'border-[rgb(var(--border))]' : 'border-dashed border-[rgb(var(--border-soft))]'}`}>
                    {/* Team A */}
                    <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[rgb(var(--border-soft))] ${aWon ? 'bg-green-500/10' : ''}`}>
                      <span className={`truncate font-medium ${aWon ? 'text-green-400' : 'text-[rgb(var(--fg))]'} ${nameA === 'TBD' ? 'text-[rgb(var(--muted-fg))] italic' : ''}`}>
                        {nameA}
                      </span>
                      {g.scoreA !== null && <span className={`font-bold tabular-nums flex-shrink-0 ${aWon ? 'text-green-400' : 'text-[rgb(var(--muted-fg))]'}`}>{g.scoreA}</span>}
                    </div>
                    {/* Team B */}
                    <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${bWon ? 'bg-green-500/10' : ''}`}>
                      <span className={`truncate font-medium ${bWon ? 'text-green-400' : 'text-[rgb(var(--fg))]'} ${nameB === 'TBD' ? 'text-[rgb(var(--muted-fg))] italic' : ''}`}>
                        {nameB}
                      </span>
                      {g.scoreB !== null && <span className={`font-bold tabular-nums flex-shrink-0 ${bWon ? 'text-green-400' : 'text-[rgb(var(--muted-fg))]'}`}>{g.scoreB}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Connector line between phases */}
            {phaseIdx < phases.length - 1 && (
              <div className="flex items-center self-center px-1">
                <div className="w-4 h-px bg-[rgb(var(--border))]" />
                <div className="text-[rgb(var(--border))]">›</div>
              </div>
            )}
          </div>
        ))}
      </div>
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
  const [matchSearch, setMatchSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState<"all" | "A" | "B" | "live" | "done" | "todo">("all");

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
  const isPool2 = state.settings.formatType === "pool2";
  const deBye = state.settings.deBye;

  // Build the bracket template based on current mode
  // SE (auto): derives bracket from pool counts — all existing formats unchanged
  // DE: uses the double-elimination bracket for this team count
  // pool2: double-pool, top-2-per-pool → semis / bronze / final (any pool sizes)
  const variant = isPool2 ? "pool2" : isDE ? "de" : "auto";
  const template = buildBracketTemplate(poolA, poolB, variant, deBye);

  // Whether a DE bracket is available for the current team count
  // The button hides automatically for counts with no DE defined (e.g. 4+4, 5+5)
  const deBracketExists =
    poolB === 0 && buildBracketTemplate(poolA, poolB, "de").length > 0;
  // pool2 needs at least 2 teams in each of the two pools.
  const pool2Available = poolA >= 2 && poolB >= 2;

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
    state.settings,
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

  // Bo3: write a single set's score into game.sets[setIdx].
  const updateSetScore = (
    slot: string,
    setIdx: number,
    field: "scoreA" | "scoreB",
    val: string,
  ) => {
    const num = val === "" ? 0 : parseInt(val);
    const newGames = [...state.playoffGames];
    let idx = newGames.findIndex((g) => g.slot === slot);
    if (idx < 0) {
      const g = resolvedPlayoffs.find((x) => x.slot === slot)!;
      newGames.push({ ...g, sets: [] });
      idx = newGames.length - 1;
    }
    const game = newGames[idx];
    const sets = [...(game.sets ?? [])];
    while (sets.length <= setIdx) sets.push({ scoreA: 0, scoreB: 0 });
    sets[setIdx] = { ...sets[setIdx], [field]: isNaN(num) ? 0 : num };
    newGames[idx] = { ...game, sets };
    setState({ ...state, playoffGames: newGames });
  };

  // Toggle a phase between single game (1) and best-of-3 (3).
  const setPhaseSeries = (phase: PlayoffPhase, len: 1 | 3) => {
    const seriesByPhase = { ...(state.settings.seriesByPhase ?? {}), [phase]: len };
    setState({ ...state, settings: { ...state.settings, seriesByPhase } });
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

  // Search + filter (patterned after the reference Pool Schedule screen).
  const teamName = (id: string | null) => state.teams.find((t) => t.id === id)?.name ?? "";
  const matchIsDone = (m: PoolMatch) => m.isFinal || (m.scoreA !== null && m.scoreB !== null);
  const matchIsLive = (m: PoolMatch) => !matchIsDone(m) && (m.scoreA !== null || m.scoreB !== null);
  const q = matchSearch.trim().toLowerCase();
  const filteredMatches = sortedMatches.filter((m) => {
    if (matchFilter === "A" && m.pool !== "A") return false;
    if (matchFilter === "B" && m.pool !== "B") return false;
    if (matchFilter === "done" && !matchIsDone(m)) return false;
    if (matchFilter === "live" && !matchIsLive(m)) return false;
    if (matchFilter === "todo" && (matchIsDone(m) || matchIsLive(m))) return false;
    if (q) {
      const hay = `${teamName(m.teamAId)} ${teamName(m.teamBId)} ${m.court ?? ""} pool ${m.pool}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

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

          {/* Search + progress + filters (patterned after the reference screen) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-3 py-2">
              <Search size={14} className="text-[rgb(var(--muted-fg))]" />
              <input
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                placeholder="Search matches or courts…"
                className="flex-1 bg-transparent text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))] focus:outline-none"
              />
            </div>
            <span className="text-[11px] font-bold text-[rgb(var(--muted-fg))] whitespace-nowrap">
              Showing {filteredMatches.length} of {state.poolMatches.length} games
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([
              ["all", "All"], ["A", "Pool A"], ["B", "Pool B"],
              ["live", "In progress"], ["done", "Final"], ["todo", "Upcoming"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMatchFilter(v)}
                className={cn(
                  "text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors",
                  matchFilter === v
                    ? "border-blue-500 bg-blue-500/10 text-blue-500"
                    : "border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {filteredMatches.length === 0 ? (
              <div className="text-center py-10 text-[rgb(var(--muted-fg))] text-sm">
                No matches match your search or filter.
              </div>
            ) : filteredMatches.map((m, i) => {
              const isFirstR2 =
                has2nd &&
                m.round > round1Boundary &&
                (i === 0 || filteredMatches[i - 1].round <= round1Boundary);
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
                {isPool2 ? "Double Pool" : isDE ? "Double Elim" : "Playoffs"}
              </span>
              {pool2Available && !isPool2 && !isDE && (
                <button
                  onClick={() => setState({ ...state, settings: { ...state.settings, formatType: "pool2" }, playoffGames: [] })}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-blue-500/50 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  title="Top 2 from each pool advance to semis / bronze / final"
                >
                  <Copy size={10} /> Double Pool
                </button>
              )}
              {isPool2 && !playoffHasScores && (
                <button
                  onClick={() => setState({ ...state, settings: { ...state.settings, formatType: "auto" }, playoffGames: [] })}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={10} /> Standard
                </button>
              )}
              {!isDE && !isPool2 && deBracketExists && (
                <button
                  onClick={() => setShowDEModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border border-orange-500/50 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
                >
                  <Copy size={10} /> Generate DE
                </button>
              )}
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

          {/* Visual bracket tree */}
          <BracketVisual
            resolvedPlayoffs={resolvedPlayoffs}
            teams={state.teams}
            maxScore={state.settings.maxScore}
            leadScore={state.settings.leadScore}
          />

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
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded border",
                          PHASE_COLORS[g.phase as PlayoffPhase],
                        )}
                      >
                        {PHASE_LABELS[g.phase as PlayoffPhase] || g.label}
                      </span>
                      {(!g.teamAId || !g.teamBId) && (
                        <span className="text-[9px] font-bold text-[rgb(var(--muted-fg))] flex items-center gap-1">
                          <Clock size={10} /> Waiting for teams
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Per-phase best-of toggle */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[rgb(var(--muted-fg))]">Series:</span>
                    {([1, 3] as const).map((len) => {
                      const active = setsToWin(g.phase as PlayoffPhase, state.settings) === (len === 3 ? 2 : 1);
                      return (
                        <button
                          key={len}
                          onClick={() => setPhaseSeries(g.phase as PlayoffPhase, len)}
                          disabled={g.isFinal}
                          className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded border transition-colors disabled:opacity-40",
                            active
                              ? "border-blue-500 bg-blue-500/10 text-blue-500"
                              : "border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]",
                          )}
                        >
                          {len === 1 ? "1 set" : "Best of 3"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bo3 set-by-set entry (only when this phase is best-of-3) */}
                  {setsToWin(g.phase as PlayoffPhase, state.settings) === 2 && (
                    <div className="mb-3 rounded-lg border border-[rgb(var(--border-soft))] p-2">
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((si) => {
                          const set = g.sets?.[si];
                          return (
                            <div key={si} className="text-center">
                              <div className="text-[9px] font-bold text-[rgb(var(--muted-fg))] mb-1">Set {si + 1}</div>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  disabled={g.isFinal}
                                  type="number" min="0"
                                  className="w-9 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] text-xs text-center px-1 py-0.5 rounded text-[rgb(var(--fg))]"
                                  value={set?.scoreA ?? ""}
                                  onChange={(e) => updateSetScore(g.slot, si, "scoreA", e.target.value)}
                                />
                                <span className="text-[9px] text-[rgb(var(--muted-fg))]">-</span>
                                <input
                                  disabled={g.isFinal}
                                  type="number" min="0"
                                  className="w-9 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] text-xs text-center px-1 py-0.5 rounded text-[rgb(var(--fg))]"
                                  value={set?.scoreB ?? ""}
                                  onChange={(e) => updateSetScore(g.slot, si, "scoreB", e.target.value)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        const a = (g.sets ?? []).filter((s) => s.scoreA > s.scoreB).length;
                        const b = (g.sets ?? []).filter((s) => s.scoreB > s.scoreA).length;
                        const done = a >= 2 || b >= 2;
                        return (
                          <div className="text-center mt-2 text-[10px] font-bold">
                            <span className={done ? "text-emerald-500" : "text-[rgb(var(--muted-fg))]"}>
                              Series {a}–{b}{done ? " • Complete" : ""}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Single-game score entry — hidden for Bo3 phases */}
                  <div className={cn("space-y-2", setsToWin(g.phase as PlayoffPhase, state.settings) === 2 && "hidden")}>
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
                            <span className="flex flex-col min-w-0">
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
                              {row.t && row.lbl && row.lbl !== row.t.name && (
                                <span className="text-[10px] text-[rgb(var(--muted-fg))] truncate">{row.lbl}</span>
                              )}
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
  const renderTable = (standings: TeamStanding[], poolLabel: string) => {
    const h2hMap: Record<string, Record<string, string>> = {};
    for (const s of standings) {
      h2hMap[s.team.id] = {};
      for (const opp of standings) {
        if (opp.team.id === s.team.id) continue;
        const match = state.poolMatches.find(
          m => (m.teamAId === s.team.id && m.teamBId === opp.team.id) ||
               (m.teamAId === opp.team.id && m.teamBId === s.team.id)
        );
        if (match && isGameComplete(match, state.settings.maxScore, state.settings.leadScore)) {
          const isA = match.teamAId === s.team.id;
          const myScore = isA ? match.scoreA! : match.scoreB!;
          const oppScore = isA ? match.scoreB! : match.scoreA!;
          h2hMap[s.team.id][opp.team.id] = myScore > oppScore ? 'W' : 'L';
        }
      }
    }
    return (
      <div className="mb-8">
        <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))] mb-4">{poolLabel}</h3>
        <div className="overflow-x-auto glass rounded-xl border border-[rgb(var(--border-soft))] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
                {["#", "TEAM", "W", "L", "GP", "PF", "PA", "+/-", "QUOT", "H2H"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold tracking-tight text-[rgb(var(--muted-fg))] last:text-right whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-6 text-[rgb(var(--muted-fg))] italic">No results yet</td></tr>
              ) : (
                standings.map((s) => {
                  const diff = s.pointsFor - s.pointsAgainst;
                  const h2hResults = h2hMap[s.team.id] ?? {};
                  return (
                    <tr key={s.team.id} className="border-b border-[rgb(var(--border-soft))] last:border-0 hover:bg-[rgb(var(--bg))]">
                      <td className="py-3 px-4">
                        {s.rank <= 2 ? (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold",
                              s.rank === 1
                                ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                                : "bg-[rgb(var(--surface-hover))] text-[rgb(var(--fg))] border border-[rgb(var(--border-strong))]",
                            )}
                            title={s.rank <= 2 ? "Advances (top 2)" : undefined}
                          >
                            {s.rank}
                          </span>
                        ) : (
                          <span className="text-[rgb(var(--muted-fg))] font-mono text-xs pl-1.5">{s.rank}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[rgb(var(--fg))]">{s.team.name}</td>
                      <td className="py-3 px-4 font-bold text-green-400">{s.wins}</td>
                      <td className="py-3 px-4 text-red-400">{s.losses}</td>
                      <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">{s.gamesPlayed}</td>
                      <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">{s.pointsFor}</td>
                      <td className="py-3 px-4 text-[rgb(var(--muted-fg))]">{s.pointsAgainst}</td>
                      <td className={`py-3 px-4 font-bold font-mono ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-[rgb(var(--muted-fg))]'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
                      <td className="py-3 px-4 font-mono text-[rgb(var(--fg))]">{s.quotient.toFixed(3)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {Object.entries(h2hResults).map(([oppId, result]) => {
                            const opp = standings.find(x => x.team.id === oppId);
                            return (
                              <span key={oppId} title={`vs ${opp?.team.name ?? ''}: ${result}`}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${result === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {result}
                              </span>
                            );
                          })}
                          {Object.keys(h2hResults).length === 0 && <span className="text-[10px] text-[rgb(var(--muted-fg))]">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-2 flex gap-3">
          <span><strong>+/-</strong> Point differential</span>
          <span><strong>H2H</strong> Head-to-head vs tied opponents</span>
          <span><strong>QUOT</strong> PF÷PA (FIVB tiebreaker)</span>
        </p>
      </div>
    );
  };

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

  const singlePool = (sA.length > 0) !== (sB.length > 0);

  return (
    <div className={singlePool ? "max-w-2xl" : ""}>
      {sA.length > 0 && renderTable(sA, singlePool ? "Standings" : "Pool A Standings")}
      {sB.length > 0 && renderTable(sB, singlePool ? "Standings" : "Pool B Standings")}

      {(sA.length > 0 || sB.length > 0) && (
        <div className="glass border border-[rgb(var(--border-soft))] rounded-xl p-4 mt-2">
          <h4 className="text-xs font-bold text-[rgb(var(--fg))] mb-2 flex items-center gap-1.5">
            <TrendingUp size={13} /> Standings &amp; Tiebreaking Sequence
          </h4>
          <p className="text-[11px] text-[rgb(var(--muted-fg))] mb-2">In the event of a tie in win records, standings are sorted by:</p>
          <ol className="text-[11px] text-[rgb(var(--muted-fg))] space-y-1 list-decimal pl-4">
            <li><span className="font-bold text-[rgb(var(--fg))]">Wins record</span> — higher win count is ranked higher.</li>
            <li><span className="font-bold text-[rgb(var(--fg))]">Head-to-head (H2H)</span> — for a 2-way tie, the winner of their direct match is ranked higher.</li>
            <li><span className="font-bold text-[rgb(var(--fg))]">Points For (PF)</span> — total score points earned.</li>
            <li><span className="font-bold text-[rgb(var(--fg))]">Points Quotient (PF÷PA)</span> — higher quotient wins.</li>
          </ol>
          {state.settings.formatType === "pool2" && (
            <p className="text-[11px] text-amber-500 mt-2 font-bold">Top 2 of each pool (highlighted) advance to the semi-finals.</p>
          )}
        </div>
      )}
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

type LiveFilter = "all" | "ongoing" | "next" | "done";
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
  court: string | null;
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
  const [followTeam, setFollowTeam] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, boolean>>({});
  const [shareToast, setShareToast] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const prevScoresRef = useRef<Record<string, { a: number | null; b: number | null }>>({});

  const standingsA = computeStandings(
    state.teams, state.poolMatches, "A", state.settings.maxScore, state.settings.leadScore,
  );
  const standingsB = computeStandings(
    state.teams, state.poolMatches, "B", state.settings.maxScore, state.settings.leadScore,
  );

  // Tick every second for "ago" timer
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
          type: "pool" as const,
          pool: match.pool,
          order: match.gameNum,
          title: `Pool ${match.pool} · Game ${match.gameNum}`,
          subtitle: `Round ${match.round}${match.court ? ` · Court ${match.court}` : ""} · Slot ${match.gameNum}`,
          teamAName: teamA?.name ?? "TBD",
          teamBName: teamB?.name ?? "TBD",
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          court: match.court ?? null,
          isComplete,
          isOngoing: hasAnyScore && !isComplete,
          status: "pending" as LiveGameStatus,
        };
      });

    const playoffTemplate = buildBracketTemplate(
      state.teams.filter((t) => t.pool === "A").length,
      state.teams.filter((t) => t.pool === "B").length,
      state.settings.formatType === "pool2" ? "pool2" : state.settings.useDEBracket ? "de" : "auto",
      state.settings.deBye,
    );
    const playoffGames = resolvePlayoffGames(
      playoffTemplate, state.teams, state.poolMatches, state.playoffGames,
      state.settings.maxScore, state.settings.leadScore, state.settings,
    );
    const playoffCards: LiveGameCard[] = playoffGames.map((game, index) => {
      const teamA = game.teamAId ? state.teams.find((t) => t.id === game.teamAId) : null;
      const teamB = game.teamBId ? state.teams.find((t) => t.id === game.teamBId) : null;
      const hasAnyScore = game.scoreA !== null || game.scoreB !== null || (game.sets?.length ?? 0) > 0;
      const isComplete = isPlayoffGameComplete(game, state.settings.maxScore, state.settings.leadScore, state.settings);
      return {
        id: game.slot,
        type: "playoff" as const,
        order: index + 1,
        title: game.slot,
        subtitle: `${PHASE_LABELS[game.phase]}${game.court ? ` • Court ${game.court}` : ""}`,
        teamAName: teamA?.name ?? game.teamALabel,
        teamBName: teamB?.name ?? game.teamBLabel,
        teamAId: game.teamAId ?? null,
        teamBId: game.teamBId ?? null,
        scoreA: game.scoreA,
        scoreB: game.scoreB,
        court: game.court ?? null,
        isComplete,
        isOngoing: hasAnyScore && !isComplete,
        status: "pending" as LiveGameStatus,
      };
    });

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
      else if (!foundNext) { slotStatus = "next"; foundNext = true; }
      else slotStatus = "pending";
      for (const c of cards) poolWithStatus.push({ ...c, status: slotStatus });
    }
    const playoffWithStatus: LiveGameCard[] = playoffCards.map((c) => {
      let status: LiveGameStatus = "pending";
      if (c.isComplete) status = "done";
      else if (c.isOngoing) status = "ongoing";
      else if (!foundNext) { status = "next"; foundNext = true; }
      return { ...c, status };
    });
    return [...poolWithStatus, ...playoffWithStatus];
  }, [state]);

  // Score change detection — flash animation
  useEffect(() => {
    const newFlash: Record<string, boolean> = {};
    for (const card of liveCards) {
      const prev = prevScoresRef.current[card.id];
      if (prev) {
        if (prev.a !== card.scoreA) newFlash[`${card.id}-A`] = true;
        if (prev.b !== card.scoreB) newFlash[`${card.id}-B`] = true;
      }
      prevScoresRef.current[card.id] = { a: card.scoreA, b: card.scoreB };
    }
    if (Object.keys(newFlash).length > 0) {
      setFlashMap(newFlash);
      setTimeout(() => setFlashMap({}), 700);
    }
  }, [liveCards]);

  // Browser tab pulse when live games ongoing
  useEffect(() => {
    const name = state.settings.scheduleName || "The Rebels Crib";
    const ongoingCards = liveCards.filter((c) => c.status === "ongoing");
    if (ongoingCards.length === 0) {
      document.title = name;
      return;
    }
    const firstOngoing = ongoingCards[0];
    const liveTitle = `● LIVE — ${firstOngoing.teamAName} vs ${firstOngoing.teamBName}`;
    let toggle = false;
    const interval = setInterval(() => {
      document.title = toggle ? liveTitle : name;
      toggle = !toggle;
    }, 800);
    return () => { clearInterval(interval); document.title = name; };
  }, [liveCards, state.settings.scheduleName]);

  const ongoingCards = liveCards.filter((c) => c.status === "ongoing");
  const nextCards = liveCards.filter((c) => c.status === "next");
  const completedCards = liveCards.filter((c) => c.status === "done");
  const activeCards = liveCards.filter((c) => c.status !== "done");

  const totalMatches = liveCards.length;
  const playedMatches = completedCards.length + ongoingCards.length;

  // Tournament completion — champion detection from the final playoff game
  const allComplete = totalMatches > 0 && completedCards.length === totalMatches;
  const championInfo = useMemo(() => {
    if (!allComplete) return null;
    // The championship is the last playoff card (highest phase). Find the final.
    const playoffCards = liveCards.filter((c) => c.type === "playoff");
    if (playoffCards.length === 0) {
      // Pool-only tournament — champion is the top of combined standings
      const allStandings = [...standingsA, ...standingsB].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
      });
      const top = allStandings[0];
      if (!top) return null;
      return { champion: top.team.name, runnerUp: allStandings[1]?.team.name ?? null, type: "pool" as const };
    }
    // Find the final game (last in playoff order)
    const finalGame = playoffCards[playoffCards.length - 1];
    if (!finalGame || finalGame.scoreA === null || finalGame.scoreB === null) return null;
    const champion = finalGame.scoreA > finalGame.scoreB ? finalGame.teamAName : finalGame.teamBName;
    const runnerUp = finalGame.scoreA > finalGame.scoreB ? finalGame.teamBName : finalGame.teamAName;
    return { champion, runnerUp, type: "playoff" as const };
  }, [allComplete, liveCards, standingsA, standingsB]);

  // Team follow filter
  const allTeamNames = [...new Set(liveCards.flatMap((c) => [c.teamAName, c.teamBName]).filter((n) => n !== "TBD"))].sort();

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
    const groups: { key: string; label: string | null; cards: LiveGameCard[] }[] = [];
    for (const [slotNum, slotCards] of [...poolGroups.entries()].sort((a, b) => a[0] - b[0])) {
      const sorted = slotCards.slice().sort((a, b) => (a.pool ?? "").localeCompare(b.pool ?? ""));
      const label = slotCards.length > 1 ? `Slot ${slotNum} · Simultaneous` : `Slot ${slotNum}`;
      groups.push({ key: `slot-${slotNum}`, label, cards: sorted });
    }
    for (const c of playoffSolo) {
      groups.push({ key: `playoff-${c.id}`, label: null, cards: [c] });
    }
    return groups;
  };

  const applyFollowFilter = (cards: LiveGameCard[]) => {
    if (!followTeam) return cards;
    return cards.filter((c) => c.teamAName === followTeam || c.teamBName === followTeam);
  };

  const filteredActiveCards = useMemo(() => {
    let base = activeCards;
    if (filter === "ongoing") base = ongoingCards;
    else if (filter === "next") base = nextCards;
    return applyFollowFilter(base);
  }, [filter, activeCards, ongoingCards, nextCards, followTeam]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = state.settings.scheduleName || "Live Tournament";
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(url);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  // H2H helper for live standings
  const computeH2H = (standings: typeof standingsA) => {
    const map: Record<string, Record<string, string>> = {};
    for (const s of standings) {
      map[s.team.id] = {};
      for (const opp of standings) {
        if (opp.team.id === s.team.id) continue;
        const match = state.poolMatches.find(
          m => (m.teamAId === s.team.id && m.teamBId === opp.team.id) ||
               (m.teamAId === opp.team.id && m.teamBId === s.team.id)
        );
        if (match && isGameComplete(match, state.settings.maxScore, state.settings.leadScore)) {
          const isA = match.teamAId === s.team.id;
          const my = isA ? match.scoreA! : match.scoreB!;
          const their = isA ? match.scoreB! : match.scoreA!;
          map[s.team.id][opp.team.id] = my > their ? "W" : "L";
        }
      }
    }
    return map;
  };

  const renderLiveStandings = (standings: typeof standingsA, label: string) => {
    const h2h = computeH2H(standings);
    return (
      <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4">
        <h3 className="text-xs font-bold tracking-tight mb-3">{label}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[rgb(var(--muted-fg))]">
                {["#", "Team", "W", "L", "PF", "PA", "+/-", "Quot", "H2H"].map((h) => (
                  <th key={h} className="py-2 text-left font-bold last:text-right whitespace-nowrap px-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((team) => {
                const diff = team.pointsFor - team.pointsAgainst;
                const h2hResults = h2h[team.team.id] ?? {};
                return (
                  <tr key={team.team.id} className="border-t border-[rgb(var(--border-soft))]">
                    <td className="py-2 font-mono text-[rgb(var(--muted-fg))] px-1">{team.rank}</td>
                    <td className="py-2 font-semibold px-1">{team.team.name}</td>
                    <td className="py-2 text-green-400 font-bold px-1">{team.wins}</td>
                    <td className="py-2 text-red-400 px-1">{team.losses}</td>
                    <td className="py-2 px-1">{team.pointsFor}</td>
                    <td className="py-2 px-1">{team.pointsAgainst}</td>
                    <td className={`py-2 font-bold font-mono px-1 ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-[rgb(var(--muted-fg))]"}`}>
                      {diff > 0 ? "+" : ""}{diff}
                    </td>
                    <td className="py-2 text-right font-mono px-1">{team.quotient.toFixed(3)}</td>
                    <td className="py-2 text-right px-1">
                      <div className="flex items-center justify-end gap-0.5 flex-wrap">
                        {Object.entries(h2hResults).map(([oppId, result]) => (
                          <span key={oppId}
                            className={`text-[9px] font-bold px-1 py-0.5 rounded ${result === "W" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                            {result}
                          </span>
                        ))}
                        {Object.keys(h2hResults).length === 0 && <span className="text-[rgb(var(--muted-fg))]">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Empty state — no matches at all
  if (liveCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <img src="/logo.png" alt="Rebels" className="w-16 h-16 rounded-2xl opacity-60" />
        <div>
          <p className="text-lg font-bold">Tournament hasn't started yet</p>
          {state.settings.scheduleName && (
            <p className="text-sm text-[rgb(var(--muted-fg))] mt-1">{state.settings.scheduleName}</p>
          )}
          {(state.settings.date || state.settings.startTime) && (
            <p className="text-sm text-[rgb(var(--muted-fg))]">
              {[state.settings.date, state.settings.startTime].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm animate-pulse">
          <Radio size={14} /> Waiting for scores...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">Live Match Center</h2>
            <p className="text-xs text-[rgb(var(--muted-fg))] mt-1">Public scoreboard and next-game callouts</p>
            {/* Tournament progress bar */}
            {totalMatches > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-[rgb(var(--muted-fg))] mb-1">
                  <span>{playedMatches} of {totalMatches} matches played</span>
                  <span>{Math.round((playedMatches / totalMatches) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgb(var(--surface-hover))] overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(playedMatches / totalMatches) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {lastUpdated && (
              <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-2 flex items-center gap-1.5">
                <RefreshCw size={10} className="animate-spin" style={{ animationDuration: "3s" }} />
                Auto-refreshing · Last updated {lastUpdated.toLocaleTimeString()} ({Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000))}s ago)
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {/* Share button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors relative"
            >
              <Share2 size={13} />
              {shareToast ? "Link copied!" : "Share"}
            </button>
            {/* Filter bar */}
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "all", label: "All Games", icon: <Globe size={12} /> },
                { key: "ongoing", label: "Live Now", icon: <Radio size={12} className="text-red-400" /> },
                { key: "next", label: "Up Next", icon: <ChevronRight size={12} /> },
                { key: "done", label: "Results", icon: <Trophy size={12} className="text-amber-400" /> },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  onClick={() => setFilter(option.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-normal border transition-colors",
                    filter === option.key
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]",
                  )}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team follow filter */}
        {allTeamNames.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] text-[rgb(var(--muted-fg))] whitespace-nowrap font-medium flex-shrink-0">Follow:</span>
            {followTeam && (
              <button
                onClick={() => setFollowTeam(null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white flex-shrink-0"
              >
                {followTeam} <X size={10} />
              </button>
            )}
            {allTeamNames.filter((n) => n !== followTeam).map((name) => (
              <button
                key={name}
                onClick={() => setFollowTeam(name)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:border-blue-500/40 whitespace-nowrap flex-shrink-0 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tournament Completion Summary — champion celebration */}
      {allComplete && championInfo && (
        <div className="glass border-2 border-amber-500/30 rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
              <Trophy size={28} className="text-amber-400" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 mb-1">
              Tournament Complete
            </p>
            <h2 className="text-2xl font-bold text-[rgb(var(--fg))]">{championInfo.champion}</h2>
            <p className="text-sm text-[rgb(var(--muted-fg))] mt-1">Champion 🏆</p>
            {championInfo.runnerUp && (
              <p className="text-xs text-[rgb(var(--muted-fg))] mt-3">
                Runner-up: <span className="font-medium text-[rgb(var(--fg))]">{championInfo.runnerUp}</span>
              </p>
            )}
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-3">
              All {totalMatches} matches completed
            </p>
          </div>
        </div>
      )}
      {ongoingCards.length > 1 && (
        <div className="glass border border-[rgb(var(--border-soft))] rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--muted-fg))] mb-2">Courts Active Now</p>
          <div className="flex flex-wrap gap-2">
            {ongoingCards.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-xs">
                <span className="font-bold text-amber-400">{c.court ? `Court ${c.court}` : "Court ?"}</span>
                <span className="text-[rgb(var(--muted-fg))]">·</span>
                <span className="font-medium">{c.teamAName}</span>
                <span className="text-[rgb(var(--muted-fg))]">vs</span>
                <span className="font-medium">{c.teamBName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UP NEXT banner */}
      {nextCards.length > 0 && filter !== "ongoing" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <ChevronRight size={16} className="text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Up Next</span>
            <p className="text-sm font-bold truncate">
              {nextCards[0].teamAName} vs {nextCards[0].teamBName}
              {nextCards[0].court && <span className="font-normal text-amber-400/70"> · Court {nextCards[0].court}</span>}
            </p>
          </div>
          {nextCards.length > 1 && (
            <span className="text-[11px] text-amber-400 flex-shrink-0">+{nextCards.length - 1} more</span>
          )}
        </div>
      )}

      {/* ONGOING highlight section */}
      {(filter === "all" || filter === "ongoing") && ongoingCards.length > 0 && (
        <div className="flex flex-col items-center mb-2 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-blue-500 animate-pulse flex items-center gap-2">
            <Radio size={18} /> Live Now
          </h2>
          <div className="w-full max-w-5xl space-y-4">
            {groupCardsBySlot(applyFollowFilter(ongoingCards)).map((group) => (
              <div key={`ongoing-${group.key}`} className="space-y-3">
                {group.label && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold tracking-tight text-blue-500">{group.label}</span>
                    <div className="flex-1 h-px bg-amber-500/30" />
                  </div>
                )}
                <div className={cn("grid gap-4", group.cards.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                  {group.cards.map((card) => {
                    const aLeads = (card.scoreA ?? 0) > (card.scoreB ?? 0);
                    const bLeads = (card.scoreB ?? 0) > (card.scoreA ?? 0);
                    return (
                    <div key={`ongoing-${card.id}`}
                      className="glass border-2 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] rounded-xl p-6 text-center relative">
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-red-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                      </span>
                      {card.court && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold text-[rgb(var(--muted-fg))] bg-[rgb(var(--surface-hover))] px-2 py-0.5 rounded-full">
                          Court {card.court}
                        </span>
                      )}
                      <p className="text-sm font-bold tracking-tight text-blue-500 mb-1 mt-1">{card.title}</p>
                      <p className="text-xs text-[rgb(var(--muted-fg))] mb-4">{card.subtitle}</p>
                      <div className="flex justify-center items-center gap-4 sm:gap-6">
                        <div className="flex-1 text-right">
                          <p className={cn("text-base sm:text-lg line-clamp-2", aLeads ? "font-extrabold text-[rgb(var(--fg))]" : "font-bold text-[rgb(var(--muted-fg))]")}>{card.teamAName}</p>
                        </div>
                        <div className="bg-blue-500/10 px-4 py-2 rounded-xl font-semibold text-2xl sm:text-3xl text-blue-500 min-w-[90px] flex items-center justify-center gap-2">
                          <span className={cn("transition-all duration-300", flashMap[`${card.id}-A`] && "text-amber-400 scale-125")}>
                            {card.scoreA ?? 0}
                          </span>
                          <span className="text-lg text-[rgb(var(--muted-fg))]">-</span>
                          <span className={cn("transition-all duration-300", flashMap[`${card.id}-B`] && "text-amber-400 scale-125")}>
                            {card.scoreB ?? 0}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className={cn("text-base sm:text-lg line-clamp-2", bLeads ? "font-extrabold text-[rgb(var(--fg))]" : "font-bold text-[rgb(var(--muted-fg))]")}>{card.teamBName}</p>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standings — always visible */}
      {(standingsA.length > 0 || standingsB.length > 0) && (() => {
        const bothPools = standingsA.length > 0 && standingsB.length > 0;
        const onePool = !bothPools;
        return (
          <div className={bothPools ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "max-w-2xl"}>
            {standingsA.length > 0 && renderLiveStandings(standingsA, onePool ? "Standings" : "Pool A Standings")}
            {standingsB.length > 0 && renderLiveStandings(standingsB, onePool ? "Standings" : "Pool B Standings")}
          </div>
        );
      })()}

      {/* Active games list (pending + next, no done) — hidden on the Results filter */}
      {filter !== "done" && (
        filteredActiveCards.filter((c) => c.status !== "ongoing").length === 0 && filter !== "ongoing" ? (
          <div className="text-center py-14 rounded-xl border border-[rgb(var(--border-soft))] glass text-[rgb(var(--muted-fg))]">
            No games to display for this filter.
          </div>
        ) : (
        <div className="space-y-5">
          {groupCardsBySlot(filteredActiveCards.filter((c) => c.status !== "ongoing")).map((group) => (
            <div key={`list-${group.key}`} className="space-y-2">
              {group.label && group.cards.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold tracking-tight text-[rgb(var(--muted-fg))]">{group.label}</span>
                  <div className="flex-1 h-px bg-[rgb(var(--border))]" />
                </div>
              )}
              <div className={cn("grid gap-4", group.cards.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 lg:grid-cols-2")}>
                {group.cards.map((card) => (
                  <div key={card.id} className="glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold tracking-tight">{card.title}</p>
                        <p className="text-[11px] text-[rgb(var(--muted-fg))]">{card.subtitle}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold tracking-tight px-2 py-1 rounded",
                        card.status === "done" ? "bg-blue-500/10 text-blue-500"
                          : card.status === "next" ? "bg-amber-500/15 text-amber-400"
                          : "bg-slate-500/15 text-slate-400",
                      )}>
                        {card.status === "next" ? "Up Next" : card.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      {[
                        { name: card.teamAName, score: card.scoreA, won: card.isComplete && card.scoreA !== null && card.scoreB !== null && card.scoreA > card.scoreB, flashKey: `${card.id}-A` },
                        { name: card.teamBName, score: card.scoreB, won: card.isComplete && card.scoreA !== null && card.scoreB !== null && card.scoreB > card.scoreA, flashKey: `${card.id}-B` },
                      ].map((team) => (
                        <div key={team.name} className="flex items-center justify-between gap-3">
                          <span className="font-semibold truncate inline-flex items-center gap-1.5">
                            {card.isComplete && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${team.won ? "bg-blue-500/10 text-blue-500" : "bg-red-500/15 text-red-400"}`}>
                                {team.won ? "W" : "L"}
                              </span>
                            )}
                            {team.name}
                          </span>
                          <span className={cn("font-mono text-base transition-all duration-300", flashMap[team.flashKey] && "text-amber-400 scale-110 font-bold")}>
                            {team.score ?? "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Stats link on completed cards */}
                    {card.isComplete && (
                      <div className="pt-1 border-t border-[rgb(var(--border-soft))]">
                        <Link to="/leaderboard" className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                          <BarChart2 size={10} /> View player stats →
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Completed games / Results */}
      {completedCards.length > 0 && (filter === "all" || filter === "done") && (
        <div className="glass border border-[rgb(var(--border-soft))] rounded-xl overflow-hidden">
          {/* On the "Results" filter the list is always open; on "all" it's collapsible. */}
          {filter === "all" ? (
            <button
              onClick={() => setCompletedOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgb(var(--surface-hover))] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-amber-400" />
                <span className="text-sm font-semibold">Results ({completedCards.length})</span>
              </div>
              <ChevronRight size={16} className={cn("text-[rgb(var(--muted-fg))] transition-transform", completedOpen && "rotate-90")} />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgb(var(--border-soft))]">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-sm font-semibold">Results ({applyFollowFilter(completedCards).length})</span>
            </div>
          )}
          {(filter === "done" || completedOpen) && (
            <div className={cn("p-3", filter === "all" && "border-t border-[rgb(var(--border-soft))]")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {applyFollowFilter(completedCards).map((card) => {
                  const aWon = (card.scoreA ?? 0) > (card.scoreB ?? 0);
                  const bWon = (card.scoreB ?? 0) > (card.scoreA ?? 0);
                  return (
                    <div key={`done-${card.id}`} className="px-3 py-2.5 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-bold text-[10px] uppercase tracking-wide text-[rgb(var(--muted-fg))]">{card.title}</p>
                        <span className="text-[9px] font-bold text-green-500 flex items-center gap-1"><Check size={10} /> Final</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate flex items-center gap-1", aWon ? "font-extrabold text-[rgb(var(--fg))]" : "text-[rgb(var(--muted-fg))]")}>
                          {aWon && <Trophy size={10} className="text-amber-400 shrink-0" />}{card.teamAName}
                        </span>
                        <span className={cn("font-mono font-bold tabular-nums shrink-0", aWon ? "text-[rgb(var(--fg))]" : "text-[rgb(var(--muted-fg))]")}>{card.scoreA}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={cn("truncate flex items-center gap-1", bWon ? "font-extrabold text-[rgb(var(--fg))]" : "text-[rgb(var(--muted-fg))]")}>
                          {bWon && <Trophy size={10} className="text-amber-400 shrink-0" />}{card.teamBName}
                        </span>
                        <span className={cn("font-mono font-bold tabular-nums shrink-0", bWon ? "text-[rgb(var(--fg))]" : "text-[rgb(var(--muted-fg))]")}>{card.scoreB}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
  const [showCardGenerator, setShowCardGenerator] = useState(false);
  const [showChampionsCard, setShowChampionsCard] = useState(false);

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

        {/* Bracket & Playoff Variant — pick the format once, here (unify) */}
        <div className="pt-4 border-t border-[rgb(var(--border-soft))] mt-4">
          <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))] mb-1">
            Bracket &amp; Playoff Variant
          </h3>
          <p className="text-[10px] text-[rgb(var(--muted-fg))] mb-3">
            How the playoffs are structured. Changing this rebuilds the bracket.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { key: 'auto', title: 'Standard', desc: 'Bracket derived from team counts' },
              { key: 'de', title: 'Double Elim', desc: 'Lose twice to be out (single pool)' },
              { key: 'pool2', title: 'Double Pool', desc: 'Top 2 per pool → semis / bronze / final' },
            ] as const).map((opt) => {
              const active =
                opt.key === 'de'
                  ? localSettings.useDEBracket === true
                  : localSettings.formatType === opt.key && !localSettings.useDEBracket
                  || (opt.key === 'auto' && (localSettings.formatType ?? 'auto') === 'auto' && !localSettings.useDEBracket)
              return (
                <button
                  key={opt.key}
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      formatType: opt.key === 'de' ? (localSettings.formatType ?? 'auto') : opt.key,
                      useDEBracket: opt.key === 'de',
                    })
                  }
                  className={cn(
                    'p-3 text-left rounded-lg border-2 text-xs transition-all',
                    active
                      ? 'border-[rgb(var(--accent-500))] bg-[rgb(var(--accent-500))]/10 text-[rgb(var(--fg))] font-bold'
                      : 'border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] text-[rgb(var(--muted-fg))] hover:bg-[rgb(var(--surface-hover))]',
                  )}
                >
                  <span className="block font-bold text-[rgb(var(--fg))] mb-0.5">{opt.title}</span>
                  <span className="block text-[10px] text-[rgb(var(--muted-fg))]">{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Playoff Series Format — per-phase Bo1/Bo3, configured once */}
        <div className="pt-4 border-t border-[rgb(var(--border-soft))] mt-4">
          <h3 className="text-xs font-bold tracking-tight text-[rgb(var(--fg))] mb-1">
            Playoff Series Format
          </h3>
          <p className="text-[10px] text-[rgb(var(--muted-fg))] mb-3">
            Choose which playoff phases are a single game or a best-of-3 series.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { id: 'semifinal', label: 'Semi-Finals' },
              { id: 'championship', label: 'Championship' },
              { id: '3rd_place', label: 'Battle for 3rd' },
            ] as const).map((ph) => {
              const currentVal = localSettings.seriesByPhase?.[ph.id] ?? 1
              return (
                <div key={ph.id} className="p-3 bg-[rgb(var(--bg))] rounded-lg border border-[rgb(var(--border-soft))]">
                  <span className="block text-[10px] font-bold text-[rgb(var(--muted-fg))] mb-2">{ph.label}</span>
                  <select
                    value={currentVal}
                    onChange={(e) => {
                      const nextSeries = { ...(localSettings.seriesByPhase ?? {}) }
                      nextSeries[ph.id] = parseInt(e.target.value, 10) as 1 | 3
                      setLocalSettings({ ...localSettings, seriesByPhase: nextSeries })
                    }}
                    className="w-full text-xs px-2 py-1.5 bg-[rgb(var(--surface))] text-[rgb(var(--fg))] border border-[rgb(var(--border-soft))] rounded focus:outline-none focus:border-[rgb(var(--accent-500))]"
                  >
                    <option value="1">Single Game (Bo1)</option>
                    <option value="3">Best of 3 Sets (Bo3)</option>
                  </select>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-2">
            Remember to Save Settings. Bo3 games show a 3-set entry grid in the bracket.
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
          <button
            onClick={() => setShowCardGenerator(true)}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors"
          >
            <ImageIcon size={16} /> Generate Schedule Card (JPG)
          </button>
          <button
            onClick={() => setShowChampionsCard(true)}
            className="w-full flex items-center justify-center gap-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl py-3 text-sm font-bold transition-colors"
          >
            <Trophy size={16} /> Generate Champions Card (JPG)
          </button>
        </div>
      </div>

      {showCardGenerator && (
        <ScheduleCardGenerator
          scheduleName={state.settings.scheduleName}
          defaultVenue={state.settings.venue}
          defaultDate={state.settings.date}
          defaultStartTime={state.settings.startTime}
          defaultEndTime={state.settings.endTime}
          onClose={() => setShowCardGenerator(false)}
        />
      )}

      {showChampionsCard && (
        <ChampionsCardGenerator
          tournamentName={state.settings.scheduleName}
          defaultDate={state.settings.date}
          onClose={() => setShowChampionsCard(false)}
        />
      )}
    </div>
  );
}

import { ScheduleCardGenerator } from "@/components/ScheduleCardGenerator";
import { ChampionsCardGenerator } from "@/components/ChampionsCardGenerator";

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
    "Teams" | "Matches" | "Standings" | "VIS Stats" | "Settings"
  >("Teams");
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
        <div className="bg-amber-600/90 text-white text-xs py-2 px-4 flex items-center justify-center gap-3">
          <span>{syncError}</span>
          <button
            onClick={() => setState({ ...state })}
            className="underline font-bold hover:no-underline flex-shrink-0"
          >
            Retry
          </button>
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

      {/* Status strip — at-a-glance tournament state (patterned after reference UI) */}
      {defaultView !== "players" && (() => {
        const teamCount = state.teams.length;
        const poolTotal = state.poolMatches.length;
        const poolDone = state.poolMatches.filter((m) => m.isFinal || (m.scoreA !== null && m.scoreB !== null)).length;
        const poTotal = state.playoffGames.length;
        const poDone = state.playoffGames.filter((g) => g.isFinal || (g.scoreA !== null && g.scoreB !== null)).length;
        const fmtLabel =
          state.settings.formatType === "pool2" ? "Top 2 Pool-Play"
          : state.settings.useDEBracket ? "Double Elimination"
          : "Bracket Auto-fit";
        const chip = "flex items-center gap-1.5 text-[rgb(var(--muted-fg))]";
        return (
          <div className="glass border-b border-[rgb(var(--border-soft))] py-2 px-4 sm:px-6 flex flex-wrap gap-x-5 gap-y-1.5 items-center text-[11px] font-bold">
            <span className={chip}><Users size={12} /> {teamCount} Teams Registered</span>
            <span className={chip}><Calendar size={12} /> {poolDone}/{poolTotal} Pool Matches Completed</span>
            <span className={chip}><Trophy size={12} /> {poDone}/{poTotal} Playoff Matches Resolved</span>
            <span className="flex-1" />
            <span className="px-2 py-0.5 rounded border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]">
              Rules: {state.settings.maxScore ?? "—"} points{state.settings.leadScore ? ` | Win by ${state.settings.leadScore}` : ""}
            </span>
            <span className="px-2 py-0.5 rounded border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]">
              Format: {fmtLabel}
            </span>
          </div>
        );
      })()}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {defaultView === "players" ? (
          <LiveIntroSplash>
            <LiveView state={state} lastUpdated={lastUpdated} />
          </LiveIntroSplash>
        ) : (
          <>
            <div className="flex gap-1 mb-6 glass border border-[rgb(var(--border-soft))] shadow-sm rounded-xl p-1.5 overflow-x-auto sticky top-0 z-30">
              {(
                [
                  { id: "Teams", label: "Teams", icon: Users },
                  { id: "Matches", label: "Matches", icon: Calendar },
                  { id: "Standings", label: "Standings", icon: TrendingUp },
                  { id: "VIS Stats", label: "VIS Stats", icon: BarChart3 },
                  { id: "Settings", label: "Settings", icon: SettingsIcon },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                // Live count badges (patterned after the reference screens).
                const badge =
                  t.id === "Teams" && state.teams.length > 0
                    ? String(state.teams.length)
                    : t.id === "Matches" && state.poolMatches.length > 0
                    ? `${state.poolMatches.filter((m) => !m.isFinal && (m.scoreA === null || m.scoreB === null)).length} left`
                    : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold tracking-normal whitespace-nowrap transition-colors",
                      active
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))]",
                    )}
                  >
                    <Icon size={15} />
                    <span className="hidden sm:inline">{t.label}</span>
                    {badge && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[10px] rounded-full font-bold",
                          active ? "bg-white text-blue-700" : "bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))]",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {tab === "Teams" && <TeamsTab state={state} setState={setState} />}
            {tab === "Matches" && (
              <MatchesTab state={state} setState={setState} tournamentId={tournamentId} />
            )}
            {tab === "Standings" && <LeaderboardTab state={state} />}
            {tab === "VIS Stats" && <VISStatsTab state={state} tournamentId={tournamentId} />}
            {tab === "Settings" && (
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
