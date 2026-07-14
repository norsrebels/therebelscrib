import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-client'
import { Wallet, Plus, Building2, CalendarDays, Repeat, Archive, ArchiveRestore, Trash2, Upload, ScanLine, X, FileText, ShieldCheck } from 'lucide-react'
import { getExpenses, addExpense, setExpenseArchived, deleteExpense, uploadExpenseReceipt, scanReceipt, EXPENSE_CATEGORIES, type Expense } from '@/server/expenses.functions'
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
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // Add-form state.
  const [fScheduleId, setFScheduleId] = useState<number | null>(null)
  const [fCategory, setFCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState('')
  const [fNote, setFNote] = useState('')
  const [fRecurring, setFRecurring] = useState(false)
  const [fVendor, setFVendor] = useState('')
  const [fTin, setFTin] = useState('')
  const [fVat, setFVat] = useState<'' | 'vatable' | 'non_vat'>('')
  const [fReceiptKey, setFReceiptKey] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  const resetForm = () => {
    setFAmount(''); setFNote(''); setFDate(''); setFRecurring(false)
    setFVendor(''); setFTin(''); setFVat(''); setFReceiptKey(null)
    setReceiptPreview(null); setScanNote('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // Upload the chosen image to Blobs AND scan it in one go, then pre-fill the form.
  const handleFile = async (file: File) => {
    if (!file) return
    setReceiptPreview(URL.createObjectURL(file))
    setScanNote(''); setMsg('')
    // 1) store the image
    setBusy(true)
    try {
      const fd = new FormData(); fd.append('image', file)
      const up = await uploadExpenseReceipt({ data: fd })
      setFReceiptKey(up.key)
    } catch (e: any) {
      setMsg('Image upload failed: ' + (e?.message || 'unknown'))
    } finally { setBusy(false) }
    // 2) scan it (suggests values — admin reviews)
    setScanning(true)
    try {
      const fd2 = new FormData(); fd2.append('image', file)
      const s = await scanReceipt({ data: fd2 })
      if (s.vendor) setFVendor(s.vendor)
      if (s.tin) setFTin(s.tin)
      if (s.amount != null) setFAmount(String(s.amount))
      if (s.date) setFDate(s.date)
      if (s.vatStatus) setFVat(s.vatStatus)
      setScanNote(`Scanned (confidence: ${s.confidence}). Please review before saving.`)
    } catch (e: any) {
      setScanNote('Auto-scan unavailable — enter details manually. (' + (e?.message || '') + ')')
    } finally { setScanning(false) }
  }

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
        receiptKey: fReceiptKey,
        vendor: fVendor || null,
        tin: fTin || null,
        vatStatus: fVat || null,
        taxMeta: scanNote ? { scannedNote: scanNote } : null,
      } })
      resetForm()
      setMsg('Expense added')
      load()
    } catch (e: any) { setMsg(e?.message || 'Failed to add') }
    finally { setBusy(false) }
  }

  const handleArchive = async (id: number, archived: boolean) => {
    try {
      await setExpenseArchived({ data: { id, archived } })
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch { /* non-fatal */ }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteExpense({ data: { id } })
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      setConfirmDelete(null)
    } catch { setMsg('Delete failed') }
  }

  const vatBadge = (v: string | null) => {
    if (v === 'vatable') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500">VATABLE</span>
    if (v === 'non_vat') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">NON-VAT</span>
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><Wallet size={22} /> Expense Ledger</h1>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">All club costs in one place — tie an expense to a schedule, or log it as org-wide. Upload a receipt to auto-fill the details.</p>

      {/* Add form */}
      <div className="rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] p-4 mb-6">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-1"><Plus size={14} /> Add expense</h2>

        {/* Receipt upload + scan */}
        <div className="mb-3 rounded-lg border border-dashed border-[rgb(var(--border-soft))] p-3 flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          {receiptPreview ? (
            <div className="relative">
              <img src={receiptPreview} alt="Receipt preview" className="h-16 w-16 object-cover rounded-lg border border-[rgb(var(--border-soft))]" />
              <button onClick={resetForm} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5" title="Remove"><X size={11} /></button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] flex items-center justify-center text-[rgb(var(--muted-fg))]"><FileText size={20} /></div>
          )}
          <div className="flex-1 min-w-[160px]">
            <button onClick={() => fileRef.current?.click()} disabled={busy || scanning}
              className="flex items-center gap-1.5 text-xs font-bold border border-[rgb(var(--border-soft))] rounded-lg px-3 py-1.5 hover:bg-[rgb(var(--surface-hover))] disabled:opacity-50">
              {scanning ? <><ScanLine size={13} className="animate-pulse" /> Scanning receipt…</> : <><Upload size={13} /> Upload / scan receipt</>}
            </button>
            {scanNote && <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1 flex items-center gap-1"><ScanLine size={10} /> {scanNote}</p>}
            {!scanNote && <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1">Photo of a receipt → auto-fills vendor, TIN, VAT status, amount, date.</p>}
          </div>
        </div>

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
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Vendor / store</label>
            <input value={fVendor} onChange={(e) => setFVendor(e.target.value)} placeholder="e.g. Toby's Sports"
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">TIN</label>
            <input value={fTin} onChange={(e) => setFTin(e.target.value)} placeholder="000-000-000-000"
              className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2" />
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
          <div>
            <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] block mb-1">VAT status</label>
            <div className="flex gap-1.5">
              {([['', 'Unset'], ['vatable', 'Vatable'], ['non_vat', 'Non-VAT']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setFVat(v)}
                  className={`flex-1 text-xs font-bold px-2 py-2 rounded-lg border ${fVat === v ? 'border-[rgb(var(--accent-500))] bg-[rgb(var(--accent-500))]/10 text-[rgb(var(--accent-600))]' : 'border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>{l}</button>
              ))}
            </div>
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
          <button onClick={handleAdd} disabled={busy || scanning}
            className="bg-[rgb(var(--accent-500))] hover:opacity-90 text-white rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50">
            {busy ? 'Saving…' : 'Add expense'}
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
              {e.receiptKey && (
                <a href={`/api/receipt/${e.receiptKey}`} target="_blank" rel="noopener noreferrer" title="View receipt"
                  className="shrink-0 h-11 w-11 rounded-lg overflow-hidden border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] flex items-center justify-center">
                  <img src={`/api/receipt/${e.receiptKey}`} alt="Receipt" className="h-full w-full object-cover" />
                </a>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{e.category}</span>
                  {e.isRecurring && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[rgb(var(--muted-fg))]/15 text-[rgb(var(--muted-fg))]">RECURRING</span>}
                  {vatBadge(e.vatStatus)}
                  <span className="text-[11px] text-[rgb(var(--muted-fg))] flex items-center gap-1">
                    {e.scheduleName ? <><CalendarDays size={11} /> {e.scheduleName}</> : <><Building2 size={11} /> Org-wide</>}
                  </span>
                </div>
                {(e.vendor || e.tin) && (
                  <p className="text-[11px] text-[rgb(var(--muted-fg))] truncate flex items-center gap-1">
                    {e.vendor && <span className="font-bold text-[rgb(var(--fg))]">{e.vendor}</span>}
                    {e.tin && <span className="flex items-center gap-0.5"><ShieldCheck size={10} /> TIN {e.tin}</span>}
                  </p>
                )}
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
              <button onClick={() => setConfirmDelete(e.id)} title="Delete permanently"
                className="text-red-500 hover:bg-red-500/10 rounded p-1.5 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))
        )}
      </div>

      {/* Delete confirm dialog */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border-soft))] p-5 max-w-sm w-full" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5 text-red-500"><Trash2 size={15} /> Delete permanently?</h3>
            <p className="text-xs text-[rgb(var(--muted-fg))] mb-4">This removes the expense and cannot be undone. To keep the record instead, use Archive.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="text-xs font-bold px-4 py-2 rounded-lg border border-[rgb(var(--border-soft))]">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="text-xs font-bold px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
