import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadState,
  saveState,
  isGameComplete,
  type TournamentState,
  defaultState,
} from "@/lib/tournament";
import { Maximize, Minimize, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/scoreboard/$tournamentId" as any)({
  component: ScoreboardPage,
});

function ScoreboardPage() {
  const { tournamentId } = Route.useParams();
  const cacheKey = `rebels_tournament_v2_${tournamentId}`;
  const [state, setStateRaw] = useState<TournamentState>(defaultState);
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = loadState(cacheKey);
    setStateRaw(local);
    setMounted(true);

    const fetchRemote = async () => {
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
          }
        }
      } catch {}
    };
    fetchRemote();
    const interval = setInterval(fetchRemote, 3000);
    return () => clearInterval(interval);
  }, [cacheKey, tournamentId]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const allGames: {
    id: string;
    label: string;
    teamAName: string;
    teamBName: string;
    scoreA: number | null;
    scoreB: number | null;
    isComplete: boolean;
    type: "pool" | "playoff";
  }[] = [];

  state.poolMatches.forEach((m) => {
    const tA = state.teams.find((t) => t.id === m.teamAId);
    const tB = state.teams.find((t) => t.id === m.teamBId);
    allGames.push({
      id: m.id,
      label: `Pool ${m.pool} · G${m.gameNum}`,
      teamAName: tA?.name ?? "TBD",
      teamBName: tB?.name ?? "TBD",
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      isComplete: isGameComplete(m, state.settings.maxScore, state.settings.leadScore),
      type: "pool",
    });
  });

  state.playoffGames.forEach((g) => {
    const tA = g.teamAId
      ? state.teams.find((t) => t.id === g.teamAId)
      : null;
    const tB = g.teamBId
      ? state.teams.find((t) => t.id === g.teamBId)
      : null;
    allGames.push({
      id: g.slot,
      label: g.label,
      teamAName: tA?.name ?? g.teamALabel,
      teamBName: tB?.name ?? g.teamBLabel,
      scoreA: g.scoreA,
      scoreB: g.scoreB,
      isComplete: isGameComplete(g, state.settings.maxScore, state.settings.leadScore),
      type: "playoff",
    });
  });

  const activeGame = activeGameId
    ? allGames.find((g) => g.id === activeGameId)
    : allGames.find((g) => !g.isComplete && (g.scoreA !== null || g.scoreB !== null)) ||
      allGames.find((g) => !g.isComplete) ||
      allGames[0];

  const updateScore = async (
    gameId: string,
    side: "A" | "B",
    delta: number,
  ) => {
    const poolMatch = state.poolMatches.find((m) => m.id === gameId);
    if (poolMatch) {
      const key = side === "A" ? "scoreA" : "scoreB";
      const current = poolMatch[key] ?? 0;
      const next = Math.max(0, current + delta);
      const updated = {
        ...state,
        poolMatches: state.poolMatches.map((m) =>
          m.id === gameId ? { ...m, [key]: next } : m,
        ),
      };
      setStateRaw(updated);
      saveState(updated, cacheKey);
      try {
        await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } catch {}
      return;
    }
    const playoffGame = state.playoffGames.find((g) => g.slot === gameId);
    if (playoffGame) {
      const key = side === "A" ? "scoreA" : "scoreB";
      const current = playoffGame[key] ?? 0;
      const next = Math.max(0, current + delta);
      const updated = {
        ...state,
        playoffGames: state.playoffGames.map((g) =>
          g.slot === gameId ? { ...g, [key]: next } : g,
        ),
      };
      setStateRaw(updated);
      saveState(updated, cacheKey);
      try {
        await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } catch {}
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black text-white flex flex-col select-none"
      style={{ cursor: "default" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-[2vw] py-[1vh] bg-zinc-900/80 border-b border-zinc-700">
        <div className="flex items-center gap-[1.5vw]">
          <img
            src="/logo.png"
            alt="Rebels"
            className="h-[4vh] w-[4vh] rounded-lg object-cover"
          />
          <span className="font-bold text-[2vh] tracking-tight">
            {state.settings.scheduleName || "Live Scoreboard"}
          </span>
        </div>
        <div className="flex items-center gap-[1.5vw]">
          {/* Game selector */}
          <select
            className="bg-zinc-800 border border-zinc-600 rounded-lg px-[1vw] py-[0.5vh] text-[1.8vh] font-medium"
            value={activeGame?.id || ""}
            onChange={(e) => setActiveGameId(e.target.value || null)}
          >
            {allGames.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}: {g.teamAName} vs {g.teamBName}{" "}
                {g.isComplete ? "(Done)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={toggleFullscreen}
            className="p-[1vh] rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* Main scoreboard */}
      {activeGame ? (
        <div className="flex-1 flex flex-col items-center justify-center px-[4vw] py-[2vh]">
          <div className="text-[2.5vh] font-bold text-amber-400 tracking-widest uppercase mb-[2vh]">
            {activeGame.label}
          </div>

          <div className="w-full max-w-[90vw] flex items-stretch justify-center gap-[3vw]">
            {/* Team A */}
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/60 rounded-[2vh] border border-zinc-700 p-[3vh]">
              <div className="text-[4vh] sm:text-[5vh] font-black tracking-tight text-center leading-tight mb-[2vh] line-clamp-2">
                {activeGame.teamAName}
              </div>
              <div className="text-[15vh] sm:text-[20vh] font-black font-mono leading-none text-amber-400 tabular-nums">
                {activeGame.scoreA ?? 0}
              </div>
              <div className="flex items-center gap-[2vw] mt-[3vh]">
                <button
                  onClick={() => updateScore(activeGame.id, "A", -1)}
                  className="w-[8vh] h-[8vh] rounded-full bg-red-600/80 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Minus size={32} strokeWidth={3} />
                </button>
                <button
                  onClick={() => updateScore(activeGame.id, "A", 1)}
                  className="w-[10vh] h-[10vh] rounded-full bg-green-600/80 hover:bg-green-500 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Plus size={40} strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-[3vh] font-bold text-zinc-500 tracking-widest">
                VS
              </div>
              {activeGame.isComplete && (
                <div className="mt-[1vh] px-[2vw] py-[0.5vh] bg-amber-500/20 text-amber-400 rounded-full text-[1.8vh] font-bold tracking-wider">
                  FINAL
                </div>
              )}
            </div>

            {/* Team B */}
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/60 rounded-[2vh] border border-zinc-700 p-[3vh]">
              <div className="text-[4vh] sm:text-[5vh] font-black tracking-tight text-center leading-tight mb-[2vh] line-clamp-2">
                {activeGame.teamBName}
              </div>
              <div className="text-[15vh] sm:text-[20vh] font-black font-mono leading-none text-amber-400 tabular-nums">
                {activeGame.scoreB ?? 0}
              </div>
              <div className="flex items-center gap-[2vw] mt-[3vh]">
                <button
                  onClick={() => updateScore(activeGame.id, "B", -1)}
                  className="w-[8vh] h-[8vh] rounded-full bg-red-600/80 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Minus size={32} strokeWidth={3} />
                </button>
                <button
                  onClick={() => updateScore(activeGame.id, "B", 1)}
                  className="w-[10vh] h-[10vh] rounded-full bg-green-600/80 hover:bg-green-500 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Plus size={40} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>

          {state.settings.maxScore && (
            <div className="mt-[3vh] text-[1.8vh] text-zinc-500 font-medium">
              Playing to {state.settings.maxScore}
              {state.settings.leadScore
                ? ` · Win by ${state.settings.leadScore}`
                : ""}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-[3vh]">
          No games available
        </div>
      )}
    </div>
  );
}
