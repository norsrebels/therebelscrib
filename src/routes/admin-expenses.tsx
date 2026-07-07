import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-client'
import { Wallet, Plus, Building2, CalendarDays, Repeat, Archive, ArchiveRestore } from 'lucide-react'
import { getExpenses, addExpense, setExpenseArchived, EXPENSE_CATEGORIES, type Expense } from '@/server/expenses.functions'
import { getAllRegistrationSchedules } from '@/server/registration.functions'

export const Route = createFileRoute('/admin-expenses')({
  component: ExpensesLedgerPage,
})

interface ScheduleLite { id: number; name: string }

function ExpensesLedgerPage() {
  const { isAdmin, loading } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [schedules, setSchedules] = useState<ScheduleLite[]>([])
  const [filter, setFilter] = useState<'all' | 'org' | number>('all')
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Add-form state.
  const [fScheduleId, setFScheduleId] = useState<number | null>(null)
  const [fCategory, setFCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState('')
  const [fNote, setFNote] = useState('')
  const [fRecurring, setFRecurring] = useState(false)

  const load = useCallback(async () => {
    try { setExpenses(await getExpenses({ data: { filter, view } })) } catch { setExpenses([]) }
  }, [filter, view])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])
  useEffect(() => {
    if (!isAdmin) return
    getAllRegistrationSchedules()
      .then((rows: any[]) => setSchedules(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setSchedules([]))
  }, [isAdmin])

  if (loading) return <div className="p-8 text-center text-[rgb(var(--muted-fg))]">Loading…</div>
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-[rgb(var(--muted-fg))]">Sign in as an admin to manage expenses.</p>
        </div>
      </div>
    )
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const money = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleAdd = async () => {
    const amount = Number(fAmount)
    if (!isFinite(amount) || amount <= 0) { setMsg('Enter a valid amount'); return }
    setBusy(true); setMsg('')
    try {
      await addExpense({ data: {
        scheduleId: fScheduleId,
        category: fCategory,
        amount,
        expenseDate: fDate || null,
        note: fNote || null,
        isRecurring: fRecurring,
      } })
      setFAmount(''); setFNote(''); setFDate(''); setFRecurring(false)
      setMsg('Expense added')
      load()
    } catch (e: any) { setMsg(e?.message || 'Failed to add') }
    finally { setBusy(false) }
  }

  const handleArchive = async (id: number, archived: boolean) => {
    try {
      await setExpenseArchived({ data: { id, archived } })
      setExpenses((prev) => prev.filter((e) => e.id !== id)) // leaves the current view
    } catch { /* non-fatal */ }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><Wallet size={22} /> Expense Ledger</h1>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">All club costs in one place — tie an expense to a schedule, or log it as org-wide.</p>

      {/* Add form */}
      <div className="rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] p-4 mb-6">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-1"><Plus size={14} /> Add expense</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Schedule (optional)</label>
            <select value={fScheduleId ?? ''} onChange={(e) => setFScheduleId(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2">
              <option value="">Org-wide (no schedule)</option>
              {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Category</label>
            <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Amount</label>
            <input type="number" min="0" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="0.00"
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Date</label>
            <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Note (optional)</label>
            <input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="e.g. 12 game balls"
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-xs font-bold text-[rgb(var(--muted-fg))] cursor-pointer">
            <input type="checkbox" checked={fRecurring} onChange={(e) => setFRecurring(e.target.checked)} className="accent-[rgb(var(--accent-500))]" />
            <Repeat size={12} /> Recurring cost
          </label>
          <button onClick={handleAdd} disabled={busy}
            className="bg-[rgb(var(--accent-500))] hover:opacity-90 text-white rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50">
            {busy ? 'Adding…' : 'Add expense'}
          </button>
        </div>
        {msg && <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-2">{msg}</p>}
      </div>

      {/* Filter + total */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap items-center">
          {([['active', 'Active'], ['archived', 'Archived']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${view === v ? 'border-[rgb(var(--accent-500))] bg-[rgb(var(--accent-500))]/10 text-[rgb(var(--accent-600))]' : 'border-[rgb(var(--border-soft))]'}`}>{l}</button>
          ))}
          <span className="w-px h-5 bg-[rgb(var(--border-soft))] mx-1" />
          {([['all', 'All'], ['org', 'Org-wide']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${filter === v ? 'border-[rgb(var(--accent-500))] bg-[rgb(var(--accent-500))]/10 text-[rgb(var(--accent-600))]' : 'border-[rgb(var(--border-soft))]'}`}>{l}</button>
          ))}
          <select value={typeof filter === 'number' ? filter : ''} onChange={(e) => setFilter(e.target.value ? Number(e.target.value) : 'all')}
            className="text-[11px] font-bold rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5">
            <option value="">By schedule…</option>
            {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="text-sm font-bold">{view === 'archived' ? 'Archived' : 'Active'} total: <span className="text-[rgb(var(--accent-600))]">{money(total)}</span></div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-[rgb(var(--border-soft))] overflow-hidden">
        {expenses.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted-fg))] text-center py-10">No expenses yet.</p>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--border-soft))] last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{e.category}</span>
                  {e.isRecurring && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[rgb(var(--muted-fg))]/15 text-[rgb(var(--muted-fg))]">RECURRING</span>}
                  <span className="text-[11px] text-[rgb(var(--muted-fg))] flex items-center gap-1">
                    {e.scheduleName ? <><CalendarDays size={11} /> {e.scheduleName}</> : <><Building2 size={11} /> Org-wide</>}
                  </span>
                </div>
                {(e.note || e.expenseDate) && (
                  <p className="text-[11px] text-[rgb(var(--muted-fg))] truncate">
                    {e.expenseDate ? e.expenseDate : ''}{e.note ? (e.expenseDate ? ' · ' : '') + e.note : ''}
                  </p>
                )}
              </div>
              <div className="font-bold text-sm shrink-0">{money(e.amount)}</div>
              {view === 'active' ? (
                <button onClick={() => handleArchive(e.id, true)} title="Archive (keeps the record)"
                  className="text-[rgb(var(--muted-fg))] hover:bg-[rgb(var(--muted-fg))]/10 rounded p-1.5 shrink-0"><Archive size={14} /></button>
              ) : (
                <button onClick={() => handleArchive(e.id, false)} title="Unarchive"
                  className="text-[rgb(var(--accent-600))] hover:bg-[rgb(var(--accent-500))]/10 rounded p-1.5 shrink-0"><ArchiveRestore size={14} /></button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
