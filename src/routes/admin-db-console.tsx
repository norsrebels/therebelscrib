import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Database, Play, ShieldCheck, AlertTriangle, Table2, History, Trash2 } from 'lucide-react'
import {
  getDbIdentity, listSchema, runReadQuery,
  previewMigration, runMigration, getMigrationLog,
  previewDestructive, runDestructive,
} from '@/server/db-console.functions'

export const Route = createFileRoute('/admin-db-console')({
  component: DbConsolePage,
})

type Tab = 'browse' | 'read' | 'migrate' | 'danger'

function DbConsolePage() {
  const [tab, setTab] = useState<Tab>('browse')
  const [identity, setIdentity] = useState<{ database: string; user: string } | null>(null)

  useEffect(() => { getDbIdentity().then(setIdentity).catch(() => {}) }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Database size={20} />
        <h1 className="text-2xl font-bold">Database Console</h1>
      </div>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-4">
        Admin-only. Read queries are SELECT-only; migrations are additive-only (no drops, deletes, or type changes).
      </p>

      {identity && (
        <div className="mb-5 rounded-xl border border-[rgb(var(--border-soft))] px-4 py-2.5 flex items-center gap-2 text-sm">
          <ShieldCheck size={15} className="text-green-500" />
          Connected to <span className="font-mono font-bold">{identity.database}</span>
          <span className="text-[rgb(var(--muted-fg))]">· {identity.user}</span>
        </div>
      )}

      <div className="flex gap-1 mb-5 border-b border-[rgb(var(--border-soft))]">
        {([['browse', 'Browse', Table2], ['read', 'Read Query', Play], ['migrate', 'Migrate', ShieldCheck], ['danger', 'Danger', Trash2]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-[rgb(var(--muted-fg))] hover:text-[rgb(var(--fg))]'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'browse' && <BrowseTab />}
      {tab === 'read' && <ReadTab />}
      {tab === 'migrate' && <MigrateTab />}
      {tab === 'danger' && <DangerTab />}
    </div>
  )
}

function BrowseTab() {
  const [schema, setSchema] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => { listSchema().then(setSchema).finally(() => setLoading(false)) }, [])
  if (loading) return <p className="text-sm text-[rgb(var(--muted-fg))]">Loading schema…</p>

  return (
    <div className="space-y-2">
      {schema.map((t) => (
        <div key={t.table} className="rounded-xl border border-[rgb(var(--border-soft))]">
          <button onClick={() => setOpen(open === t.table ? null : t.table)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left">
            <span className="font-mono text-sm font-bold">{t.table}</span>
            <span className="text-[11px] text-[rgb(var(--muted-fg))]">{t.approxRows ?? '—'} rows · {t.columns.length} cols</span>
          </button>
          {open === t.table && (
            <div className="px-4 pb-3 border-t border-[rgb(var(--border-soft))] pt-2">
              {t.columns.map((c: any) => (
                <div key={c.column} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="font-mono">{c.column}</span>
                  <span className="text-[rgb(var(--muted-fg))]">{c.type}{c.nullable ? '' : ' · not null'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ReadTab() {
  const [query, setQuery] = useState('SELECT id, name, status FROM registration_schedules ORDER BY id;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true); setError(''); setResult(null)
    try { setResult(await runReadQuery({ data: { query } })) }
    catch (e: any) { setError(e?.message || 'Query failed') }
    setRunning(false)
  }

  return (
    <div className="space-y-3">
      <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={4}
        className="w-full font-mono text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
      <button onClick={run} disabled={running}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
        <Play size={14} /> {running ? 'Running…' : 'Run Query'}
      </button>
      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      {result && (
        <div>
          <p className="text-[11px] text-[rgb(var(--muted-fg))] mb-1">{result.rowCount} rows{result.capped ? ' (capped at 500)' : ''}</p>
          <div className="overflow-x-auto rounded-xl border border-[rgb(var(--border-soft))]">
            <table className="w-full text-xs">
              <thead><tr className="bg-[rgb(var(--surface-hover))] text-left">
                {result.columns.map((c: string) => <th key={c} className="px-3 py-2 font-bold">{c}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[rgb(var(--border-soft))]">
                {result.rows.map((row: any, i: number) => (
                  <tr key={i}>
                    {result.columns.map((c: string) => <td key={c} className="px-3 py-1.5 font-mono">{formatCell(row[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MigrateTab() {
  const [statement, setStatement] = useState('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS example_col text;')
  const [preview, setPreview] = useState<any>(null)
  const [confirmTarget, setConfirmTarget] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<any[]>([])

  const loadLog = () => getMigrationLog().then(setLog).catch(() => {})
  useEffect(() => { loadLog() }, [])

  const doPreview = async () => {
    setError(''); setSuccess(''); setPreview(null)
    try { setPreview(await previewMigration({ data: { statement } })) }
    catch (e: any) { setError(e?.message || 'Preview failed') }
  }

  const doRun = async () => {
    setBusy(true); setError(''); setSuccess('')
    try {
      const res = await runMigration({ data: { statement, confirmTarget } })
      setSuccess(`Applied: ${res.kind ?? 'migration'}`)
      setConfirmTarget(''); setPreview(null); loadLog()
    } catch (e: any) { setError(e?.message || 'Migration failed') }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 flex items-start gap-2">
        <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-[rgb(var(--fg))]">
          Additive-only: <span className="font-bold">CREATE TABLE / ADD COLUMN / CREATE INDEX (IF NOT EXISTS), ADD CONSTRAINT</span>.
          Drops, deletes, updates, renames, and type changes are blocked to protect your data.
        </p>
      </div>

      <textarea value={statement} onChange={(e) => { setStatement(e.target.value); setPreview(null) }} rows={3}
        className="w-full font-mono text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />

      <button onClick={doPreview}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold border border-[rgb(var(--border-soft))] hover:border-blue-500">
        Preview
      </button>

      {preview && (
        <div className={`rounded-xl border px-4 py-3 ${preview.ok ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
          {preview.ok ? (
            <>
              <p className="text-sm font-bold text-green-600 flex items-center gap-1.5"><ShieldCheck size={14} /> Allowed · {preview.label}</p>
              <p className="text-xs font-mono mt-2 text-[rgb(var(--muted-fg))]">{preview.normalized}</p>
              <div className="mt-3 pt-3 border-t border-[rgb(var(--border-soft))]">
                <label className="text-xs font-bold block mb-1">Type the target table/object name to confirm:</label>
                <input value={confirmTarget} onChange={(e) => setConfirmTarget(e.target.value)}
                  placeholder="e.g. registrations"
                  className="w-full font-mono text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
                <button onClick={doRun} disabled={busy || !confirmTarget.trim()}
                  className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
                  <ShieldCheck size={14} /> {busy ? 'Applying…' : 'Apply Migration'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-red-500 flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5" /> {preview.reason}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-2">{success}</p>}

      <div className="pt-4">
        <p className="text-xs font-bold text-[rgb(var(--muted-fg))] flex items-center gap-1.5 mb-2"><History size={13} /> Migration history</p>
        {log.length === 0 ? (
          <p className="text-xs text-[rgb(var(--muted-fg))]">No migrations run through the console yet.</p>
        ) : (
          <div className="space-y-1">
            {log.map((m) => (
              <div key={m.id} className="text-[11px] rounded-lg border border-[rgb(var(--border-soft))] px-3 py-1.5">
                <span className="font-mono">{m.statement}</span>
                <span className="text-[rgb(var(--muted-fg))]"> · {m.run_by} · {new Date(m.run_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DangerTab() {
  const [statement, setStatement] = useState('DELETE FROM registrations WHERE id = 0;')
  const [preview, setPreview] = useState<any>(null)
  const [password, setPassword] = useState('')
  const [confirmTarget, setConfirmTarget] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const doPreview = async () => {
    setError(''); setSuccess(''); setPreview(null)
    try { setPreview(await previewDestructive({ data: { statement } })) }
    catch (e: any) { setError(e?.message || 'Preview failed') }
  }

  const doRun = async () => {
    setBusy(true); setError(''); setSuccess('')
    try {
      const res = await runDestructive({ data: { statement, password, confirmTarget } })
      setSuccess(`Executed: ${res.kind}`)
      setPassword(''); setConfirmTarget(''); setPreview(null)
    } catch (e: any) { setError(e?.message || 'Execution failed') }
    setBusy(false)
  }

  const wholeTable = preview?.ok && preview?.wholeTable

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-3 flex items-start gap-2">
        <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
        <div className="text-xs text-[rgb(var(--fg))]">
          <p className="font-bold text-red-500 mb-0.5">Destructive zone — changes here can permanently delete data.</p>
          <p>Every run requires your password. Whole-table operations require typing the table name. There is no undo. Preview the blast radius before running.</p>
        </div>
      </div>

      <textarea value={statement} onChange={(e) => { setStatement(e.target.value); setPreview(null) }} rows={3}
        className="w-full font-mono text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-red-500" />

      <button onClick={doPreview}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold border border-[rgb(var(--border-soft))] hover:border-red-500">
        Preview Blast Radius
      </button>

      {preview && (
        <div className={`rounded-xl border px-4 py-3 ${preview.ok ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          {preview.ok ? (
            <>
              <p className="text-sm font-bold flex items-center gap-1.5"><AlertTriangle size={14} className="text-red-500" /> {preview.kind}{preview.table ? ` · ${preview.table}` : ''}</p>
              <p className="text-xs font-mono mt-2 text-[rgb(var(--muted-fg))]">{preview.normalized}</p>
              {preview.affectedRows !== null && (
                <p className="text-sm font-bold mt-2 text-red-500">
                  This will affect approximately {preview.affectedRows} row{preview.affectedRows === 1 ? '' : 's'}.
                </p>
              )}
              {wholeTable && (
                <p className="text-xs font-bold mt-2 text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                  ⚠ WHOLE-TABLE operation — affects the entire "{preview.table}" table. Type the table name below to confirm.
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-[rgb(var(--border-soft))] space-y-2">
                {wholeTable && (
                  <div>
                    <label className="text-xs font-bold block mb-1">Type the table name to confirm whole-table {preview.kind}:</label>
                    <input value={confirmTarget} onChange={(e) => setConfirmTarget(e.target.value)}
                      placeholder={preview.table}
                      className="w-full font-mono text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-red-500" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold block mb-1">Your admin password:</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-red-500" />
                </div>
                <button onClick={doRun} disabled={busy || !password || (wholeTable && !confirmTarget.trim())}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
                  <Trash2 size={14} /> {busy ? 'Executing…' : 'Run Destructive Statement'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-600 flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5" /> {preview.reason}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-2">{success}</p>}
    </div>
  )
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
