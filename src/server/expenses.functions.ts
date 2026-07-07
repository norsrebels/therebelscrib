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
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const amount = Number(data.amount)
    if (!isFinite(amount) || amount < 0) throw new Error('Enter a valid amount')
    const createdBy = (admin as any)?.email ?? (admin as any)?.id ?? 'admin'
    const dateVal = data.expenseDate && data.expenseDate.trim() ? data.expenseDate : null
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO expenses (schedule_id, category, amount, expense_date, note, is_recurring, created_by)
        VALUES (
          ${data.scheduleId ?? null},
          ${data.category || 'Other'},
          ${amount},
          ${dateVal}::date,
          ${data.note ?? null},
          ${data.isRecurring ?? false},
          ${createdBy}
        )
      `)
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
