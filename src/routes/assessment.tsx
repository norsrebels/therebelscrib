import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth-client";
import {
  getPlayers,
  getPlayerWithAssessment,
  createPlayer,
  saveAssessment,
  getPublicSettings,
} from "../server/assessment.functions";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { ToastBar } from "@/components/Modals";

export const Route = createFileRoute("/assessment")({
  validateSearch: (search: Record<string, unknown>) => ({
    playerId:
      typeof search.playerId === "number"
        ? search.playerId
        : typeof search.playerId === "string"
          ? parseInt(search.playerId)
          : undefined,
  }),
  loaderDeps: ({ search }) => ({ playerId: search.playerId }),
  loader: async ({ deps: { playerId } }) => {
    const players = await getPlayers();
    let selectedData = null;
    if (playerId) {
      selectedData = await getPlayerWithAssessment({ data: playerId });
    }
    let settingsData = null;
    try {
      settingsData = await getPublicSettings({ data: { key: "matrices" } });
    } catch {}
    return { players, selectedData, playerId, settingsData };
  },
  component: AssessmentPage,
});

function calculateLevel(score: number): string {
  if (score >= 275) return "Advanced";
  if (score >= 250) return "Competitive";
  if (score >= 200) return "Intermediate";
  if (score >= 150) return "Formative";
  return "Developmental";
}

function getScoreColorClass(score: number) {
  if (score === 0)
    return "bg-[rgb(var(--surface-hover))] text-[rgb(var(--fg))]";
  if (score <= 3)
    return "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30";
  if (score <= 6)
    return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30";
  return "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30";
}

