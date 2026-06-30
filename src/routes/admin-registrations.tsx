import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAllRegistrationSchedules,
  createRegistrationSchedule,
  updateRegistrationSchedule,
  deleteRegistrationSchedule,
  getRegistrations,
  updateRegistrationStatus,
  deleteRegistration,
  getRegistrationsHeartbeat,
  type RegistrationSchedule,
  type Registration,
  type CustomFieldDefinition,
} from '@/server/registration.functions'
import {
  Calendar, Plus, Trash2, X, Check, Clock, AlertTriangle, Ban,
  Download, Search, ChevronDown, RefreshCw, Wifi,
} from 'lucide-react'

export const Route = createFileRoute('/admin-registrations')({
  component: AdminRegistrationsPage,
})

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'text-amber-500 bg-amber-500/10',  icon: Clock },
  confirmed:  { label: 'Confirmed',  color: 'text-green-500 bg-green-500/10',  icon: Check },
  waitlisted: { label: 'Waitlisted', color: 'text-blue-500 bg-blue-500/10',    icon: AlertTriangle },
  cancelled:  { label: 'Cancelled',  color: 'text-red-500 bg-red-500/10',      icon: Ban },
}

// date is 'YYYY-MM-DD' text, time is 'HH:mm' text — parse manually, format only.
function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return ''
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${period}`
}

function formatScheduleWhen(date: string | null | undefined, time: string | null | undefined): string {
  if (!date) return 'TBA'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return 'TBA'
  const dt = new Date(y, m - 1, d)
  if (isNaN(dt.getTime())) return 'TBA'
  let out = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const t = formatTime(time)
  if (t) out += ` • ${t}`
  return out
}

function AdminRegistrationsPage() {
  const [schedules, setSchedules] = useState<RegistrationSchedule[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)

  // Filters — schedule + schedule name (free text) + date range (point b) + status + search
  const [scheduleFilter, setScheduleFilter] = useState<number | null>(null)
  const [scheduleNameFilter, setScheduleNameFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  const [showScheduleEditor, setShowScheduleEditor] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<RegistrationSchedule | null>(null)

  // Polling / sync confidence (point c) — lightweight heartbeat compared against
  // what's currently loaded; mismatch triggers a refetch + shows a "new" indicator.
  const [newCount, setNewCount] = useState(0)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const knownCountRef = useRef<number>(0)
  const knownLatestRef = useRef<string | null>(null)

  const loadSchedules = useCallback(async () => {
    const s = await getAllRegistrationSchedules()
    setSchedules(s)
  }, [])

  const loadRegistrations = useCallback(async () => {
    const r = await getRegistrations({
      data: {
        scheduleId: scheduleFilter,
        scheduleName: scheduleNameFilter || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        status: statusFilter || null,
        search: search || null,
      },
    })
    setRegistrations(r)
    setLastSynced(new Date())
    setNewCount(0)
    // Reset heartbeat baseline to what we just confirmed is loaded.
    const heartbeat = await getRegistrationsHeartbeat({ data: { scheduleId: scheduleFilter } })
    knownCountRef.current = heartbeat.count
    knownLatestRef.current = heartbeat.latest
  }, [scheduleFilter, scheduleNameFilter, dateFrom, dateTo, statusFilter, search])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadSchedules(), loadRegistrations()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleFilter, scheduleNameFilter, dateFrom, dateTo, statusFilter, search])

  // Poll every 15s: cheap heartbeat query only. If the count or latest timestamp
  // moved since our last confirmed load, surface a "new submissions" banner rather
  // than silently swapping data under the admin's cursor.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const hb = await getRegistrationsHeartbeat({ data: { scheduleId: scheduleFilter } })
        if (hb.count !== knownCountRef.current || hb.latest !== knownLatestRef.current) {
          setNewCount(Math.max(0, hb.count - knownCountRef.current))
        }
      } catch {}
    }, 15000)
    return () => clearInterval(interval)
  }, [scheduleFilter])

  const handleStatusChange = async (id: number, status: Registration['status']) => {
    await updateRegistrationStatus({ data: { id, status } })
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const handleDeleteRegistration = async (id: number) => {
    if (!confirm('Delete this registration? This cannot be undone.')) return
    await deleteRegistration({ data: { id } })
    setRegistrations((prev) => prev.filter((r) => r.id !== id))
  }

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Delete this schedule and all its registrations? This cannot be undone.')) return
    await deleteRegistrationSchedule({ data: { id } })
    setSchedules((prev) => prev.filter((s) => s.id !== id))
    if (scheduleFilter === id) setScheduleFilter(null)
  }

  // Flatten registrations into one row per person for the tabular view — a team
  // registration with a 5-person roster becomes 5 rows, each with their own
  // position, so the table reads as an actual roster sheet by schedule.
  const peopleRows = registrations.flatMap((r) => {
    if (r.regType === 'individual') {
      return [{
        regId: r.id, scheduleName: r.scheduleName ?? '', groupName: null as string | null,
        name: r.name ?? '', position: r.position ?? '', status: r.status,
        contact: r.email || r.contactNumber || '',
      }]
    }
    if (r.roster.length === 0) {
      return [{
        regId: r.id, scheduleName: r.scheduleName ?? '', groupName: r.teamName,
        name: '(no roster members listed)', position: '', status: r.status, contact: r.email || r.contactNumber || '',
      }]
    }
    return r.roster.map((m) => ({
      regId: r.id, scheduleName: r.scheduleName ?? '', groupName: r.teamName,
      name: m.name, position: m.position, status: r.status, contact: r.email || r.contactNumber || '',
    }))
  })

  const exportCSV = () => {
    const headers = ['ID', 'Schedule', 'Type', 'Name/Team', 'Position', 'Roster', 'Contact', 'Email', 'Status', 'Registered']
    const rows = registrations.map((r) => [
      r.id, r.scheduleName ?? '', r.regType,
      r.regType === 'individual' ? (r.name ?? '') : (r.teamName ?? ''),
      r.position ?? '',
      r.roster.map((m) => `${m.name}${m.position ? ` (${m.position})` : ''}`).join(' | '),
      r.contactNumber ?? '', r.email ?? '', r.status,
      new Date(r.createdAt).toLocaleString(),
    ])
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Registrations</h1>
          <p className="text-xs text-[rgb(var(--muted-fg))] flex items-center gap-1.5 mt-1">
            <Wifi size={12} className="text-green-500" />
            {lastSynced ? `Synced ${lastSynced.toLocaleTimeString()}` : 'Syncing…'}
          </p>
        </div>
        <button onClick={() => { setEditingSchedule(null); setShowScheduleEditor(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold transition-colors">
          <Plus size={16} /> New Schedule
        </button>
      </div>

      {newCount > 0 && (
        <button onClick={loadRegistrations}
          className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-xl py-2.5 text-sm font-bold hover:bg-blue-500/20 transition-colors">
          <RefreshCw size={14} /> {newCount} new submission{newCount > 1 ? 's' : ''} — tap to refresh
        </button>
      )}

      {/* Schedules list */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {schedules.map((s) => (
          <div key={s.id} className={`p-4 rounded-xl border ${scheduleFilter === s.id ? 'border-blue-500 bg-blue-500/5' : 'border-[rgb(var(--border-soft))]'}`}>
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => setScheduleFilter(scheduleFilter === s.id ? null : s.id)} className="text-left flex-1">
                <p className="font-bold text-sm">{s.name}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[rgb(var(--muted-fg))]">
                  <Calendar size={11} /> {formatScheduleWhen(s.date, s.startTime)}
                  <span className={`px-1.5 py-0.5 rounded-full font-bold ${s.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))]'}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-1">{s.registrationCount ?? 0} registered{s.capacity ? ` / ${s.capacity}` : ''}</p>
              </button>
              <div className="flex flex-col gap-1">
                <button onClick={() => { setEditingSchedule(s); setShowScheduleEditor(true) }} className="text-[10px] text-blue-500 hover:underline">Edit</button>
                <button onClick={() => handleDeleteSchedule(s.id)} className="text-[10px] text-red-500 hover:underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, contact…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] focus:outline-none focus:border-blue-500" />
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" />
          <input value={scheduleNameFilter} onChange={(e) => setScheduleNameFilter(e.target.value)} placeholder="Filter by event/schedule name…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] focus:outline-none focus:border-blue-500" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Event date from"
          className="px-3 py-2 text-sm rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] focus:outline-none focus:border-blue-500" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Event date to"
          className="px-3 py-2 text-sm rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] focus:outline-none focus:border-blue-500" />
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] focus:outline-none focus:border-blue-500">
            <option value="">All statuses</option>
            {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" />
        </div>
        <button onClick={exportCSV} disabled={registrations.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[rgb(var(--border-soft))] hover:border-blue-500 transition-colors disabled:opacity-40">
          <Download size={14} /> CSV
        </button>
        <div className="flex rounded-xl border border-[rgb(var(--border-soft))] overflow-hidden">
          <button onClick={() => setViewMode('cards')}
            className={`px-3 py-2 text-xs font-bold transition-colors ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-[rgb(var(--bg))] text-[rgb(var(--muted-fg))]'}`}>
            Cards
          </button>
          <button onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-xs font-bold transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-[rgb(var(--bg))] text-[rgb(var(--muted-fg))]'}`}>
            Table
          </button>
        </div>
      </div>

      {/* Registrations list */}
      {loading ? (
        <p className="text-center text-sm text-[rgb(var(--muted-fg))] py-12">Loading…</p>
      ) : registrations.length === 0 ? (
        <p className="text-center text-sm text-[rgb(var(--muted-fg))] py-12">No registrations match your filters.</p>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-[rgb(var(--border-soft))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[rgb(var(--surface-hover))] text-left text-[11px] uppercase text-[rgb(var(--muted-fg))]">
                <th className="px-3 py-2.5 font-bold">Schedule</th>
                <th className="px-3 py-2.5 font-bold">Team/Group</th>
                <th className="px-3 py-2.5 font-bold">Name</th>
                <th className="px-3 py-2.5 font-bold">Position</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-soft))]">
              {peopleRows.map((p, i) => {
                const meta = STATUS_META[p.status]
                return (
                  <tr key={`${p.regId}-${i}`} className="hover:bg-[rgb(var(--surface-hover))] transition-colors">
                    <td className="px-3 py-2 text-xs">{p.scheduleName}</td>
                    <td className="px-3 py-2 text-xs text-[rgb(var(--muted-fg))]">{p.groupName ?? '—'}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2">
                      {p.position ? (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{p.position}</span>
                      ) : <span className="text-[rgb(var(--muted-fg))] text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[rgb(var(--muted-fg))]">{p.contact || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {registrations.map((r) => {
            const meta = STATUS_META[r.status]
            const Icon = meta.icon
            return (
              <div key={r.id} className="p-4 rounded-xl border border-[rgb(var(--border-soft))] flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-sm">
                    {r.regType === 'individual' ? r.name : r.teamName}{' '}
                    <span className="text-[10px] font-normal text-[rgb(var(--muted-fg))] uppercase">({r.regType})</span>
                    {r.regType === 'individual' && r.position && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{r.position}</span>
                    )}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted-fg))]">{r.scheduleName} • {r.email || r.contactNumber || 'No contact'}</p>
                  {r.roster.length > 0 && (
                    <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-1">
                      Roster: {r.roster.map((m) => `${m.name}${m.position ? ` (${m.position})` : ''}`).join(', ')}
                    </p>
                  )}
                </div>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.color}`}>
                  <Icon size={11} /> {meta.label}
                </span>
                <select value={r.status} onChange={(e) => handleStatusChange(r.id, e.target.value as Registration['status'])}
                  className="text-xs rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5 focus:outline-none focus:border-blue-500">
                  {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
                <button onClick={() => handleDeleteRegistration(r.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showScheduleEditor && (
        <ScheduleEditorModal
          schedule={editingSchedule}
          onClose={() => setShowScheduleEditor(false)}
          onSaved={() => { setShowScheduleEditor(false); loadSchedules() }}
        />
      )}
    </div>
  )
}

function ScheduleEditorModal({ schedule, onClose, onSaved }: {
  schedule: RegistrationSchedule | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(schedule?.name ?? '')
  const [sport, setSport] = useState(schedule?.sport ?? 'Volleyball')
  const [date, setDate] = useState(schedule?.date ?? '')
  const [startTime, setStartTime] = useState(schedule?.startTime ?? '')
  const [endDate, setEndDate] = useState(schedule?.endDate ?? '')
  const [endTime, setEndTime] = useState(schedule?.endTime ?? '')
  const [venue, setVenue] = useState(schedule?.venue ?? '')
  const [description, setDescription] = useState(schedule?.description ?? '')
  const [status, setStatus] = useState(schedule?.status ?? 'active')
  const [capacity, setCapacity] = useState(schedule?.capacity?.toString() ?? '')
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(schedule?.customFields ?? [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const addField = () => setCustomFields([...customFields, {
    id: 'cf_' + Math.random().toString(36).slice(2, 8), name: '', type: 'text', options: [], required: false, defaultValue: '',
  }])
  const updateField = (i: number, patch: Partial<CustomFieldDefinition>) => {
    setCustomFields(customFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  const removeField = (i: number) => setCustomFields(customFields.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    const payload = {
      name, sport,
      date: date || null, startTime: startTime || null,
      endDate: endDate || null, endTime: endTime || null,
      venue, description,
      capacity: capacity ? parseInt(capacity, 10) : null, status, customFields,
      linkedTournamentExternalId: schedule?.linkedTournamentExternalId ?? null,
    }
    try {
      if (schedule) {
        await updateRegistrationSchedule({ data: { ...payload, id: schedule.id } })
      } else {
        await createRegistrationSchedule({ data: payload })
      }
      onSaved()
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save schedule. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))]">
          <h3 className="font-bold">{schedule ? 'Edit Schedule' : 'New Registration Schedule'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Schedule Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Sport</label>
            <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Volleyball"
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Event Date & Time</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                placeholder="Time (optional)"
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">End Date & Time (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Venue</label>
            <input value={venue} onChange={(e) => setVenue(e.target.value)}
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Capacity (optional)</label>
              <input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Unlimited"
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 resize-none focus:outline-none focus:border-blue-500" />
          </div>

          <div className="border-t border-[rgb(var(--border-soft))] pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[rgb(var(--fg))]">Custom Fields</label>
              <button onClick={addField} className="text-xs font-semibold text-blue-500 hover:underline">+ Add field</button>
            </div>
            <div className="space-y-3">
              {customFields.map((f, i) => (
                <div key={f.id} className="p-3 rounded-xl border border-[rgb(var(--border-soft))] space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="Field name (e.g. Jersey Size)"
                      className="flex-1 text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2.5 py-1.5 focus:outline-none focus:border-blue-500" />
                    <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as any })}
                      className="text-xs rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5 focus:outline-none focus:border-blue-500">
                      <option value="text">Text</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    <button onClick={() => removeField(i)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg"><Trash2 size={13} /></button>
                  </div>
                  {f.type === 'dropdown' && (
                    <input value={f.options.join(', ')} onChange={(e) => updateField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Options, comma-separated"
                      className="w-full text-xs rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2.5 py-1.5 focus:outline-none focus:border-blue-500" />
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-[rgb(var(--muted-fg))]">
                    <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> Required
                  </label>
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{saveError}</p>
          )}

          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : schedule ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
