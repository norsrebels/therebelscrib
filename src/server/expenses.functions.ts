// src/server/expenses.functions.ts
// Flexible expense ledger. An expense may link to a schedule (per-event cost) or
// stand alone (org-wide / recurring). Categories come from a shared list so every
// chart and total reconciles on the same buckets (unify). Reads fail soft so the
// UI works before the migration runs.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser } from '@/lib/auth-server'
import { getStore } from '@netlify/blobs'

// Shared, defined categories — used by the ledger UI now and dashboard charts
// later, so "Equipment" is always the same bucket (no free-text fragmentation).
// Adding a category here needs NO schema change (stored as text) — future-proof.
export const EXPENSE_CATEGORIES = [
  'Equipment',
  'Venue / Court',
  'Referees / Officials',
  'Awards / Trophies',
  'Marketing / Printing',
  'Administrative',
  'Insurance',
  'Transportation',
  'Food / Refreshments',
  'Other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: number
  scheduleId: number | null
  scheduleName: string | null
  category: string
  amount: number
  expenseDate: string | null
  note: string | null
  isRecurring: boolean
  archivedAt: string | null
  receiptKey: string | null
  vendor: string | null
  tin: string | null
  vatStatus: string | null            // 'vatable' | 'non_vat' | null
  taxMeta: any | null                 // raw scan result + detectedBy (future-proof)
  createdBy: string | null
  createdAt: string | null
}

function mapExpense(r: any): Expense {
  return {
    id: Number(r.id),
    scheduleId: r.schedule_id != null ? Number(r.schedule_id) : null,
    scheduleName: r.schedule_name ?? null,
    category: r.category ?? 'Other',
    amount: Number(r.amount ?? 0),
    expenseDate: r.expense_date ? String(r.expense_date).slice(0, 10) : null,
    note: r.note ?? null,
    isRecurring: !!r.is_recurring,
    archivedAt: r.archived_at ? String(r.archived_at) : null,
    receiptKey: r.receipt_key ?? null,
    vendor: r.vendor ?? null,
    tin: r.tin ?? null,
    vatStatus: r.vat_status ?? null,
    taxMeta: r.tax_meta ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ? String(r.created_at) : null,
  }
}

// List expenses. filter: 'all' (default), 'org', or a schedule id.
// view: 'active' (default — archived hidden) or 'archived' (only archived).
export const getExpenses = createServerFn({ method: 'GET' })
  .inputValidator((data: { filter?: 'all' | 'org' | number; view?: 'active' | 'archived' } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const filter = data?.filter ?? 'all'
    const view = data?.view ?? 'active'
    return withRetry(async () => {
      try {
        // archived_at IS NULL → active; NOT NULL → archived.
        const archCond = view === 'archived' ? sql`e.archived_at IS NOT NULL` : sql`e.archived_at IS NULL`
        const base = sql`
          SELECT e.*, s.name AS schedule_name
          FROM expenses e
          LEFT JOIN registration_schedules s ON s.id = e.schedule_id
          WHERE ${archCond}
        `
        let rows
        if (filter === 'org') {
          rows = await db.execute(sql`${base} AND e.schedule_id IS NULL ORDER BY e.expense_date DESC NULLS LAST, e.id DESC`)
        } else if (typeof filter === 'number') {
          rows = await db.execute(sql`${base} AND e.schedule_id = ${filter} ORDER BY e.expense_date DESC NULLS LAST, e.id DESC`)
        } else {
          rows = await db.execute(sql`${base} ORDER BY e.expense_date DESC NULLS LAST, e.id DESC`)
        }
        return (rows.rows as any[]).map(mapExpense)
      } catch {
        // Fallback for a DB where archived_at doesn't exist yet: ignore the view.
        try {
          const rows = await db.execute(sql`
            SELECT e.*, s.name AS schedule_name
            FROM expenses e LEFT JOIN registration_schedules s ON s.id = e.schedule_id
            ORDER BY e.expense_date DESC NULLS LAST, e.id DESC
          `)
          return (rows.rows as any[]).map(mapExpense)
        } catch { return [] }
      }
    })
  })

export const addExpense = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    scheduleId: number | null
    category: string
    amount: number
    expenseDate?: string | null
    note?: string | null
    isRecurring?: boolean
    receiptKey?: string | null
    vendor?: string | null
    tin?: string | null
    vatStatus?: string | null
    taxMeta?: any | null
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const amount = Number(data.amount)
    if (!isFinite(amount) || amount < 0) throw new Error('Enter a valid amount')
    const createdBy = (admin as any)?.email ?? (admin as any)?.id ?? 'admin'
    const dateVal = data.expenseDate && data.expenseDate.trim() ? data.expenseDate : null
    const vat = data.vatStatus === 'vatable' || data.vatStatus === 'non_vat' ? data.vatStatus : null
    return withRetry(async () => {
      // Try the full insert (with receipt/tax columns); fall back to the base
      // columns if the migration hasn't been run yet — the ledger still works.
      try {
        await db.execute(sql`
          INSERT INTO expenses (schedule_id, category, amount, expense_date, note, is_recurring, receipt_key, vendor, tin, vat_status, tax_meta, created_by)
          VALUES (
            ${data.scheduleId ?? null}, ${data.category || 'Other'}, ${amount}, ${dateVal}::date,
            ${data.note ?? null}, ${data.isRecurring ?? false},
            ${data.receiptKey ?? null}, ${data.vendor ?? null}, ${data.tin ?? null}, ${vat},
            ${data.taxMeta ? JSON.stringify(data.taxMeta) : null}::jsonb, ${createdBy}
          )
        `)
      } catch {
        await db.execute(sql`
          INSERT INTO expenses (schedule_id, category, amount, expense_date, note, is_recurring, created_by)
          VALUES (
            ${data.scheduleId ?? null}, ${data.category || 'Other'}, ${amount}, ${dateVal}::date,
            ${data.note ?? null}, ${data.isRecurring ?? false}, ${createdBy}
          )
        `)
      }
      return { ok: true }
    })
  })

