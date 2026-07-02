// src/routes/communities.tsx
// Public Communities directory. Any signed-in user can join/leave; admins can
// create, edit, and delete communities. Each card links to that community's
// schedules and chat thread. Mirrors the polls.tsx page conventions.

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuth, getUserDisplayName } from '@/lib/auth-client'
import {
  getCommunities,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
} from '@/server/community.functions'
import {
  Loader2, Users, Plus, X, Check, ArrowLeft, Lock,
  Trophy, MessageSquare, Pencil, Trash2, LogIn, LogOut,
} from 'lucide-react'

export const Route = createFileRoute('/communities')({
  component: CommunitiesPage,
})

type Community = {
  id: number
  slug: string
  name: string
  description: string
  colorPrimary: string
  colorSecondary: string
  memberCount: number
  scheduleCount: number
  isMember: boolean
  createdAt: number
}

function CommunitiesPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Community | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Community | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getCommunities()
      setCommunities((rows ?? []) as Community[])
    } catch (e) {
      console.error('Failed to load communities', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleMembership = async (c: Community) => {
    if (!user || busyId) return
    setBusyId(c.id)
    // Optimistic
    setCommunities(prev => prev.map(x => x.id === c.id
      ? { ...x, isMember: !x.isMember, memberCount: x.memberCount + (x.isMember ? -1 : 1) }
      : x))
    try {
      if (c.isMember) await leaveCommunity({ data: { communityId: c.id } })
      else await joinCommunity({ data: { communityId: c.id, displayName: getUserDisplayName(user) } })
    } catch (e) {
      console.error('Membership toggle failed', e)
      await load() // revert to truth
    }
    setBusyId(null)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    const target = confirmDelete
    setConfirmDelete(null)
    setCommunities(prev => prev.filter(x => x.id !== target.id))
    try {
      await deleteCommunity({ data: { id: target.id } })
    } catch (e) {
      console.error('Delete failed', e)
      await load()
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Communities</h1>
            <p className="text-sm text-[rgb(var(--muted-fg))]">Join a group to follow its schedules</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={15} /> New Community
          </button>
        )}
      </div>

      {/* Not logged in notice */}
      {!authLoading && !user && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Lock size={16} className="text-blue-400 flex-shrink-0" />
          <div className="text-sm">
            <Link to="/join" className="text-blue-400 hover:underline font-medium">Join as a member</Link>
            <span className="text-[rgb(var(--muted-fg))]"> to follow communities and chat in their threads.</span>
          </div>
        </div>
      )}

      {showCreate && isAdmin && (
        <CommunityFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}
      {editing && isAdmin && (
        <CommunityFormModal
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg">Delete “{confirmDelete.name}”?</h3>
            <p className="text-sm text-[rgb(var(--muted-fg))]">
              This removes the community, its memberships, schedule links, and chat thread. This cannot be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[rgb(var(--muted-fg))]" />
        </div>
      ) : communities.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Users size={32} className="text-[rgb(var(--muted-fg))] opacity-30 mx-auto" />
          <p className="text-[rgb(var(--muted-fg))]">No communities yet.</p>
          {isAdmin && (
            <p className="text-sm text-[rgb(var(--muted-fg))]">Create one to start grouping schedules.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {communities.map(c => (
            <div key={c.id} className="glass border border-[rgb(var(--border-soft))] rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-[rgb(var(--fg))] leading-snug truncate">{c.name}</h3>
                  <p className="text-[12px] text-[rgb(var(--muted-fg))]">/{c.slug}</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditing(c)}
                      className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-hover))] transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="p-1.5 rounded-lg text-[rgb(var(--muted-fg))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {c.description && (
                <p className="text-sm text-[rgb(var(--muted-fg))] leading-relaxed line-clamp-3">{c.description}</p>
              )}

              <div className="flex items-center gap-4 text-[12px] text-[rgb(var(--muted-fg))]">
                <span className="flex items-center gap-1"><Users size={12} /> {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}</span>
                <span className="flex items-center gap-1"><Trophy size={12} /> {c.scheduleCount} {c.scheduleCount === 1 ? 'schedule' : 'schedules'}</span>
              </div>

              <div className="flex items-center gap-2 pt-1 mt-auto">
                <Link
                  to="/tournaments"
                  search={{ id: undefined, community: c.slug }}
                  className="flex-1 text-center text-[13px] font-medium rounded-xl px-3 py-2 bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border-soft))] transition-colors"
                >
                  Schedules
                </Link>
                {c.isMember && (
                  <Link
                    to="/chat"
                    search={{ community: c.slug }}
                    className="flex items-center justify-center gap-1 text-[13px] font-medium rounded-xl px-3 py-2 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                    title="Open chat"
                  >
                    <MessageSquare size={14} /> Chat
                  </Link>
                )}
                {user && (
                  <button
                    onClick={() => toggleMembership(c)}
                    disabled={busyId === c.id}
                    className={`flex items-center justify-center gap-1 text-[13px] font-medium rounded-xl px-3 py-2 transition-colors disabled:opacity-50 ${
                      c.isMember
                        ? 'border border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {busyId === c.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : c.isMember
                        ? <><LogOut size={14} /> Leave</>
                        : <><LogIn size={14} /> Join</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

// ─── Create / Edit modal (admin only) ────────────────────────────────────────

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function CommunityFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Community
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [slug, setSlug] = useState(existing?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!existing)
  const [description, setDescription] = useState(existing?.description ?? '')
  const [colorPrimary, setColorPrimary] = useState(existing?.colorPrimary ?? '#1e3a8a')
  const [colorSecondary, setColorSecondary] = useState(existing?.colorSecondary ?? '#ffffff')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-derive slug from name until the admin edits it directly.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) { setError('Name is required.'); return }
    const finalSlug = (slug.trim() || slugify(name))
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug)) {
      setError('Slug must be lowercase letters, numbers, and single dashes.')
      return
    }
    setSubmitting(true)
    try {
      if (existing) {
        await updateCommunity({ data: { id: existing.id, name: name.trim(), slug: finalSlug, description: description.trim(), colorPrimary, colorSecondary } })
      } else {
        await createCommunity({ data: { name: name.trim(), slug: finalSlug, description: description.trim(), colorPrimary, colorSecondary } })
      }
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Failed to save community.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{existing ? 'Edit Community' : 'Create Community'}</h3>
          <button onClick={onClose} className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Manila Spikers"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Slug (URL key)</label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
              placeholder="manila-spikers"
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="A short description of this community."
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] focus:border-blue-500 outline-none rounded-xl px-3 py-2.5 text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[rgb(var(--muted-fg))] mb-1 block">Community Colors (2-way palette)</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input type="color" value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />
                Primary
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="color" value={colorSecondary} onChange={(e) => setColorSecondary(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />
                Secondary
              </label>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full ml-auto"
                style={{ backgroundColor: colorPrimary, color: colorSecondary }}>
                {name.trim() || 'Preview'}
              </span>
            </div>
            <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1">Primary = tag background, Secondary = tag text. Used everywhere this community appears.</p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {existing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
