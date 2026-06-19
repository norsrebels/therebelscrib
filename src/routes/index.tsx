import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-client";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePinAnnouncement,
} from "@/server/announcements.functions";
import { Pencil, Trash2, Pin, PinOff, Plus, Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon, Video, X, Upload, Link as LinkIcon } from "lucide-react";
import { ConfirmationModal, ToastBar } from "@/components/Modals";
import { useToast } from "@/lib/use-toast";

export const Route = createFileRoute("/")({
  loader: async () => {
    const announcements = await getAnnouncements();
    return { announcements };
  },
  component: HomePage,
});

const TAG_COLORS: Record<string, string> = {
  blue: "text-blue-500 bg-blue-500/10",
  amber: "text-amber-500 bg-amber-500/10",
  green: "text-green-500 bg-green-500/10",
  red: "text-red-500 bg-red-500/10",
  purple: "text-purple-500 bg-purple-500/10",
};


function RichTextEditor({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('url');
  const [videoTab, setVideoTab] = useState<'url' | 'upload'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Focus tracking to restore selection
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedSelection(sel.getRangeAt(0));
    }
  };

  const restoreSelection = () => {
    if (savedSelection) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection);
    }
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    handleInput();
    editorRef.current?.focus();
  };

  const insertImage = (url: string) => {
    restoreSelection();
    document.execCommand('insertImage', false, url);
    handleInput();
    setImageModalOpen(false);
    setImageUrl('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const id = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const response = await fetch(`/api/image/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
        credentials: 'same-origin',
      });
      if (response.ok) {
        const data = await response.json();
        insertImage(data.url);
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    } finally {
      setIsUploading(false);
    }
  };

  const insertVideo = () => {
    if (!videoUrl) return;
    restoreSelection();
    
    // Parse youtube or vimeo URL
    let embedUrl = videoUrl;
    if (videoUrl.includes('youtube.com/watch?v=')) {
      const id = new URL(videoUrl).searchParams.get('v');
      embedUrl = `https://www.youtube.com/embed/${id}`;
    } else if (videoUrl.includes('youtu.be/')) {
      const id = videoUrl.split('youtu.be/')[1].split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${id}`;
    } else if (videoUrl.includes('vimeo.com/')) {
      const id = videoUrl.split('vimeo.com/')[1];
      embedUrl = `https://player.vimeo.com/video/${id}`;
    }

    const html = `<div class="video-wrapper"><iframe src="${embedUrl}" allowfullscreen></iframe></div><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    handleInput();
    setVideoModalOpen(false);
    setVideoUrl('');
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const id = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const response = await fetch(`/api/image/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
        credentials: 'same-origin',
      });
      if (response.ok) {
        const data = await response.json();
        restoreSelection();
        const html = `<video src="${data.url}" controls></video><p><br></p>`;
        document.execCommand('insertHTML', false, html);
        handleInput();
        setVideoModalOpen(false);
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    } finally {
      setIsUploading(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    }
  };

  const openImageModal = () => {
    saveSelection();
    setImageModalOpen(true);
  };

  const openVideoModal = () => {
    saveSelection();
    setVideoModalOpen(true);
  };

  return (
    <div className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl overflow-hidden focus-within:border-blue-500">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))]">
        <button type="button" onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Bold size={16} /></button>
        <button type="button" onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Italic size={16} /></button>
        <button type="button" onClick={() => execCommand('underline')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Underline size={16} /></button>
        <div className="w-px h-4 bg-[rgb(var(--border-strong))] mx-1" />
        <button type="button" onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><List size={16} /></button>
        <button type="button" onClick={() => execCommand('insertOrderedList')} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><ListOrdered size={16} /></button>
        <div className="w-px h-4 bg-[rgb(var(--border-strong))] mx-1" />
        <button type="button" onClick={openImageModal} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><ImageIcon size={16} /></button>
        <button type="button" onClick={openVideoModal} className="p-1.5 rounded hover:bg-[rgb(var(--surface-hover))]"><Video size={16} /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="announcement-body min-h-[150px] max-h-[400px] overflow-y-auto p-4 text-sm outline-none"
      />
      
      {imageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Insert Image</h3>
              <button onClick={() => setImageModalOpen(false)} className="text-[rgb(var(--muted-fg))] hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4 border-b border-[rgb(var(--border-soft))]">
              <button 
                className={`pb-2 px-2 text-sm font-medium border-b-2 ${imageTab === 'url' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[rgb(var(--muted-fg))]'}`}
                onClick={() => setImageTab('url')}
              >
                <LinkIcon size={14} className="inline mr-1" /> URL
              </button>
              <button 
                className={`pb-2 px-2 text-sm font-medium border-b-2 ${imageTab === 'upload' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[rgb(var(--muted-fg))]'}`}
                onClick={() => setImageTab('upload')}
              >
                <Upload size={14} className="inline mr-1" /> Upload
              </button>
            </div>
            {imageTab === 'url' ? (
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={imageUrl} 
                  onChange={(e) => setImageUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-3 py-2 text-sm outline-none"
                />
                <button onClick={() => insertImage(imageUrl)} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-blue-700">Insert Image</button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading}
                  className="w-full border border-[rgb(var(--border-strong))] text-[rgb(var(--fg))] rounded-lg py-4 text-sm font-bold hover:bg-[rgb(var(--surface-hover))] border-dashed"
                >
                  {isUploading ? 'Uploading...' : 'Select File'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Insert Video</h3>
              <button onClick={() => setVideoModalOpen(false)} className="text-[rgb(var(--muted-fg))] hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4 border-b border-[rgb(var(--border-soft))]">
              <button
                className={`pb-2 px-2 text-sm font-medium border-b-2 ${videoTab === 'url' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[rgb(var(--muted-fg))]'}`}
                onClick={() => setVideoTab('url')}
              >
                <LinkIcon size={14} className="inline mr-1" /> URL
              </button>
              <button
                className={`pb-2 px-2 text-sm font-medium border-b-2 ${videoTab === 'upload' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[rgb(var(--muted-fg))]'}`}
                onClick={() => setVideoTab('upload')}
              >
                <Upload size={14} className="inline mr-1" /> Upload
              </button>
            </div>
            {videoTab === 'url' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="YouTube or Vimeo URL"
                  className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-lg px-3 py-2 text-sm outline-none"
                />
                <button onClick={insertVideo} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-blue-700">Insert Video</button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <input
                  type="file"
                  accept="video/*"
                  ref={videoFileInputRef}
                  className="hidden"
                  onChange={handleVideoUpload}
                />
                <button
                  onClick={() => videoFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full border border-[rgb(var(--border-strong))] text-[rgb(var(--fg))] rounded-lg py-4 text-sm font-bold hover:bg-[rgb(var(--surface-hover))] border-dashed"
                >
                  {isUploading ? 'Uploading...' : 'Select Video'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function HomePage() {
  const { announcements } = Route.useLoaderData();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formTag, setFormTag] = useState("Announcement");
  const [formTagColor, setFormTagColor] = useState("blue");
  const [formPinned, setFormPinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFormTitle("");
    setFormBody("");
    setFormTag("Announcement");
    setFormTagColor("blue");
    setFormPinned(false);
    setShowAddForm(false);
    setEditId(null);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formBody.trim()) return;
    setIsSaving(true);
    try {
      if (editId) {
        await updateAnnouncement({
          data: {
            id: editId,
            updates: {
              title: formTitle,
              body: formBody,
              tag: formTag,
              tagColor: formTagColor,
              pinned: formPinned,
            },
          },
        });
        showToast("Announcement updated", "success");
      } else {
        await createAnnouncement({
          data: {
            title: formTitle,
            body: formBody,
            tag: formTag,
            tagColor: formTagColor,
            pinned: formPinned,
          },
        });
        showToast("Announcement created", "success");
      }
      resetForm();
      router.invalidate();
    } catch (e) {
      console.error(e);
      showToast("Failed to save announcement", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm === null) return;
    try {
      await deleteAnnouncement({ data: deleteConfirm });
      setDeleteConfirm(null);
      router.invalidate();
      showToast("Announcement deleted", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete announcement", "error");
    }
  };

  const handleTogglePin = async (id: number, currentPinned: boolean) => {
    try {
      await togglePinAnnouncement({ data: { id, pinned: !currentPinned } });
      router.invalidate();
    } catch (e) {
      console.error(e);
      showToast("Failed to update pin", "error");
    }
  };

  const startEdit = (a: any) => {
    setEditId(a.id);
    setFormTitle(a.title);
    setFormBody(a.body);
    setFormTag(a.tag);
    setFormTagColor(a.tagColor);
    setFormPinned(a.pinned);
    setShowAddForm(true);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16">
      {deleteConfirm !== null && (
        <ConfirmationModal
          title="Delete Announcement"
          message="Are you sure you want to delete this announcement?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <section className="text-center py-12 sm:py-16">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Welcome to Rebels
        </h2>
        <p className="text-lg text-[rgb(var(--muted-fg))] max-w-2xl mx-auto">
          The official hub for the Rebels community. Check out player stats,
          live tournament brackets, and our latest updates.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/player-dex"
            className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-full font-bold shadow-sm transition-colors"
          >
            Explore Player Dex
          </Link>
          <Link
            to="/tournaments"
            className="px-6 py-3 border border-[rgb(var(--border-strong))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] rounded-full font-bold shadow-sm transition-colors"
          >
            View Tournaments
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold tracking-tight">
            Recent News & Announcements
          </h3>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowAddForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors"
            >
              <Plus size={16} />
              Add
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="glass border border-[rgb(var(--border-soft))] p-6 rounded-xl shadow-sm mb-6">
            <h4 className="font-bold mb-4">{editId ? "Edit Announcement" : "New Announcement"}</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <RichTextEditor value={formBody} onChange={setFormBody} />
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  placeholder="Tag (e.g. Announcement)"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  className="flex-1 min-w-[150px] bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
                <select
                  value={formTagColor}
                  onChange={(e) => setFormTagColor(e.target.value)}
                  className="bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="blue">Blue</option>
                  <option value="amber">Amber</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="purple">Purple</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="rounded"
                  />
                  Pinned
                </label>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={resetForm}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving || !formTitle.trim() || !formBody.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : editId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {announcements.length > 0 ? (
            (() => {
              let nonPinnedCount = 0;
              return announcements.map((a: any, index: number) => {
                if (!a.pinned) nonPinnedCount++;
                const number = a.pinned ? null : nonPinnedCount;
                return (
                  <div
                    key={a.id}
                    className={`glass border ${a.pinned ? 'border-amber-500/30' : 'border-[rgb(var(--border-soft))]'} p-6 rounded-xl shadow-sm relative group animate-in fade-in`}
                    style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-start gap-4">
                      {a.pinned ? (
                        <div className="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/10">
                          <Pin size={16} className="text-amber-500" />
                        </div>
                      ) : (
                        <div className="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] text-sm font-bold">
                          {number}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${TAG_COLORS[a.tagColor] || TAG_COLORS.blue}`}
                          >
                            {a.tag}
                          </span>
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleTogglePin(a.id, a.pinned)}
                                className="p-1.5 rounded-lg bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                                title={a.pinned ? "Unpin" : "Pin"}
                              >
                                {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                              </button>
                              <button
                                onClick={() => startEdit(a)}
                                className="p-1.5 rounded-lg bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(a.id)}
                                className="p-1.5 rounded-lg bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] hover:text-red-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        <h4 className="text-lg font-semibold mt-3 mb-2">{a.title}</h4>
                        <div className="text-sm text-[rgb(var(--muted-fg))] announcement-body" dangerouslySetInnerHTML={{ __html: a.body }} />
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          ) : (
            <div className="glass border border-[rgb(var(--border-soft))] p-6 rounded-xl shadow-sm">
              <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full">
                Announcement
              </span>
              <h4 className="text-lg font-semibold mt-3 mb-2">
                Stay tuned for updates.
              </h4>
              <p className="text-sm text-[rgb(var(--muted-fg))]">
                Check back later for news and announcements from the Rebels community.
              </p>
            </div>
          )}
        </div>
      </section>

      <ToastBar toast={toast} />
    </main>
  );
}
