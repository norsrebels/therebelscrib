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

// ═══════════════════════════════════════════════════════════════════════════
// DESTRUCTIVE OPERATIONS (owner-gated, password re-auth + safety rails)
// Enabled deliberately by the owner. Full DELETE/UPDATE/DROP/ALTER, but every
// run requires: (1) live re-authentication with the admin password, (2) blast-
// radius preview, (3) a no-WHERE guard that forces explicit table confirmation
// for whole-table wipes, and (4) an audit log entry. These rails prevent the
// catastrophic accidental case without limiting genuine intent.
// ═══════════════════════════════════════════════════════════════════════════

// Detects the destructive statement class and whether it's a "whole-table" hit.
function classifyDestructive(raw: string): {
  ok: boolean; kind?: string; wholeTable?: boolean; table?: string; reason?: string
} {
  const s = normalizeSql(raw)
  if (!s) return { ok: false, reason: 'Empty statement.' }
  if (!isSingleStatement(s)) return { ok: false, reason: 'Only one statement at a time is allowed.' }

  // DELETE without WHERE = whole-table wipe.
  let m = s.match(/^delete\s+from\s+"?(\w+)"?(\s+where\b)?/i)
  if (m) return { ok: true, kind: 'delete', table: m[1], wholeTable: !m[2] }

  // UPDATE without WHERE = whole-table change.
  m = s.match(/^update\s+"?(\w+)"?\s+set\b(.*)$/i)
  if (m) return { ok: true, kind: 'update', table: m[1], wholeTable: !/\bwhere\b/i.test(m[2]) }

  m = s.match(/^drop\s+table\s+(if\s+exists\s+)?"?(\w+)"?/i)
  if (m) return { ok: true, kind: 'drop table', table: m[2], wholeTable: true }

  m = s.match(/^truncate\s+"?(\w+)"?/i)
  if (m) return { ok: true, kind: 'truncate', table: m[1], wholeTable: true }

  m = s.match(/^alter\s+table\s+"?(\w+)"?\s+(drop\s+column|alter\s+column|rename)/i)
  if (m) return { ok: true, kind: 'alter table', table: m[1], wholeTable: false }

  m = s.match(/^drop\s+(index|constraint|view)\s+/i)
  if (m) return { ok: true, kind: 'drop ' + m[1].toLowerCase(), wholeTable: false }

  return { ok: false, reason: 'Not a recognized destructive statement. For additive changes use the Migrate tab; for reads use the Read tab.' }
}

// Preview: classify + estimate the blast radius (how many rows this will hit).
export const previewDestructive = createServerFn({ method: 'POST' })
  .inputValidator((data: { statement: string }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const verdict = classifyDestructive(data.statement)
    if (!verdict.ok) return { ...verdict, normalized: normalizeSql(data.statement), affectedRows: null as number | null }

    let affectedRows: number | null = null
    // For DELETE/UPDATE, run the equivalent COUNT so the admin sees the blast radius.
    try {
      const s = normalizeSql(data.statement)
      if (verdict.kind === 'delete') {
        const whereClause = s.replace(/^delete\s+from\s+"?\w+"?\s*/i, '')
        const countSql = `SELECT COUNT(*)::int AS n FROM ${verdict.table} ${whereClause}`.trim()
        const r = await db.execute(sql.raw(countSql))
        affectedRows = Number((r.rows[0] as any)?.n ?? 0)
      } else if (verdict.kind === 'update') {
        const whereMatch = s.match(/\bwhere\b(.*)$/i)
        const countSql = `SELECT COUNT(*)::int AS n FROM ${verdict.table} ${whereMatch ? 'WHERE ' + whereMatch[1] : ''}`.trim()
        const r = await db.execute(sql.raw(countSql))
        affectedRows = Number((r.rows[0] as any)?.n ?? 0)
      } else if (verdict.kind === 'truncate' || verdict.kind === 'drop table') {
        const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${verdict.table}`))
        affectedRows = Number((r.rows[0] as any)?.n ?? 0)
      }
    } catch {
      affectedRows = null // couldn't estimate (e.g. object doesn't exist) — non-fatal
    }
    return { ...verdict, normalized: normalizeSql(data.statement), affectedRows }
  })

// Re-authenticate against Netlify Identity with the admin's own password.
async function reauthenticate(email: string, password: string): Promise<boolean> {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || ''
  if (!siteUrl) throw new Error('Cannot determine site URL for re-authentication.')
  try {
    const res = await fetch(`${siteUrl}/.netlify/identity/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', username: email, password }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Execute a destructive statement — requires password re-auth + confirmation.
export const runDestructive = createServerFn({ method: 'POST' })
  .inputValidator((data: { statement: string; password: string; confirmTarget: string }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')

    const verdict = classifyDestructive(data.statement)
    if (!verdict.ok) throw new Error(verdict.reason || 'Statement not allowed.')

    // Rail 1: whole-table wipes require typing the exact table name to confirm.
    if (verdict.wholeTable) {
      if (!verdict.table) throw new Error('This affects an entire table but the table name could not be parsed. Aborting for safety.')
      if ((data.confirmTarget || '').trim().toLowerCase() !== verdict.table.toLowerCase()) {
        throw new Error(`This will affect the ENTIRE "${verdict.table}" table. Type the table name "${verdict.table}" to confirm you intend a whole-table ${verdict.kind}.`)
      }
    }

    // Rail 2: password re-authentication (live, against your real login).
    const email = (admin as any)?.email
    if (!email) throw new Error('Could not resolve your account email for re-authentication.')
    if (!data.password) throw new Error('Password required to run a destructive statement.')
    const ok = await reauthenticate(email, data.password)
    if (!ok) throw new Error('Password re-authentication failed. Destructive statement not run.')

    const s = normalizeSql(data.statement)
    return withRetry(async () => {
      // Ensure the audit log exists (additive/idempotent).
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS schema_migrations_log (
          id serial PRIMARY KEY, statement text NOT NULL, kind text,
          run_by text, run_at timestamp NOT NULL DEFAULT now()
        )
      `)
      const runBy = (admin as any)?.email ?? (admin as any)?.id ?? 'admin'
      await db.execute(sql.raw(s))
      // Rail 3: log every destructive action, tagged so it's distinguishable.
      await db.execute(sql`
        INSERT INTO schema_migrations_log (statement, kind, run_by)
        VALUES (${s}, ${'DESTRUCTIVE:' + (verdict.kind ?? 'unknown')}, ${runBy})
      `)
      return { ok: true, ran: s, kind: verdict.kind }
    })
  })
