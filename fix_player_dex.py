import re

with open('src/routes/player-dex.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace('import { Search, RefreshCw, LayoutGrid, List, Pencil, Trash2 } from "lucide-react";',
'''import { Search, RefreshCw, LayoutGrid, List, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { uploadPlayerImage } from "../server/player.functions";
import { useRef } from "react";''')

# Create the PlayerDexGalleryCard component
card_comp = '''
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
'''

content = content.replace('function PlayerDexPage() {', card_comp + '\nfunction PlayerDexPage() {')

# Replace the gallery block
old_gallery = '''              <div
                key={player.id}
                className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-5 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative"
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditPlayer({ id: player.id, nickname: player.nickname, position: player.position || "" })}
                      className="p-1.5 rounded-lg bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                      title="Edit player"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: player.id, nickname: player.nickname })}
                      className="p-1.5 rounded-lg bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-red-500 transition-colors"
                      title="Delete player"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                <Link
                  to="/assessment"
                  search={{ playerId: player.id }}
                  className="flex flex-col items-center text-center gap-3 w-full"
                >
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${getAvatarColor(player.nickname)} flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md group-hover:scale-105 transition-transform`}
                  >
                    {player.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="font-semibold text-sm truncate">
                      {player.nickname}
                    </div>
                    <div className="text-xs text-[rgb(var(--muted-fg))] truncate">
                      {player.position || "No position"}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      player.playerLevel === "Developmental" && player.overallScore === 0
                        ? "bg-gray-500/10 text-gray-500 border-gray-500/20"
                        : getLevelColor(player.playerLevel)
                    }`}
                  >
                    {player.playerLevel === "Developmental" && player.overallScore === 0
                      ? "Unassessed"
                      : player.playerLevel}
                  </span>
                  {player.overallScore === 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] border border-[rgb(var(--border-soft))]">
                      Not assessed
                    </span>
                  ) : (
                    <div className="font-mono text-lg font-bold text-blue-500">
                      {player.overallScore}
                    </div>
                  )}
                </Link>
              </div>'''

new_gallery = '''              <PlayerDexGalleryCard
                key={player.id}
                player={player}
                isAdmin={isAdmin}
                onEdit={() => setEditPlayer({ id: player.id, nickname: player.nickname, position: player.position || "" })}
                onDelete={() => setDeleteConfirm({ id: player.id, nickname: player.nickname })}
                router={router}
                showToast={showToast}
              />'''

content = content.replace(old_gallery, new_gallery)

with open('src/routes/player-dex.tsx', 'w') as f:
    f.write(content)

print("Done")