// Update an existing expense (including receipt/tax fields). Fail-soft on new cols.
export const updateExpense = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    id: number
    scheduleId: number | null
    category: string
    amount: number
    expenseDate?: string | null
    note?: string | null
    isRecurring?: boolean
    receiptKey?: string | null
    vendor?: string | null
    tin?: string | null
    vatStatus?: string | null
    taxMeta?: any | null
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const amount = Number(data.amount)
    if (!isFinite(amount) || amount < 0) throw new Error('Enter a valid amount')
    const dateVal = data.expenseDate && data.expenseDate.trim() ? data.expenseDate : null
    const vat = data.vatStatus === 'vatable' || data.vatStatus === 'non_vat' ? data.vatStatus : null
    return withRetry(async () => {
      try {
        await db.execute(sql`
          UPDATE expenses SET
            schedule_id = ${data.scheduleId ?? null}, category = ${data.category || 'Other'},
            amount = ${amount}, expense_date = ${dateVal}::date, note = ${data.note ?? null},
            is_recurring = ${data.isRecurring ?? false}, receipt_key = ${data.receiptKey ?? null},
            vendor = ${data.vendor ?? null}, tin = ${data.tin ?? null}, vat_status = ${vat},
            tax_meta = ${data.taxMeta ? JSON.stringify(data.taxMeta) : null}::jsonb
          WHERE id = ${data.id}
        `)
      } catch {
        await db.execute(sql`
          UPDATE expenses SET
            schedule_id = ${data.scheduleId ?? null}, category = ${data.category || 'Other'},
            amount = ${amount}, expense_date = ${dateVal}::date, note = ${data.note ?? null},
            is_recurring = ${data.isRecurring ?? false}
          WHERE id = ${data.id}
        `)
      }
      return { ok: true }
    })
  })

// Archive (soft) or unarchive an expense. Archiving hides it from the active
// ledger and totals but KEEPS the record — financial history is never lost.
export const setExpenseArchived = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; archived: boolean }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      if (data.archived) {
        await db.execute(sql`UPDATE expenses SET archived_at = now() WHERE id = ${data.id}`)
      } else {
        await db.execute(sql`UPDATE expenses SET archived_at = NULL WHERE id = ${data.id}`)
      }
      return { ok: true }
    })
  })

// Permanent delete — kept for genuine mistakes only. The UI routes normal removal
// through archiving; this is a deliberate, separate action.
export const deleteExpense = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      await db.execute(sql`DELETE FROM expenses WHERE id = ${data.id}`)
      return { ok: true }
    })
  })

// ─── Receipt image upload (Netlify Blobs, mirrors the gallery store) ──────────
// Stores the image and returns a key. The image is served back via /api/receipt/$id.
export const uploadExpenseReceipt = createServerFn({ method: 'POST' })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const file = formData.get('image') as File
    if (!file || !(file instanceof File) || file.size === 0) throw new Error('No image provided')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const key = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const store = getStore('expense-receipts')
    const buffer = await file.arrayBuffer()
    await store.set(key, buffer, { metadata: { contentType: file.type || 'image/jpeg' } })
    return { key }
  })

// ─── AI receipt scan (Gemini vision) ──────────────────────────────────────────
// Sends the receipt image to Gemini and asks for structured fields. This SUGGESTS
// values for the admin to review — it never saves anything on its own. Fails soft:
// if the key is missing or the call errors, the caller keeps manual entry.
export const scanReceipt = createServerFn({ method: 'POST' })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const file = formData.get('image') as File
    if (!file || !(file instanceof File) || file.size === 0) throw new Error('No image provided')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Receipt scanning is unavailable (GEMINI_API_KEY not set).')
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const instruction = [
      'You are reading a Philippine sales receipt / official receipt image.',
      'Extract these fields and return STRICT JSON ONLY (no markdown, no prose):',
      '{',
      '  "vendor": string|null,        // seller / store name',
      '  "tin": string|null,           // Tax Identification Number, digits/dashes as printed',
      '  "amount": number|null,        // grand total amount as a number, no currency symbol',
      '  "date": string|null,          // ISO yyyy-mm-dd if determinable, else null',
      '  "vatStatus": "vatable"|"non_vat"|null, // "vatable" if VAT-registered / shows 12% VAT / "VAT Reg TIN"; "non_vat" if marked NON-VAT / VAT-EXEMPT; null if unclear',
      '  "confidence": "high"|"medium"|"low"',
      '}',
      'If a field is not clearly present, use null. Do not guess the TIN.',
    ].join('\n')

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: instruction },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      generationConfig: { maxOutputTokens: 512, temperature: 0 },
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Receipt scan failed (${res.status}): ${err.slice(0, 200)}`)
    }
    const dataJson = await res.json()
    const text = dataJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    // Strip any accidental code fences, then parse.
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    let parsed: any = {}
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to locate the first {...} block.
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { parsed = {} } }
    }
    return {
      vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
      tin: typeof parsed.tin === 'string' ? parsed.tin : null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : (parsed.amount ? Number(parsed.amount) || null : null),
      date: typeof parsed.date === 'string' ? parsed.date : null,
      vatStatus: parsed.vatStatus === 'vatable' || parsed.vatStatus === 'non_vat' ? parsed.vatStatus : null,
      confidence: parsed.confidence ?? 'low',
      raw: parsed,
    }
  })