function AssessmentForm({
  playerId,
  selectedData,
  settingsData,
  isAdmin,
  showToast,
}: {
  playerId: number;
  selectedData: any;
  settingsData: any;
  isAdmin: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const dynamicCategories = settingsData?.value?.categories || [
    {
      id: "technical",
      title: "Technical Skills",
      criteria: [
        { id: "serving", label: "Serving", maxScore: 10 },
        { id: "passing", label: "Passing", maxScore: 10 },
        { id: "setting", label: "Setting", maxScore: 10 },
        { id: "attacking", label: "Attacking", maxScore: 10 },
        { id: "blocking", label: "Blocking", maxScore: 10 },
      ],
    },
    {
      id: "tactical",
      title: "Tactical & Mental",
      criteria: [
        { id: "gameIq", label: "Game IQ", maxScore: 10 },
        { id: "communication", label: "Communication", maxScore: 10 },
      ],
    },
  ];

  const CRITERIA_LABELS_DYNAMIC = dynamicCategories.reduce(
    (acc: any, cat: any) => {
      cat.criteria.forEach((c: any) => (acc[c.id] = c.label));
      return acc;
    },
    {},
  );

  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedData?.assessment) {
      const initialScores: Record<string, number> = {};
      const assessmentData = selectedData.assessment as any;
      const scoresData = assessmentData.scores || {};

      Object.keys(CRITERIA_LABELS_DYNAMIC).forEach((key) => {
        const hasJsonb = Object.keys(scoresData).length > 0;
        initialScores[key] = hasJsonb
          ? (scoresData[key] ?? 0)
          : (assessmentData[key] ?? 0);
      });
      setScores(initialScores);
    } else {
      const emptyScores: Record<string, number> = {};
      Object.keys(CRITERIA_LABELS_DYNAMIC).forEach(
        (key) => (emptyScores[key] = 0),
      );
      setScores(emptyScores);
    }
  }, [selectedData]);

  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, score) => sum + score, 0);
  }, [scores]);

  const currentLevel = calculateLevel(totalScore);

  const handleScoreChange = (key: string, value: number) => {
    if (!isAdmin) return;
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isAdmin || !playerId) return;
    setIsSaving(true);
    try {
      await saveAssessment({
        data: {
          playerId,
          assessment: scores as any,
          overallScore: totalScore,
          playerLevel: currentLevel,
        },
      });
      showToast("Assessment saved successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to save assessment.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyScores = Object.values(scores).some((v) => v > 0);

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-8">
        <div className="bg-[rgb(var(--surface-hover))] p-4 rounded-xl border border-[rgb(var(--border-soft))]">
          <div className="text-[rgb(var(--muted-fg))] text-xs font-bold uppercase tracking-wider mb-1">
            Total Score
          </div>
          <div className="text-4xl font-black font-mono text-[rgb(var(--fg))]">
            {totalScore}{" "}
            <span className="text-lg text-[rgb(var(--muted-fg))] font-normal">
              / 300
            </span>
          </div>
          <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            {currentLevel}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-bold"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {!hasAnyScores && (
        <div className="mb-8 p-6 border border-dashed border-blue-500/30 bg-blue-500/5 rounded-2xl text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
            <ClipboardCheck size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-1">Ready for Assessment</h3>
          <p className="text-sm text-[rgb(var(--muted-fg))] max-w-md mx-auto">
            This player hasn't been scored yet.{" "}
            {isAdmin
              ? "Use the scoring buttons below to begin the assessment."
              : "An admin can begin scoring using the matrix below."}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {dynamicCategories.map((cat: any) => (
          <div
            key={cat.id}
            className="glass border border-[rgb(var(--border-soft))] rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="bg-[rgb(var(--surface-hover))] px-4 py-3 border-b border-[rgb(var(--border-soft))]">
              <h3 className="font-bold text-lg">{cat.title}</h3>
            </div>
            <div className="divide-y divide-[rgb(var(--border-soft))]">
              {cat.criteria.map((crit: any) => {
                const key = crit.id;
                const val = scores[key] || 0;
                const maxScore = crit.maxScore || 10;
                const scoreRange = Array.from(
                  { length: maxScore },
                  (_, i) => i + 1,
                );
                return (
                  <div
                    key={key}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[rgb(var(--surface-hover))] transition-colors"
                  >
                    <div className="font-medium text-sm sm:text-base w-full sm:w-1/3 shrink-0">
                      {crit.label}
                    </div>
                    <div className="flex-1 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                      <div className="grid grid-cols-5 sm:flex gap-1.5 sm:gap-2 sm:min-w-max w-full sm:w-auto">
                        {scoreRange.map((num) => (
                          <button
                            key={num}
                            disabled={!isAdmin}
                            onClick={() => handleScoreChange(key, num)}
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                              val === num
                                ? getScoreColorClass(num) +
                                  " ring-2 ring-offset-1 ring-offset-[rgb(var(--bg))] ring-current scale-110 shadow-md"
                                : "bg-[rgb(var(--surface))] text-[rgb(var(--muted-fg))] border border-[rgb(var(--border-soft))] hover:border-[rgb(var(--fg))] hover:text-[rgb(var(--fg))]"
                            } ${!isAdmin && "cursor-not-allowed opacity-80"}`}
                          >
                            {num}
                          </button>
                        ))}
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
  );
}

function PublicPlayerSummary({ selectedData }: { selectedData: any }) {
  const player = selectedData?.player;
  if (!player) return null;
  return (
    <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-8 text-center space-y-4">
      <div className="text-5xl font-black font-mono text-blue-500">
        {player.overallScore || "—"}
      </div>
      <div className="text-[rgb(var(--muted-fg))] text-sm">Overall Score</div>
      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
        {player.playerLevel}
      </span>
    </div>
  );
}

function AssessmentPage() {
  const { players, selectedData, playerId, settingsData } =
    Route.useLoaderData() as any;
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePlayer = async () => {
    if (!newNickname.trim()) return;
    setIsCreating(true);
    try {
      const newPlayer = await createPlayer({
        data: {
          nickname: newNickname,
          position: newPosition,
          overallScore: 0,
          playerLevel: "Developmental",
        },
      });
      setShowNewPlayer(false);
      setNewNickname("");
      setNewPosition("");
      navigate({ search: { playerId: newPlayer.id } as any });
    } catch (e) {
      console.error(e);
      showToast("Failed to create player", "error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Assessment Matrix
          </h2>
          <p className="text-sm text-[rgb(var(--muted-fg))]">
            Score players across multiple skill categories
          </p>
        </div>
        <Link
          to="/player-dex"
          className="text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
        >
          Back to Player Dex
        </Link>
      </div>

      <div className="mb-8 p-6 glass border border-[rgb(var(--border-soft))] rounded-2xl shadow-sm">
        <div className="w-full">
          <label className="block text-sm font-bold mb-2 text-[rgb(var(--muted-fg))]">
            Select Player
          </label>
          {!showNewPlayer ? (
            <div className="flex gap-2">
              <select
                className="flex-1 bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm"
                value={playerId || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  navigate({
                    search: { playerId: val || undefined } as any,
                  });
                }}
              >
                <option value="">-- Choose a player --</option>
                {players.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname} {p.position ? `(${p.position})` : ""}
                  </option>
                ))}
              </select>
              {isAdmin && (
                <button
                  onClick={() => setShowNewPlayer(true)}
                  className="px-4 py-2 bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] rounded-xl text-sm font-bold hover:bg-[rgb(var(--border-soft))] transition-colors"
                >
                  New
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nickname"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm"
              />
              <input
                type="text"
                placeholder="Position"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePlayer}
                  disabled={isCreating}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => setShowNewPlayer(false)}
                  className="flex-1 bg-[rgb(var(--surface-hover))] rounded-xl py-2 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {playerId ? (
        isAdmin ? (
          <AssessmentForm
            key={playerId}
            playerId={playerId}
            selectedData={selectedData}
            settingsData={settingsData}
            isAdmin={isAdmin}
            showToast={showToast}
          />
        ) : (
          <PublicPlayerSummary selectedData={selectedData} />
        )
      ) : (
        <div className="text-center py-20 text-[rgb(var(--muted-fg))] border border-dashed border-[rgb(var(--border-soft))] rounded-2xl">
          Select a player to begin assessment
        </div>
      )}

      <ToastBar toast={toast} />
    </main>
  );
}
