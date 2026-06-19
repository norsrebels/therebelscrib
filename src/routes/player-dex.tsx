import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-client";
import { getPlayers, updatePlayer, deletePlayer } from "../server/assessment.functions";
import { Search, RefreshCw, LayoutGrid, List, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { uploadPlayerImage } from "../server/player.functions";
import { useRef } from "react";
import { ConfirmationModal, ToastBar } from "@/components/Modals";
import { useToast } from "@/lib/use-toast";

export const Route = createFileRoute("/player-dex")({
  loader: async () => {
    const players = await getPlayers();
    return { players };
  },
  component: PlayerDexPage,
});

const LEVELS = [
  "All Levels",
  "Developmental",
  "Formative",
  "Intermediate",
  "Competitive",
  "Advanced",
];

const AVATAR_COLORS = [
  "from-blue-500 to-blue-600",
  "from-purple-500 to-purple-600",
  "from-green-500 to-green-600",
  "from-orange-500 to-orange-600",
  "from-pink-500 to-pink-600",
  "from-teal-500 to-teal-600",
  "from-red-500 to-red-600",
  "from-indigo-500 to-indigo-600",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getLevelColor(level: string) {
  switch (level) {
    case "Advanced":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "Competitive":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "Intermediate":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Formative":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}


function PlayerDexGalleryCard({ player, isAdmin, onEdit, onDelete, router, showToast }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAdmin) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await uploadPlayerImage({ data: formData });
      if (res.success && res.url) {
        await updatePlayer({ data: { id: player.id, updates: { profilePicture: res.url } } });
        router.invalidate();
        showToast("Profile picture updated", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to upload image", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-5 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative">
      {isAdmin && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
            title="Edit player"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-red-500 transition-colors"
            title="Delete player"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
      
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full shrink-0 group/avatar cursor-pointer" onClick={() => isAdmin && fileInputRef.current?.click()}>
        {player.profilePicture ? (
          <img src={player.profilePicture} alt={player.nickname} className="w-full h-full object-cover rounded-full shadow-md group-hover:scale-105 transition-transform" />
        ) : (
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${getAvatarColor(player.nickname)} flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md group-hover:scale-105 transition-transform`}>
            {player.nickname.charAt(0).toUpperCase()}
          </div>
        )}
        
        {isAdmin && (
          <div className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
             {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={20} />}
          </div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
      </div>

      <Link
        to="/assessment"
        search={{ playerId: player.id }}
        className="flex flex-col items-center text-center gap-3 w-full"
      >
        <div className="min-w-0 w-full">
          {player.jerseyNumber && (
            <div className="text-xs font-mono font-bold text-[rgb(var(--muted-fg))] mb-0.5">#{player.jerseyNumber}</div>
          )}
          <div className="font-semibold text-sm truncate">{player.nickname}</div>
          <div className="text-xs text-[rgb(var(--muted-fg))] truncate">{player.position || "No position"}</div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${player.playerLevel === "Developmental" && player.overallScore === 0 ? "bg-gray-500/10 text-gray-500 border-gray-500/20" : getLevelColor(player.playerLevel)}`}>
          {player.playerLevel === "Developmental" && player.overallScore === 0 ? "Unassessed" : player.playerLevel}
        </span>
        {player.overallScore === 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] border border-[rgb(var(--border-soft))]">
            Not assessed
          </span>
        ) : (
          <div className="font-mono text-lg font-bold text-blue-500">{player.overallScore}</div>
        )}
      </Link>
    </div>
  );
}

function PlayerDexPage() {
  const { players: initialPlayers } = Route.useLoaderData();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("All Levels");
  const [players, setPlayers] = useState(initialPlayers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [editPlayer, setEditPlayer] = useState<{ id: number; nickname: string; position: string; jerseyNumber: number | null } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; nickname: string } | null>(null);

  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getPlayers();
        setPlayers(fresh);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await getPlayers();
      setPlayers(fresh);
    } catch {}
    setIsRefreshing(false);
  };

  const handleEditSave = async () => {
    if (!editPlayer) return;
    try {
      await updatePlayer({
        data: { id: editPlayer.id, updates: { nickname: editPlayer.nickname, position: editPlayer.position, jerseyNumber: editPlayer.jerseyNumber } },
      });
      setEditPlayer(null);
      router.invalidate();
      showToast("Player updated", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to update player", "error");
    }
  };

  const handleDeletePlayer = async () => {
    if (!deleteConfirm) return;
    try {
      await deletePlayer({ data: deleteConfirm.id });
      setDeleteConfirm(null);
      router.invalidate();
      showToast("Player deleted", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete player", "error");
    }
  };

  const filteredPlayers = players.filter((p: any) => {
    const matchesSearch = p.nickname
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesLevel =
      filterLevel === "All Levels" || p.playerLevel === filterLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {deleteConfirm && (
        <ConfirmationModal
          title="Delete Player"
          message={`Are you sure you want to delete "${deleteConfirm.nickname}"? This will also delete all their assessment data. This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeletePlayer}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {editPlayer && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold tracking-tight mb-4">Edit Player</h3>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Nickname"
                value={editPlayer.nickname}
                onChange={(e) => setEditPlayer({ ...editPlayer, nickname: e.target.value })}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-3">
                <input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="Jersey #"
                  value={editPlayer.jerseyNumber ?? ''}
                  onChange={(e) => setEditPlayer({ ...editPlayer, jerseyNumber: parseInt(e.target.value) || null })}
                  className="w-24 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 text-center font-bold"
                />
                <select
                  value={editPlayer.position}
                  onChange={(e) => setEditPlayer({ ...editPlayer, position: e.target.value })}
                  className="flex-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Position...</option>
                  <option value="OS">Open Spiker</option>
                  <option value="OPP">Opposite Spiker</option>
                  <option value="MB">Middle Blocker</option>
                  <option value="S">Setter</option>
                  <option value="L">Libero</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditPlayer(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editPlayer.nickname.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Player Dex</h2>
          <p className="text-[rgb(var(--muted-fg))]">
            Browse and search the Rebels community players
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border border-[rgb(var(--border-soft))] text-[rgb(var(--fg))] px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-[rgb(var(--surface-hover))] transition-colors"
              >
                <RefreshCw
                  size={16}
                  className={isRefreshing ? "animate-spin" : ""}
                />
              </button>
              <Link
                to="/assessment"
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                + Add Player
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="glass border border-[rgb(var(--border-soft))] rounded-xl p-4 sm:p-6 mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by nickname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted-fg))] focus:border-[rgb(var(--fg))] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <div className="sm:w-48">
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm text-[rgb(var(--fg))] focus:border-[rgb(var(--fg))] focus:outline-none transition-colors appearance-none"
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-[rgb(var(--surface-hover))] text-[rgb(var(--fg))]"
                    : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("gallery")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "gallery"
                    ? "bg-[rgb(var(--surface-hover))] text-[rgb(var(--fg))]"
                    : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
                }`}
                title="Gallery view"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="glass border border-[rgb(var(--border-soft))] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[rgb(var(--surface-hover))] border-b border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Nickname</th>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4 text-center">Overall Score</th>
                  <th className="px-6 py-4">Level</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-soft))]">
                {filteredPlayers.length > 0 ? (
                  filteredPlayers.map((player: any) => (
                    <tr
                      key={player.id}
                      className="hover:bg-[rgb(var(--surface-hover))] transition-colors"
                    >
                      <td className="px-6 py-4 text-center font-mono font-bold text-[rgb(var(--muted-fg))]">
                        {player.jerseyNumber ?? '—'}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {player.nickname}
                      </td>
                      <td className="px-6 py-4 text-[rgb(var(--muted-fg))]">
                        {player.position || "-"}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-blue-500">
                        {player.overallScore === 0 ? "—" : player.overallScore}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getLevelColor(player.playerLevel)}`}
                        >
                          {player.playerLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setEditPlayer({ id: player.id, nickname: player.nickname, position: player.position || "", jerseyNumber: (player as any).jerseyNumber ?? null })}
                                className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                                title="Edit player"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ id: player.id, nickname: player.nickname })}
                                className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                title="Delete player"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          <Link
                            to="/assessment"
                            search={{ playerId: player.id }}
                            className="text-xs font-semibold text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                          >
                            View Matrix
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-[rgb(var(--muted-fg))]"
                    >
                      No players found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player: any) => (
              <PlayerDexGalleryCard
                key={player.id}
                player={player}
                isAdmin={isAdmin}
                onEdit={() => setEditPlayer({ id: player.id, nickname: player.nickname, position: player.position || "", jerseyNumber: (player as any).jerseyNumber ?? null })}
                onDelete={() => setDeleteConfirm({ id: player.id, nickname: player.nickname })}
                router={router}
                showToast={showToast}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-16 text-[rgb(var(--muted-fg))] border border-dashed border-[rgb(var(--border-soft))] rounded-2xl">
              No players found matching your criteria.
            </div>
          )}
        </div>
      )}
      <ToastBar toast={toast} />
    </main>
  );
}
