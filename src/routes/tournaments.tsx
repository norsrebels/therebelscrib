import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  Link2,
  Loader2,
  ShieldCheck,
  Archive,
  ArchiveRestore,
  Clock,
  ArrowDownAZ,
  LogIn,
  Monitor,
  Trash2,
} from "lucide-react";
import TournamentApp from "@/components/TournamentApp";
import { useAuth } from "@/lib/auth-client";
import {
  getTournaments,
  createTournament,
  toggleArchiveTournament,
  deleteTournament,
} from "@/server/tournament.functions";
import { ConfirmationModal } from "@/components/Modals";
import { useLoading } from "@/lib/loading-context";
import { useToast } from "@/lib/use-toast";
import { ToastBar } from "@/components/Modals";

interface ScheduleItem {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
}

export const Route = createFileRoute("/tournaments")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id.trim() : undefined,
  }),
  loader: async () => {
    const schedules = await getTournaments();
    return { schedules };
  },
  component: TournamentsPage,
});

function TournamentsPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const loaderData = Route.useLoaderData();
  const [schedules, setSchedules] = useState<ScheduleItem[]>(loaderData.schedules);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast, showToast } = useToast();
  const { setLoading } = useLoading();
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    archived: boolean;
  } | null>(null);
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [deleteTournamentConfirm, setDeleteTournamentConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setSchedules(loaderData.schedules);
  }, [loaderData.schedules]);

  const addSchedule = async () => {
    if (!isAdmin) {
      navigate({ to: "/login", search: { redirect: "/tournaments" } });
      return;
    }
    if (!newScheduleName.trim()) {
      setShowNewScheduleModal(true);
      return;
    }
    setShowNewScheduleModal(false);
    setLoading(true);
    try {
      const newId = Math.random().toString(36).slice(2, 10);
      const created = await createTournament({
        data: { id: newId, name: newScheduleName.trim() },
      });
      setSchedules((prev) => [...prev, created]);
      setNewScheduleName("");
      navigate({ search: { id: newId } });
    } catch (e) {
      console.error(e);
      showToast("Failed to create schedule", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (archiveId: string, archived: boolean) => {
    setConfirmAction(null);
    try {
      await toggleArchiveTournament({ data: { id: archiveId, archived } });
      setSchedules((prev) =>
        prev.map((s) => (s.id === archiveId ? { ...s, archived } : s)),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTournament = async () => {
    if (!deleteTournamentConfirm) return;
    try {
      await deleteTournament({ data: { id: deleteTournamentConfirm.id } });
      setDeleteTournamentConfirm(null);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteTournamentConfirm.id));
      showToast("Schedule permanently deleted", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete schedule", "error");
    }
  };

  if (id) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      );
    }
    if (!isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full glass border border-[rgb(var(--border-soft))] rounded-3xl p-10 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Admin Access Required
            </h2>
            <p className="text-[15px] text-[rgb(var(--muted-fg))] leading-relaxed">
              The schedule editor is only available to signed-in administrators.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link
                to="/login"
                search={{
                  redirect: `/tournaments?id=${encodeURIComponent(id)}`,
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-full px-5 py-3 text-[15px] font-medium transition-colors"
              >
                <LogIn size={18} /> Sign In
              </Link>
              <a
                href={`/live/${encodeURIComponent(id)}`}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border-soft))] text-[rgb(var(--fg))] rounded-full px-5 py-3 text-[15px] font-medium transition-colors"
              >
                Live View
              </a>
            </div>
          </div>
        </div>
      );
    }
    return <TournamentApp tournamentId={id} defaultView="admin" />;
  }

  const filteredSchedules = schedules.filter((s) =>
    showArchived ? s.archived : !s.archived,
  );
  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      

      {confirmAction && (
        <ConfirmationModal
          title={confirmAction.archived ? "Archive Schedule" : "Unarchive Schedule"}
          message={
            confirmAction.archived
              ? "Are you sure you want to archive this schedule? It will be hidden from the main list."
              : "Are you sure you want to restore this schedule?"
          }
          confirmLabel={confirmAction.archived ? "Archive" : "Restore"}
          variant={confirmAction.archived ? "danger" : "default"}
          onConfirm={() =>
            handleToggleArchive(confirmAction.id, confirmAction.archived)
          }
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {showNewScheduleModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold tracking-tight mb-4">New Schedule</h3>
            <input
              type="text"
              placeholder="Schedule name"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              className="w-full bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowNewScheduleModal(false); setNewScheduleName(""); }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[rgb(var(--surface-hover))] border border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--border-soft))] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addSchedule}
                disabled={!newScheduleName.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTournamentConfirm && (
        <ConfirmationModal
          title="Delete Schedule Permanently"
          message="This will permanently delete the schedule and all its data. This cannot be undone."
          confirmLabel="Delete Forever"
          variant="danger"
          onConfirm={handleDeleteTournament}
          onCancel={() => setDeleteTournamentConfirm(null)}
        />
      )}

      {!authLoading && !isAdmin && (
        <div className="mb-10 rounded-2xl bg-[rgb(var(--surface))] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm border border-[rgb(var(--border-soft))]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} />
            </div>
            <p className="text-[15px]">
              Viewing as a public visitor. Sign in to create and edit schedules.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2.5 text-[15px] font-medium whitespace-nowrap transition-colors"
          >
            Admin Sign In
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-semibold tracking-tight">Schedules</h2>
          {schedules.length > 0 && (
            <div className="flex items-center bg-[rgb(var(--surface-hover))] rounded-full p-1 border border-[rgb(var(--border-soft))]">
              <button
                onClick={() => setSortBy("date")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${sortBy === "date" ? "bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm" : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"}`}
              >
                <Clock size={14} /> Date
              </button>
              <button
                onClick={() => setSortBy("name")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${sortBy === "name" ? "bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm" : "text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]"}`}
              >
                <ArrowDownAZ size={14} /> Name
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {schedules.some((s) => s.archived) && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[14px] font-medium transition-colors border ${showArchived ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" : "bg-[rgb(var(--surface))] text-[rgb(var(--fg))] border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--surface-hover))]"}`}
            >
              <Archive size={16} />
              {showArchived ? "Hide Archived" : "Show Archived"}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={addSchedule}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-[15px] font-medium transition-colors shadow-sm"
            >
              <Plus size={18} />
              New Schedule
            </button>
          )}
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-24 border border-[rgb(var(--border-soft))] rounded-3xl bg-[rgb(var(--surface))] shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-[rgb(var(--surface-hover))] rounded-full flex items-center justify-center text-[rgb(var(--muted-fg))]">
            <Calendar size={28} />
          </div>
          <h3 className="text-xl font-semibold tracking-tight mb-2">
            No schedules yet
          </h3>
          <p className="text-[15px] text-[rgb(var(--muted-fg))]">
            {isAdmin
              ? "Create your first schedule to get started."
              : "No schedules have been created yet."}
          </p>
          {isAdmin && (
            <button
              onClick={addSchedule}
              className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full text-[15px] font-medium transition-colors shadow-sm"
            >
              <Plus size={18} />
              Create Schedule
            </button>
          )}
        </div>
      ) : sortedSchedules.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-[rgb(var(--border-soft))] rounded-3xl">
          <p className="text-[rgb(var(--muted-fg))] text-sm">
            {showArchived
              ? "No archived schedules."
              : "All schedules are archived. Toggle \"Show Archived\" to view them."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedSchedules.map((s) => (
            <div
              key={s.id}
              className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
            >
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight line-clamp-2">
                      {s.name}
                    </h3>
                    <p className="text-[13px] text-[rgb(var(--muted-fg))] mt-1">
                      ID: {s.id}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({
                            id: s.id,
                            archived: !s.archived,
                          });
                        }}
                        className="text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))] p-1.5 rounded-full hover:bg-[rgb(var(--surface-hover))] transition-colors"
                        title={s.archived ? "Unarchive" : "Archive"}
                      >
                        {s.archived ? (
                          <ArchiveRestore size={18} />
                        ) : (
                          <Archive size={18} />
                        )}
                      </button>
                      {s.archived && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTournamentConfirm({ id: s.id, name: s.name });
                          }}
                          className="text-[rgb(var(--muted-fg))] hover:text-red-500 p-1.5 rounded-full hover:bg-red-500/10 transition-colors"
                          title="Delete permanently"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 mt-auto">
                <div className="flex flex-col gap-2 mb-4">
                  {isAdmin && (
                    <button
                      onClick={() => navigate({ search: { id: s.id } })}
                      className="w-full text-center text-[14px] font-medium rounded-xl px-4 py-2.5 bg-[rgb(var(--surface-hover))] hover:bg-[rgb(var(--border-soft))] transition-colors"
                    >
                      Edit Schedule
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`/live/${encodeURIComponent(s.id)}`}
                      className="text-center text-[14px] font-medium rounded-xl px-3 py-2.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                    >
                      Live View
                    </a>
                    <a
                      href={`/scoreboard/${encodeURIComponent(s.id)}`}
                      className="text-center text-[14px] font-medium rounded-xl px-3 py-2.5 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Monitor size={14} /> Scoreboard
                    </a>
                  </div>
                </div>
                <div className="text-[12px] text-[rgb(var(--muted-fg))] flex items-center gap-1.5 justify-center">
                  <Link2 size={14} />
                  Links are public-safe
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ToastBar toast={toast} />
    </main>
  );
}
