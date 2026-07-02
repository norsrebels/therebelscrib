import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getRegistrationDbDiagnostic } from '@/server/registration.functions'

export const Route = createFileRoute('/admin-db-check')({
  component: AdminDbCheckPage,
})

function AdminDbCheckPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRegistrationDbDiagnostic()
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load diagnostic'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Database Diagnostic</h1>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">
        Shows exactly which database the live app is connected to, and what it contains — read directly
        from the app's own connection (the same one registrations use).
      </p>

      {loading && <p className="text-sm text-[rgb(var(--muted-fg))]">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {data && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgb(var(--border-soft))] p-4">
            <p className="text-xs font-bold text-[rgb(var(--muted-fg))] mb-1">App is connected to database</p>
            <p className="font-mono text-sm">{data.database}</p>
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-1">user: {data.dbUser}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[rgb(var(--border-soft))] p-4 text-center">
              <p className="text-3xl font-bold">{data.scheduleCount}</p>
              <p className="text-xs text-[rgb(var(--muted-fg))]">schedules in this DB</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--border-soft))] p-4 text-center">
              <p className="text-3xl font-bold">{data.registrationCount}</p>
              <p className="text-xs text-[rgb(var(--muted-fg))]">registrations in this DB</p>
            </div>
          </div>

          <div className="rounded-xl border border-[rgb(var(--border-soft))] p-4">
            <p className="text-xs font-bold text-[rgb(var(--muted-fg))] mb-2">Schedules the app can see</p>
            {data.schedules.length === 0 ? (
              <p className="text-sm text-[rgb(var(--muted-fg))]">None. If the form still shows a schedule, that's stale/cached client state, not the database.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {data.schedules.map((s: any) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-[rgb(var(--surface-hover))] px-1.5 py-0.5 rounded">id {s.id}</span>
                    {s.name} <span className="text-[rgb(var(--muted-fg))]">· {s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-[rgb(var(--muted-fg))]">
            Compare the database name above with what your Neon SQL editor is connected to. If they differ,
            the app and your SQL editor are pointing at different databases/branches.
          </p>
        </div>
      )}
    </div>
  )
}
