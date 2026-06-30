import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getActiveRegistrationSchedules,
  submitRegistration,
  type RegistrationSchedule,
} from '@/server/registration.functions'
import { Calendar, MapPin, Users, User, UsersRound, Check, AlertTriangle, ChevronDown } from 'lucide-react'

export const Route = createFileRoute('/registration')({
  component: RegistrationPage,
})

type RegType = 'individual' | 'team' | 'group'

function formatDate(d: string | null): string {
  if (!d) return 'Date TBA'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function RegistrationPage() {
  const [schedules, setSchedules] = useState<RegistrationSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RegistrationSchedule | null>(null)

  const [regType, setRegType] = useState<RegType>('individual')
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [roster, setRoster] = useState<string[]>(['', '', '', '', ''])
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ waitlisted: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getActiveRegistrationSchedules()
      .then((s) => { setSchedules(s); if (s.length === 1) setSelected(s[0]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selected) {
      const defaults: Record<string, any> = {}
      selected.customFields.forEach((f) => { defaults[f.id] = f.defaultValue })
      setCustomAnswers(defaults)
    }
  }, [selected])

  const updateRoster = (i: number, v: string) => {
    const next = [...roster]; next[i] = v; setRoster(next)
  }
  const addRosterSlot = () => setRoster([...roster, ''])
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
    if (regType !== 'individual' && !teamName.trim()) { setError(`Please enter your ${regType} name.`); return }

    setSubmitting(true)
    try {
      const res = await submitRegistration({
        data: {
          scheduleId: selected.id,
          regType,
          name,
          teamName,
          roster: regType === 'individual' ? [] : roster.filter((r) => r.trim()),
          contactNumber,
          email,
          customAnswers,
        },
      })
      setResult({ waitlisted: res.waitlisted })
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
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
                  <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(s.date)}</span>
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
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
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
                      <input value={member} onChange={(e) => updateRoster(i, e.target.value)}
                        placeholder={`Member ${i + 1}`}
                        className="flex-1 text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Contact Number</label>
              <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2.5 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
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

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>
      )}
    </div>
  )
}
