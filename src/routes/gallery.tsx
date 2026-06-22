import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Share2,
  Check,
  Loader2,
  Download,
  Trash2,
  Facebook,
  Instagram,
  Mail,
  FolderPlus,
  Folder,
  ArrowLeft,
  Grid3x3,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  getGalleryImages,
  uploadGalleryImage,
  deleteGalleryImage,
} from "../server/gallery.functions";
import {
  getAlbums,
  createAlbum,
  deleteAlbum,
  addImageToAlbum,
  getAlbumImages,
  updateAlbum,
} from "../server/album.functions";
import { getAllSiteSettings } from "../server/site-settings.functions";
import { PhotoEngagement } from "@/components/PhotoEngagement";
import { useAuth } from "@/lib/auth-client";
import { ConfirmationModal, ToastBar } from "@/components/Modals";
import { useToast } from "@/lib/use-toast";

export const Route = createFileRoute("/gallery")({
  validateSearch: (search: Record<string, unknown>) => ({
    admin: search.admin === "true" || search.admin === true,
    albumId:
      typeof search.albumId === "number"
        ? search.albumId
        : typeof search.albumId === "string"
          ? parseInt(search.albumId)
          : undefined,
  }),
  loader: async () => {
    const [uploadedImages, albumsList, siteSettingsMap] = await Promise.all([
      getGalleryImages(),
      getAlbums(),
      getAllSiteSettings().catch(() => ({} as Record<string, string>)),
    ]);
    return { uploadedImages, albumsList, siteSettingsMap };
  },
  component: GalleryPage,
});

