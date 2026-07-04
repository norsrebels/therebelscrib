// src/server/dashboard.functions.ts
// Executive dashboard aggregations. One call returns every metric the overview
// needs, computed in the database (not the client) for efficiency and a single
// source of truth. All reads fail soft so the dashboard renders even if some
// tables/columns aren't present yet.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser } from '@/lib/auth-server'

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

export const getExecutiveDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Admin access required')

  return withRetry(async () => {
    // ─── Headline counts ─────────────────────────────────────────────────────
    const counts = await safe(async () => {
      const r = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM registrations WHERE status != 'cancelled')::int AS total_registrations,
          (SELECT COUNT(*) FROM registration_schedules WHERE status = 'active')::int AS active_schedules,
          (SELECT COUNT(DISTINCT COALESCE(email, contact_number, name)) FROM registrations WHERE status != 'cancelled')::int AS unique_participants
      `)
      return r.rows[0] as any
    }, { total_registrations: 0, active_schedules: 0, unique_participants: 0 })

    // ─── Registrations by month (last 12 months) ─────────────────────────────
    const byMonth = await safe(async () => {
      const r = await db.execute(sql`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM registrations
        WHERE status != 'cancelled' AND created_at >= now() - interval '12 months'
        GROUP BY 1 ORDER BY 1
      `)
      return r.rows as any[]
    }, [])

    // ─── Registrations + fill rate per schedule ──────────────────────────────
    const bySchedule = await safe(async () => {
      const r = await db.execute(sql`
        SELECT s.id, s.name, s.capacity,
               COUNT(r.id) FILTER (WHERE r.status != 'cancelled')::int AS registrations
        FROM registration_schedules s
        LEFT JOIN registrations r ON r.schedule_id = s.id
        WHERE s.status = 'active'
        GROUP BY s.id, s.name, s.capacity
        ORDER BY registrations DESC
        LIMIT 15
      `)
      return r.rows as any[]
    }, [])

    // ─── Registration type mix ───────────────────────────────────────────────
    const byType = await safe(async () => {
      const r = await db.execute(sql`
        SELECT reg_type, COUNT(*)::int AS count
        FROM registrations WHERE status != 'cancelled'
        GROUP BY reg_type
      `)
      return r.rows as any[]
    }, [])

    // ─── Position distribution (individual + roster members) ─────────────────
    const byPosition = await safe(async () => {
      const r = await db.execute(sql`
        SELECT position, COUNT(*)::int AS count FROM (
          SELECT position FROM registrations
            WHERE status != 'cancelled' AND reg_type = 'individual' AND position IS NOT NULL
          UNION ALL
          SELECT (m->>'position') AS position FROM registrations,
            jsonb_array_elements(roster) AS m
            WHERE status != 'cancelled' AND m->>'position' IS NOT NULL AND m->>'position' != ''
        ) p
        GROUP BY position ORDER BY count DESC
      `)
      return r.rows as any[]
    }, [])

    // ─── Finance: expected / collected / outstanding ─────────────────────────
    const finance = await safe(async () => {
      const r = await db.execute(sql`
        SELECT
          COALESCE(SUM(amount_due), 0)::numeric  AS expected,
          COALESCE(SUM(amount_paid), 0)::numeric AS collected,
          COUNT(*) FILTER (WHERE payment_status = 'paid')::int          AS paid_count,
          COUNT(*) FILTER (WHERE payment_status = 'partially_paid')::int AS partial_count,
          COUNT(*) FILTER (WHERE payment_status = 'unpaid' AND amount_due > 0)::int AS unpaid_count
        FROM registrations WHERE status != 'cancelled'
      `)
      return r.rows[0] as any
    }, { expected: 0, collected: 0, paid_count: 0, partial_count: 0, unpaid_count: 0 })

    // ─── Revenue (expected) by month ─────────────────────────────────────────
    const revenueByMonth = await safe(async () => {
      const r = await db.execute(sql`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COALESCE(SUM(amount_due), 0)::numeric  AS expected,
               COALESCE(SUM(amount_paid), 0)::numeric AS collected
        FROM registrations
        WHERE status != 'cancelled' AND created_at >= now() - interval '12 months'
        GROUP BY 1 ORDER BY 1
      `)
      return r.rows as any[]
    }, [])

    // ─── Community breakdown (registrations per community via tags) ──────────
    const byCommunity = await safe(async () => {
      const r = await db.execute(sql`
        SELECT c.name, c.color_primary,
               COUNT(r.id) FILTER (WHERE r.status != 'cancelled')::int AS registrations
        FROM communities c
        JOIN schedule_communities sc ON sc.community_id = c.id
        LEFT JOIN registrations r ON r.schedule_id = sc.schedule_id
        GROUP BY c.id, c.name, c.color_primary
        HAVING COUNT(r.id) > 0
        ORDER BY registrations DESC
      `)
      return r.rows as any[]
    }, [])

    const expected = Number(finance.expected ?? 0)
    const collected = Number(finance.collected ?? 0)

    return {
      counts: {
        totalRegistrations: Number(counts.total_registrations ?? 0),
        activeSchedules: Number(counts.active_schedules ?? 0),
        uniqueParticipants: Number(counts.unique_participants ?? 0),
      },
      byMonth: byMonth.map((m) => ({ month: m.month, count: Number(m.count) })),
      bySchedule: bySchedule.map((s) => ({
        name: s.name,
        registrations: Number(s.registrations),
        capacity: s.capacity != null ? Number(s.capacity) : null,
        fillRate: s.capacity ? Math.round((Number(s.registrations) / Number(s.capacity)) * 100) : null,
      })),
      byType: byType.map((t) => ({ type: t.reg_type, count: Number(t.count) })),
      byPosition: byPosition.map((p) => ({ position: p.position, count: Number(p.count) })),
      finance: {
        expected,
        collected,
        outstanding: Number((expected - collected).toFixed(2)),
        collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
        paidCount: Number(finance.paid_count ?? 0),
        partialCount: Number(finance.partial_count ?? 0),
        unpaidCount: Number(finance.unpaid_count ?? 0),
      },
      revenueByMonth: revenueByMonth.map((m) => ({
        month: m.month,
        expected: Number(m.expected),
        collected: Number(m.collected),
      })),
      byCommunity: byCommunity.map((c) => ({
        name: c.name,
        color: c.color_primary ?? '#1e3a8a',
        registrations: Number(c.registrations),
      })),
    }
  })
})
