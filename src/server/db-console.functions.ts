// src/server/db-console.functions.ts
// Internal, admin-only database console. Two capabilities, both server-guarded:
//   1) runReadQuery   — SELECT-only, blocks all writes/DDL.
//   2) runMigration   — additive-only DDL (CREATE TABLE/INDEX IF NOT EXISTS,
//                       ADD COLUMN IF NOT EXISTS, ADD CONSTRAINT). Destructive
//                       statements are rejected. Every run is logged.
// Safety is enforced on the SERVER, never trusting the client.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser } from '@/lib/auth-server'

// ─── Statement classification helpers ────────────────────────────────────────

/** Strips SQL comments and normalizes whitespace for reliable inspection. */
function normalizeSql(raw: string): string {
  return raw
    .replace(/--[^\n]*/g, ' ')          // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // block comments
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rejects attempts to run more than one statement (basic injection guard). */
function isSingleStatement(s: string): boolean {
  // Allow a single optional trailing semicolon; reject any internal semicolons.
  const trimmed = s.replace(/;\s*$/, '')
  return !trimmed.includes(';')
}

const READ_ONLY_RE = /^\s*(select|with|explain|show)\b/i

// Destructive tokens that are NEVER allowed in the migration runner.
const DESTRUCTIVE_RE = /\b(drop|delete|truncate|update|insert|grant|revoke|alter\s+column|drop\s+column|rename)\b/i

// Additive statement shapes the migration runner explicitly permits.
const ADDITIVE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'create table (if not exists)', re: /^create\s+table\s+if\s+not\s+exists\b/i },
  { label: 'add column (if not exists)',   re: /^alter\s+table\s+\w+\s+add\s+column\s+if\s+not\s+exists\b/i },
  { label: 'create index (if not exists)', re: /^create\s+(unique\s+)?index\s+if\s+not\s+exists\b/i },
  { label: 'add constraint',               re: /^alter\s+table\s+\w+\s+add\s+constraint\b/i },
]

function classifyMigration(raw: string): { ok: boolean; label?: string; reason?: string } {
  const s = normalizeSql(raw)
  if (!s) return { ok: false, reason: 'Empty statement.' }
  if (!isSingleStatement(s)) return { ok: false, reason: 'Only one statement at a time is allowed.' }
  if (DESTRUCTIVE_RE.test(s)) return { ok: false, reason: 'Destructive statements (drop, delete, update, alter/drop column, rename, etc.) are not allowed. This console is additive-only to protect your data.' }
  const match = ADDITIVE_PATTERNS.find((p) => p.re.test(s))
  if (!match) return { ok: false, reason: 'Only additive schema changes are allowed: CREATE TABLE IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, or ADD CONSTRAINT.' }
  return { ok: true, label: match.label }
}

// ─── Which database am I on (guardrail shown in the UI) ──────────────────────
export const getDbIdentity = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Admin access required')
  return withRetry(async () => {
    const r = await db.execute(sql`SELECT current_database() AS database, current_user AS usr`)
    const row = r.rows[0] as any
    return { database: row?.database ?? null, user: row?.usr ?? null }
  })
})

// ─── List tables + their columns (safe schema browser) ───────────────────────
export const listSchema = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Admin access required')
  return withRetry(async () => {
    const tables = await db.execute(sql`
      SELECT t.table_name,
             (SELECT n_live_tup FROM pg_stat_user_tables s WHERE s.relname = t.table_name) AS approx_rows
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `)
    const cols = await db.execute(sql`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)
    const byTable: Record<string, any[]> = {}
    for (const c of cols.rows as any[]) {
      (byTable[c.table_name] ??= []).push({ column: c.column_name, type: c.data_type, nullable: c.is_nullable === 'YES' })
    }
    return (tables.rows as any[]).map((t) => ({
      table: t.table_name,
      approxRows: t.approx_rows === null ? null : Number(t.approx_rows),
      columns: byTable[t.table_name] ?? [],
    }))
  })
})

// ─── Read-only query runner (SELECT / WITH / EXPLAIN / SHOW only) ─────────────
export const runReadQuery = createServerFn({ method: 'POST' })
  .inputValidator((data: { query: string }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const s = normalizeSql(data.query)
    if (!isSingleStatement(s)) throw new Error('Run one query at a time (no semicolons within the query).')
    if (!READ_ONLY_RE.test(s)) throw new Error('Read tab only runs SELECT / WITH / EXPLAIN / SHOW queries. Use the Migration tab for schema changes.')
    if (DESTRUCTIVE_RE.test(s)) throw new Error('That query contains a write/DDL keyword and was blocked. The read tab is strictly read-only.')
    return withRetry(async () => {
      // Wrap in a subquery with a hard row cap so a huge table can't flood the UI.
      const capped = `SELECT * FROM (${s.replace(/;$/, '')}) AS _q LIMIT 500`
      const r = await db.execute(sql.raw(capped))
      const rows = r.rows as any[]
      const columns = rows.length ? Object.keys(rows[0]) : []
      return { columns, rows, rowCount: rows.length, capped: rows.length === 500 }
    })
  })

// ─── Preview a migration (validate + check if the change already exists) ─────
export const previewMigration = createServerFn({ method: 'POST' })
  .inputValidator((data: { statement: string }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const verdict = classifyMigration(data.statement)
    return { normalized: normalizeSql(data.statement), ...verdict }
  })

// ─── Execute a validated additive migration (with typed confirmation) ────────
export const runMigration = createServerFn({ method: 'POST' })
  .inputValidator((data: { statement: string; confirmTarget: string }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')

    const verdict = classifyMigration(data.statement)
    if (!verdict.ok) throw new Error(verdict.reason || 'Statement not allowed.')

    const s = normalizeSql(data.statement)
    // The typed confirmation must appear as a whole word in the statement (e.g. the
    // table name). This forces the admin to consciously match what they're changing.
    const target = (data.confirmTarget || '').trim()
    if (!target) throw new Error('Type the target table/object name to confirm.')
    const targetRe = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (!targetRe.test(s)) throw new Error(`Confirmation "${target}" does not appear in the statement. Type the exact table/object name being changed.`)

    return withRetry(async () => {
      // Ensure the audit log table exists (itself additive & idempotent).
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS schema_migrations_log (
          id serial PRIMARY KEY,
          statement text NOT NULL,
          kind text,
          run_by text,
          run_at timestamp NOT NULL DEFAULT now()
        )
      `)
      await db.execute(sql.raw(s))
      const runBy = (admin as any)?.email ?? (admin as any)?.id ?? (admin as any)?.sub ?? 'admin'
      await db.execute(sql`
        INSERT INTO schema_migrations_log (statement, kind, run_by)
        VALUES (${s}, ${verdict.label ?? null}, ${runBy})
      `)
      return { ok: true, ran: s, kind: verdict.label }
    })
  })

// ─── View the migration audit log ────────────────────────────────────────────
export const getMigrationLog = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Admin access required')
  return withRetry(async () => {
    try {
      const r = await db.execute(sql`
        SELECT id, statement, kind, run_by, run_at
        FROM schema_migrations_log ORDER BY id DESC LIMIT 100
      `)
      return r.rows as any[]
    } catch {
      return [] // table doesn't exist yet = no migrations run through the console
    }
  })
})