function GalleryPage() {
  const { uploadedImages, albumsList, siteSettingsMap } =
    Route.useLoaderData();
  const { albumId } = Route.useSearch();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { toast, showToast } = useToast();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"small" | "medium" | "list">("small");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteAlbumConfirm, setDeleteAlbumConfirm] = useState<number | null>(
    null,
  );
  const [deleteImageConfirm, setDeleteImageConfirm] = useState<string | null>(null);
  const [albumImagesData, setAlbumImagesData] = useState<any[]>([]);
  const [loadingAlbumImages, setLoadingAlbumImages] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [showUploadPicker, setShowUploadPicker] = useState(false);
  const [pendingAlbumId, setPendingAlbumId] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    id: string; url: string; alt: string; caption: string
  } | null>(null);
  const [moveAlbumId, setMoveAlbumId] = useState<number | ''>('');

  const socialLinks = {
    facebookUrl: siteSettingsMap.facebookUrl || "",
    instagramUrl: siteSettingsMap.instagramUrl || "",
    contactUrl: siteSettingsMap.contactUrl || "",
  };

  useEffect(() => {
    if (albumId) {
      setLoadingAlbumImages(true);
      getAlbumImages({ data: { albumId } })
        .then(setAlbumImagesData)
        .catch(() => setAlbumImagesData([]))
        .finally(() => setLoadingAlbumImages(false));
    }
  }, [albumId]);

  const customImages = uploadedImages.map((img: any) => ({
    src: img.url,
    alt: img.alt,
    caption: img.caption,
    id: img.id,
  }));

  const handleDelete = async (imageId: string) => {
    setIsDeleting(imageId);
    try {
      await deleteGalleryImage({ data: imageId });
      if (lightboxIndex !== null) closeLightbox();
      router.invalidate();
      showToast("Image deleted", "success");
    } catch (err) {
      console.error("Failed to delete image:", err);
      showToast("Failed to delete image", "error");
    } finally {
      setIsDeleting(null);
    }
  };

  const GALLERY_DATA = albumId
    ? albumImagesData.map((img: any) => ({
        src: img.imageUrl,
        alt: img.alt,
        caption: img.caption,
        id: img.imageId,
      }))
    : customImages;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    document.body.style.overflow = "auto";
  };

  const showNext = useCallback(() => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % GALLERY_DATA.length);
    }
  }, [lightboxIndex, GALLERY_DATA.length]);

  const showPrev = useCallback(() => {
    if (lightboxIndex !== null) {
      setLightboxIndex(
        (lightboxIndex - 1 + GALLERY_DATA.length) % GALLERY_DATA.length,
      );
    }
  }, [lightboxIndex, GALLERY_DATA.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") showNext();
      if (e.key === "ArrowLeft") showPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, showNext, showPrev]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (src: string, filename: string) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "image";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  // Netlify Functions cap the request body at ~6MB; multipart/base64 overhead
  // means a safe per-file ceiling is ~4.5MB. Oversize files are skipped and
  // reported instead of failing with an opaque function error.
  const MAX_FILE_BYTES = 4.5 * 1024 * 1024;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const targetAlbumId = albumId || pendingAlbumId;
    const album = targetAlbumId
      ? albumsList.find((a: any) => a.id === targetAlbumId)
      : null;
    let albumNeedsCover = !!album && !album.coverImageUrl;

    setIsUploading(true);
    setUploadProgress({ done: 0, total: files.length });

    let succeeded = 0;
    const failed: string[] = [];

    try {
      // Sequential on purpose: uploadGalleryImage does a read-modify-write on a
      // single shared metadata blob, so parallel uploads would race and drop
      // entries (last-write-wins). One at a time keeps every photo's metadata.
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          console.warn("Skipping oversize file:", file.name, file.size);
          failed.push(file.name);
          setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
          continue;
        }
        try {
          const formData = new FormData();
          formData.append("image", file);
          formData.append("alt", file.name);
          formData.append("caption", "Uploaded by admin");
          const result = await uploadGalleryImage({ data: formData });

          if (targetAlbumId && result?.image) {
            await addImageToAlbum({
              data: {
                albumId: targetAlbumId,
                imageId: result.image.id,
                imageUrl: result.image.url,
                alt: file.name,
                caption: "Uploaded by admin",
              },
            });
            if (albumNeedsCover) {
              await updateAlbum({
                data: { albumId: targetAlbumId, coverImageUrl: result.image.url },
              });
              albumNeedsCover = false;
            }
          }
          succeeded += 1;
        } catch (err) {
          console.error("Failed to upload image:", file.name, err);
          failed.push(file.name);
        } finally {
          setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
        }
      }

      if (albumId) {
        const imgs = await getAlbumImages({ data: { albumId } }).catch(() => null);
        if (imgs) setAlbumImagesData(imgs);
      }

      if (failed.length === 0) {
        showToast(
          succeeded === 1 ? "Photo uploaded" : `${succeeded} photos uploaded`,
          "success",
        );
      } else if (succeeded === 0) {
        showToast(
          files.length === 1
            ? "Failed to upload photo"
            : `All ${failed.length} uploads failed`,
          "error",
        );
      } else {
        showToast(`Uploaded ${succeeded}, ${failed.length} failed`, "error");
      }
    } finally {
      setPendingAlbumId(null);
      router.invalidate();
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;
    setShowNewAlbumModal(false);
    try {
      await createAlbum({ data: { name: newAlbumName.trim() } });
      setNewAlbumName("");
      router.invalidate();
      showToast("Album created", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to create album", "error");
    }
  };

  const handleDeleteAlbum = async (id: number) => {
    setDeleteAlbumConfirm(null);
    try {
      await deleteAlbum({ data: { albumId: id } });
      router.invalidate();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete album", "error");
    }
  };

  const handleMoveToAlbum = async () => {
    if (!moveTarget || !moveAlbumId) return;
    try {
      await addImageToAlbum({
        data: {
          albumId: moveAlbumId as number,
          imageId: moveTarget.id,
          imageUrl: moveTarget.url,
          alt: moveTarget.alt,
          caption: moveTarget.caption,
        },
      });
      const album = albumsList.find((a: any) => a.id === moveAlbumId);
      if (album && !album.coverImageUrl) {
        await updateAlbum({ data: { albumId: moveAlbumId as number, coverImageUrl: moveTarget.url } });
      }
      router.invalidate();
      showToast("Photo added to album", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to move photo", "error");
    } finally {
      setMoveTarget(null);
      setMoveAlbumId('');
    }
  };

  const currentAlbum = albumId
    ? albumsList.find((a: any) => a.id === albumId)
    : null;

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {deleteAlbumConfirm !== null && (
          <ConfirmationModal
            title="Delete Album"
            message="Are you sure you want to delete this album? All image assignments will be removed."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => handleDeleteAlbum(deleteAlbumConfirm)}
            onCancel={() => setDeleteAlbumConfirm(null)}
          />
        )}

        {deleteImageConfirm !== null && (
          <ConfirmationModal
            title="Delete Image"
            message="Delete this image? This cannot be undone."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => {
              handleDelete(deleteImageConfirm);
              setDeleteImageConfirm(null);
            }}
            onCancel={() => setDeleteImageConfirm(null)}
          />
        )}

        {showNewAlbumModal && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold tracking-tight mb-4">New Album</h3>
              <input
                type="text"
                placeholder="Album name"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowNewAlbumModal(false); setNewAlbumName(""); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAlbum}
                  disabled={!newAlbumName.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showUploadPicker && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold tracking-tight mb-4">Choose album (optional)</h3>
              <select
                value={pendingAlbumId ?? ''}
                onChange={(e) => setPendingAlbumId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-blue-500"
              >
                <option value="">No album / All Photos</option>
                {albumsList.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowUploadPicker(false); setPendingAlbumId(null); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowUploadPicker(false); fileInputRef.current?.click(); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {moveTarget && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold tracking-tight mb-4">Move to album</h3>
              <select
                value={moveAlbumId}
                onChange={(e) => setMoveAlbumId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-blue-500"
              >
                <option value="">Select an album...</option>
                {albumsList.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setMoveTarget(null); setMoveAlbumId(''); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveToAlbum}
                  disabled={!moveAlbumId}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  Move
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 border-b border-[rgb(var(--border-soft))] pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            {currentAlbum ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    router.navigate({ to: "/gallery", search: {} })
                  }
                  className="p-2 rounded-lg hover:bg-[rgb(var(--surface-hover))] transition-colors text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-1">
                    {currentAlbum.name}
                  </h2>
                  <p className="text-[rgb(var(--muted-fg))] text-sm">
                    {albumImagesData.length} photos
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">
                  Game Documentations
                </h2>
                <p className="text-[rgb(var(--muted-fg))] text-sm">
                  Visual tour of the tournament application
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-3 flex-wrap items-center justify-end">
            {socialLinks.facebookUrl && (
              <a
                href={socialLinks.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center p-2.5 border border-[rgb(var(--border-strong))] hover:glass rounded-xl text-[rgb(var(--muted-fg))] hover:text-blue-500 transition-colors"
              >
                <Facebook size={16} />
              </a>
            )}
            {socialLinks.instagramUrl && (
              <a
                href={socialLinks.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center p-2.5 border border-[rgb(var(--border-strong))] hover:glass rounded-xl text-[rgb(var(--muted-fg))] hover:text-pink-500 transition-colors"
              >
                <Instagram size={16} />
              </a>
            )}
            {socialLinks.contactUrl && (
              <a
                href={socialLinks.contactUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-[rgb(var(--border-strong))] hover:glass rounded-xl text-sm font-bold transition-colors text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
              >
                <Mail size={16} />
                <span>Contact Us</span>
              </a>
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 border border-[rgb(var(--border-strong))] hover:glass rounded-xl text-sm font-bold transition-colors"
            >
              {copied ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Share2 size={16} />
              )}
              <span>{copied ? "Copied" : "Share"}</span>
            </button>
            {isAdmin && !albumId && (
              <button
                onClick={() => setShowNewAlbumModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-[rgb(var(--border-strong))] hover:glass rounded-xl text-sm font-bold transition-colors text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
              >
                <FolderPlus size={16} />
                <span>New Album</span>
              </button>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    if (albumId) {
                      fileInputRef.current?.click();
                    } else {
                      setShowUploadPicker(true);
                    }
                  }}
                  disabled={isUploading}
                  className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-xl text-sm font-bold transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {isUploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  <span>
                    {uploadProgress
                      ? `Uploading ${uploadProgress.done}/${uploadProgress.total}`
                      : "Upload"}
                  </span>
                </button>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  ref={fileInputRef}
                />
              </>
            )}
          </div>
        </div>

        {/* Albums Section */}
        {!albumId && albumsList.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-4">
              Albums
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {albumsList.map((album: any) => (
                <div
                  key={album.id}
                  className="group relative aspect-square rounded-xl border border-[rgb(var(--border-soft))] shadow-sm glass overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all cursor-pointer"
                  onClick={() =>
                    router.navigate({
                      to: "/gallery",
                      search: { albumId: album.id },
                    })
                  }
                >
                  {album.coverImageUrl ? (
                    <img
                      src={album.coverImageUrl}
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[rgb(var(--surface-hover))] flex items-center justify-center">
                      <Folder
                        size={48}
                        className="text-[rgb(var(--muted-fg))]"
                      />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="text-white text-sm font-bold truncate">
                      {album.name}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteAlbumConfirm(album.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images grid */}
        {loadingAlbumImages && albumId ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {!albumId && (
              <h3 className="text-sm font-bold text-[rgb(var(--muted-fg))] uppercase tracking-wider mb-4">
                All Photos
              </h3>
            )}
            {GALLERY_DATA.length === 0 ? (
              albumId ? (
                <div className="text-center py-24 border border-dashed border-[rgb(var(--border-soft))] rounded-2xl flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-[rgb(var(--surface-hover))] rounded-full flex items-center justify-center">
                    <Folder size={28} className="text-[rgb(var(--muted-fg))]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">No photos yet</p>
                    <p className="text-[rgb(var(--muted-fg))] text-sm">
                      {isAdmin ? "Upload the first photo to this album." : "This album is empty."}
                    </p>
                  </div>
                  {isAdmin && (
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors">
                      <Upload size={14} /> Upload Photos
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                  )}
                </div>
              ) : (
                <div className="text-center py-24 border border-dashed border-[rgb(var(--border-soft))] rounded-2xl">
                  <p className="text-[rgb(var(--muted-fg))] text-sm">
                    {isAdmin ? "No photos uploaded yet. Click Upload to add the first one." : "No photos have been uploaded yet."}
                  </p>
                </div>
              )
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[rgb(var(--muted-fg))]">{GALLERY_DATA.length} photo{GALLERY_DATA.length === 1 ? "" : "s"}</span>
                  <div className="inline-flex items-center rounded-xl border border-[rgb(var(--border-soft))] p-0.5 gap-0.5">
                    {([["small", Grid3x3, "Small tiles"], ["medium", LayoutGrid, "Medium tiles"], ["list", List, "List view"]] as const).map(([mode, Icon, label]) => (
                      <button key={mode} onClick={() => setViewMode(mode)} title={label} aria-label={label} aria-pressed={viewMode === mode} className={`p-2 rounded-lg transition-colors ${viewMode === mode ? "bg-[rgb(var(--surface-hover))] text-[rgb(var(--fg))]" : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))]"}`}>
                        <Icon size={16} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className={viewMode === "list" ? "flex flex-col gap-2" : viewMode === "small" ? "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"}>
                {GALLERY_DATA.map((image: any, index: number) => {
                const isFirstVisible = index === 0;
                const isInternalApi = image.src.startsWith("/api/");
                const srcset = isInternalApi
                  ? undefined
                  : [
                      `/.netlify/images?url=${encodeURIComponent(image.src)}&w=400&fit=cover&fm=avif&q=75 400w`,
                      `/.netlify/images?url=${encodeURIComponent(image.src)}&w=800&fit=cover&fm=avif&q=75 800w`,
                      `/.netlify/images?url=${encodeURIComponent(image.src)}&w=1200&fit=cover&fm=avif&q=75 1200w`,
                    ].join(", ");
                const imgUrl = isInternalApi
                  ? image.src
                  : `/.netlify/images?url=${encodeURIComponent(image.src)}&w=400&h=400&fit=cover&fm=avif&q=75`;

                return (
                  <button
                    key={index}
                    onClick={() => openLightbox(index)}
                    className={
                      viewMode === "list"
                        ? "group relative flex items-center gap-4 w-full text-left overflow-hidden rounded-xl border border-[rgb(var(--border-soft))] shadow-sm glass p-2 sm:p-3 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[rgb(var(--fg))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))]"
                        : `group relative ${viewMode === "small" ? "aspect-square" : "aspect-square sm:aspect-[4/3] lg:aspect-square"} overflow-hidden rounded-xl border border-[rgb(var(--border-soft))] shadow-sm glass focus:outline-none focus:ring-2 focus:ring-[rgb(var(--fg))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))] transition-all hover:-translate-y-1 hover:shadow-xl w-full text-left`
                    }
                    aria-label={`View ${image.alt}`}
                  >
                    {viewMode === "list" ? (
                      <>
                        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 overflow-hidden rounded-lg">
                          <img
                            src={imgUrl}
                            srcSet={srcset}
                            sizes={isInternalApi ? undefined : "80px"}
                            alt={image.alt}
                            loading={index < 8 ? undefined : "lazy"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{image.alt}</p>
                          {image.caption && (
                            <p className="text-xs text-[rgb(var(--muted-fg))] truncate">{image.caption}</p>
                          )}
                        </div>
                        {isAdmin && image.id && (
                          <div className="flex gap-1 shrink-0">
                            {!albumId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMoveTarget({ id: image.id!, url: image.src, alt: image.alt, caption: image.caption });
                                }}
                                className="p-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-full"
                                aria-label="Move to album"
                              >
                                <FolderPlus size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteImageConfirm(image.id!);
                              }}
                              disabled={isDeleting === image.id}
                              className="p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-full"
                              aria-label="Delete image"
                            >
                              {isDeleting === image.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <img
                          src={imgUrl}
                          srcSet={srcset}
                          sizes={
                            isInternalApi
                              ? undefined
                              : viewMode === "small"
                                ? "(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          }
                          alt={image.alt}
                          loading={index < 8 ? undefined : "lazy"}
                          fetchPriority={isFirstVisible ? "high" : undefined}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {isAdmin && image.id && (
                          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {!albumId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMoveTarget({ id: image.id!, url: image.src, alt: image.alt, caption: image.caption });
                                }}
                                className="p-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-full"
                                aria-label="Move to album"
                              >
                                <FolderPlus size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteImageConfirm(image.id!);
                              }}
                              disabled={isDeleting === image.id}
                              className="p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-full"
                              aria-label="Delete image"
                            >
                              {isDeleting === image.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4">
                          <div className="text-center translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <span className="text-white text-xs font-bold border border-white/30 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-sm inline-block mb-3">
                              View
                            </span>
                            <p className="text-white/90 text-sm font-medium line-clamp-2">
                              {image.alt}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-2 sm:p-3 rounded-full transition-colors z-[110]"
            aria-label="Close lightbox"
          >
            <X size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            className="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-2 sm:p-3 rounded-full transition-colors z-[110]"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
          </button>
          <div
            className="w-full h-full max-w-6xl px-4 sm:px-16 md:px-24 flex flex-col items-center justify-center relative z-[105]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[70vh] flex items-center justify-center">
              <img
                src={
                  GALLERY_DATA[lightboxIndex].src.startsWith("/api/")
                    ? GALLERY_DATA[lightboxIndex].src
                    : `/.netlify/images?url=${encodeURIComponent(GALLERY_DATA[lightboxIndex].src)}&w=1200&fit=contain&fm=avif&q=85`
                }
                alt={GALLERY_DATA[lightboxIndex].alt}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            </div>
            <div className="mt-6 text-center bg-black/40 p-4 rounded-xl border border-white/10 backdrop-blur-md max-w-2xl w-full">
              <h3 className="text-white font-bold text-sm sm:text-base">
                {GALLERY_DATA[lightboxIndex].alt}
              </h3>
              <p className="text-white/70 mt-2 text-xs sm:text-sm max-w-lg mx-auto">
                {GALLERY_DATA[lightboxIndex].caption}
              </p>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs font-bold text-white/40">
                <span>
                  {lightboxIndex + 1} / {GALLERY_DATA.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const img = GALLERY_DATA[lightboxIndex];
                    handleDownload(
                      img.src,
                      img.alt.replace(/\s+/g, "_") + ".jpg",
                    );
                  }}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
                  aria-label="Download image"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                {isAdmin && GALLERY_DATA[lightboxIndex].id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteImageConfirm(GALLERY_DATA[lightboxIndex].id!);
                    }}
                    disabled={isDeleting === GALLERY_DATA[lightboxIndex].id}
                    className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Delete image"
                  >
                    {isDeleting === GALLERY_DATA[lightboxIndex].id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    <span>Delete</span>
                  </button>
                )}
              </div>
              {/* Member engagement — reactions + comments */}
              {GALLERY_DATA[lightboxIndex].id && (
                <PhotoEngagement imageId={GALLERY_DATA[lightboxIndex].id!} />
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 p-2 sm:p-3 rounded-full transition-colors z-[110]"
            aria-label="Next image"
          >
            <ChevronRight size={24} className="sm:w-8 sm:h-8" />
          </button>
        </div>
      )}
      <ToastBar toast={toast} />
    </>
  );
}
