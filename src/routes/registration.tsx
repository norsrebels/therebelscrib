import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getActiveRegistrationSchedules,
  submitRegistration,
  type RegistrationSchedule,
  type RosterMember,
} from '@/server/registration.functions'
import { Calendar, MapPin, Users, User, UsersRound, Check, AlertTriangle, ChevronDown } from 'lucide-react'

export const Route = createFileRoute('/registration')({
  component: RegistrationPage,
})

type RegType = 'individual' | 'team' | 'group'

// Canonical position codes — same set used across roster, player-dex, and the
// leaderboard, so a registered position always matches what the rest of the app
// recognizes (OS/OPP/MB/S/L), never a free-typed variant.
const POSITION_OPTIONS = [
  { code: 'OS', label: 'Open Spiker' },
  { code: 'OPP', label: 'Opposite Spiker' },
  { code: 'MB', label: 'Middle Blocker' },
  { code: 'S', label: 'Setter' },
  { code: 'L', label: 'Libero' },
]

// Both inputs are plain text now: date is 'YYYY-MM-DD', time is 'HH:mm'.
// We parse the date parts manually (no Date string parsing / timezone surprises)
// and only format for display.
function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return ''
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${period}`
}

function formatScheduleWhen(date: string | null | undefined, time: string | null | undefined): string {
  if (!date) return 'Date TBA'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return 'Date TBA'
  const dt = new Date(y, m - 1, d)
  if (isNaN(dt.getTime())) return 'Date TBA'
  let out = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const t = formatTime(time)
  if (t) out += ` • ${t}`
  return out
}

function RegistrationPage() {
  const [schedules, setSchedules] = useState<RegistrationSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RegistrationSchedule | null>(null)

  const [regType, setRegType] = useState<RegType>('individual')
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [teamName, setTeamName] = useState('')
  const [roster, setRoster] = useState<RosterMember[]>([
    { name: '', position: '' }, { name: '', position: '' }, { name: '', position: '' },
    { name: '', position: '' }, { name: '', position: '' },
  ])
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ waitlisted: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getActiveRegistrationSchedules()
      .then((s) => {
        setSchedules(s)
        // Deep link: ?schedule=ID pre-selects that schedule (from a QR code).
        let preselectId: number | null = null
        if (typeof window !== 'undefined') {
          const p = new URLSearchParams(window.location.search).get('schedule')
          if (p) preselectId = parseInt(p, 10)
        }
        const match = preselectId ? s.find((x) => x.id === preselectId) : null
        if (match) setSelected(match)
        else if (s.length === 1) setSelected(s[0])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selected) {
      const defaults: Record<string, any> = {}
      selected.customFields.forEach((f) => { defaults[f.id] = f.defaultValue })
      setCustomAnswers(defaults)
    }
  }, [selected])

  const updateRosterName = (i: number, v: string) => {
    const next = [...roster]; next[i] = { ...next[i], name: v }; setRoster(next)
  }
  const updateRosterPosition = (i: number, v: string) => {
    const next = [...roster]; next[i] = { ...next[i], position: v }; setRoster(next)
  }
  const addRosterSlot = () => setRoster([...roster, { name: '', position: '' }])
  const removeRosterSlot = (i: number) => setRoster(roster.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')

    for (const f of selected.customFields) {
      if (f.required && !customAnswers[f.id]) {
        setError(`"${f.name}" is required.`)
        return
      }
    }
    if (regType === 'individual' && !name.trim()) { setError('Please enter your name.'); return }
    if (regType === 'individual' && !position) { setError('Please select your position.'); return }
    if (regType !== 'individual' && !teamName.trim()) { setError(`Please enter your ${regType} name.`); return }

    setSubmitting(true)
    try {
      const res = await submitRegistration({
        data: {
          scheduleId: selected.id,
          regType,
          name,
          position,
          teamName,
          roster: regType === 'individual' ? [] : roster.filter((r) => r.name.trim()),
          contactNumber,
          email,
          facebookUrl,
          customAnswers,
        },
      })
      setResult({ waitlisted: res.waitlisted })
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
      // If the chosen schedule is gone (e.g. deleted since the page loaded),
      // refresh the list and drop the stale selection so the user can pick again
      // rather than repeatedly hitting the same dead schedule.
      const msg = String(err?.message ?? '')
      if (msg.includes('no longer available') || msg.includes('foreign key') || msg.includes('23503')) {
        try {
          const fresh = await getActiveRegistrationSchedules()
          setSchedules(fresh)
          if (selected && !fresh.some((x) => x.id === selected.id)) {
            setSelected(null)
          }
        } catch {
          /* leave the error message in place if refresh also fails */
        }
      }
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-[rgb(var(--muted-fg))]">Loading…</div>
  }

  if (result) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${result.waitlisted ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
          {result.waitlisted ? <AlertTriangle size={28} /> : <Check size={28} />}
        </div>
        <h2 className="text-xl font-bold mb-2">{result.waitlisted ? "You're on the waitlist" : 'Registration received!'}</h2>
        <p className="text-sm text-[rgb(var(--muted-fg))]">
          {result.waitlisted
            ? "This schedule is at capacity, so you've been placed on the waitlist. We'll reach out if a spot opens up."
            : "We've got your submission. An admin will review and confirm it shortly."}
        </p>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Calendar size={32} className="mx-auto text-[rgb(var(--muted-fg))] opacity-40 mb-3" />
        <h2 className="text-lg font-bold mb-1">No open registrations</h2>
        <p className="text-sm text-[rgb(var(--muted-fg))]">Check back later for upcoming tournaments.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Player Registration</h1>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">Pick a schedule and submit your details below.</p>

      {/* Schedule picker */}
      <div className="grid gap-3 mb-6">
        {schedules.map((s) => (
          <button key={s.id} onClick={() => setSelected(s)}
            className={`text-left p-4 rounded-xl border transition-colors ${
              selected?.id === s.id ? 'border-blue-500 bg-blue-500/5' : 'border-[rgb(var(--border-soft))] hover:border-blue-500/40'
            }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{s.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-[rgb(var(--muted-fg))]">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {formatScheduleWhen(s.date, s.startTime)}</span>
                  {s.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {s.venue}</span>}
                </div>
              </div>
              {s.capacity !== null && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[rgb(var(--surface-hover))] text-[rgb(var(--muted-fg))] shrink-0">
                  {s.registrationCount ?? 0}/{s.capacity}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <form onSubmit={handleSubmit} className="space-y-5 bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl p-5">
          {/* Registration type */}
          <div>
            <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Registration Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'individual', icon: User, label: 'Individual' },
                { v: 'team', icon: Users, label: 'Team' },
                { v: 'group', icon: UsersRound, label: 'Group' },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button key={v} type="button" onClick={() => setRegType(v)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold border transition-colors ${
                    regType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:border-blue-500'
                  }`}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          {regType === 'individual' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Position</label>
                <div className="relative">
                  <select value={position} onChange={(e) => setPosition(e.target.value)} required
                    className="w-full appearance-none text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 pr-9 focus:outline-none focus:border-blue-500">
                    <option value="">Select…</option>
                    {POSITION_OPTIONS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">{regType === 'team' ? 'Team' : 'Group'} Name</label>
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} required
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Roster</label>
                <div className="space-y-2">
                  {roster.map((member, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={member.name} onChange={(e) => updateRosterName(i, e.target.value)}
                        placeholder={`Member ${i + 1}`}
                        className="flex-1 text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
                      <div className="relative w-36">
                        <select value={member.position} onChange={(e) => updateRosterPosition(i, e.target.value)}
                          className="w-full appearance-none text-xs rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2.5 py-2 pr-7 focus:outline-none focus:border-blue-500">
                          <option value="">Position…</option>
                          {POSITION_OPTIONS.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" />
                      </div>
                      {roster.length > 1 && (
                        <button type="button" onClick={() => removeRosterSlot(i)} className="text-[rgb(var(--muted-fg))] hover:text-red-500 text-xs px-2">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addRosterSlot} className="mt-2 text-xs font-semibold text-blue-500 hover:underline">+ Add member</button>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-[rgb(var(--border-soft))]">
            <p className="text-xs font-bold text-[rgb(var(--fg))] mb-2">Contact Details</p>
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mb-3">
              Please provide at least one way to reach you (contact number, email, or Facebook).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Contact Number <span className="font-normal opacity-70">(optional)</span></label>
                <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
                  inputMode="tel"
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Email <span className="font-normal opacity-70">(optional)</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Facebook Profile URL <span className="font-normal opacity-70">(optional)</span></label>
              <input type="url" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/your.profile"
                inputMode="url"
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Dynamic custom fields */}
          {selected.customFields.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-[rgb(var(--border-soft))]">
              {selected.customFields.map((f) => (
                <div key={f.id}>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">
                    {f.name} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'text' && (
                    <input value={customAnswers[f.id] ?? ''} onChange={(e) => setCustomAnswers({ ...customAnswers, [f.id]: e.target.value })}
                      className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
                  )}
                  {f.type === 'dropdown' && (
                    <div className="relative">
                      <select value={customAnswers[f.id] ?? ''} onChange={(e) => setCustomAnswers({ ...customAnswers, [f.id]: e.target.value })}
                        className="w-full appearance-none text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 pr-9 focus:outline-none focus:border-blue-500">
                        <option value="">Select…</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-fg))]" />
                    </div>
                  )}
                  {f.type === 'checkbox' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!customAnswers[f.id]} onChange={(e) => setCustomAnswers({ ...customAnswers, [f.id]: e.target.checked })} />
                      Yes
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="rounded-xl bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] px-4 py-3">
            <p className="text-[11px] leading-relaxed text-[rgb(var(--muted-fg))]">
              <span className="font-bold text-[rgb(var(--fg))]">Data Privacy Notice.</span>{' '}
              The information you provide is collected solely to process and manage your registration
              for this event within the Rebels Volleyball Club registration database. It will not be
              sold, shared with third parties, or used for any purpose beyond club registration and
              event coordination. By submitting, you consent to this use of your details.
            </p>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>
      )}
    </div>
  )
}
