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

// Percent change of current vs previous. Returns null when there's no prior base
// (so the UI can show "—" rather than a misleading +100%).
function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return cur > 0 ? null : 0
  return Math.round(((cur - prev) / prev) * 100)
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

    // ─── Per-venue analytics: events, registrations, and collected revenue ───
    // Groups on the schedule's venue name (now consistent via the managed list),
    // so per-venue numbers are reliable. Blank venues are excluded.
    const byVenue = await safe(async () => {
      const r = await db.execute(sql`
        SELECT trim(s.venue) AS venue,
               COUNT(DISTINCT s.id)::int AS events,
               COUNT(r.id) FILTER (WHERE r.status != 'cancelled')::int AS registrations,
               COALESCE(SUM(r.amount_paid) FILTER (WHERE r.status != 'cancelled'), 0)::numeric AS collected
        FROM registration_schedules s
        LEFT JOIN registrations r ON r.schedule_id = s.id
        WHERE s.venue IS NOT NULL AND trim(s.venue) <> ''
        GROUP BY trim(s.venue)
        ORDER BY registrations DESC
        LIMIT 15
      `)
      return r.rows as any[]
    }, [])

    // ─── Per-schedule profitability: collected revenue − its OWN linked expenses ─
    // Subqueries keep revenue and expenses independent (a LEFT JOIN across both
    // would multiply rows). Active expenses only. This is the payoff of linking
    // expenses to schedules — profit per event, not just whole-club net.
    const perSchedule = await safe(async () => {
      const r = await db.execute(sql`
        SELECT s.id, s.name,
          COALESCE((SELECT SUM(amount_paid) FROM registrations WHERE schedule_id = s.id AND status != 'cancelled'), 0)::numeric AS collected,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE schedule_id = s.id AND archived_at IS NULL), 0)::numeric AS expenses
        FROM registration_schedules s
        ORDER BY collected DESC
        LIMIT 15
      `)
      return r.rows as any[]
    }, [])

    // ─── New vs returning participants by month (PROVISIONAL) ─────────────────
    // Uses the same identity key as unique_participants: COALESCE(email, phone, name).
    // "First seen" = the participant's earliest registration month. This is an
    // ESTIMATE until player identity is unified (a real players table).
    const newVsReturning = await safe(async () => {
      const r = await db.execute(sql`
        WITH keyed AS (
          SELECT COALESCE(email, contact_number, name) AS pkey,
                 date_trunc('month', created_at) AS m
          FROM registrations
          WHERE status != 'cancelled' AND COALESCE(email, contact_number, name) IS NOT NULL
        ),
        firsts AS (SELECT pkey, MIN(m) AS first_m FROM keyed GROUP BY pkey)
        SELECT to_char(k.m, 'YYYY-MM') AS month,
               COUNT(DISTINCT k.pkey) FILTER (WHERE k.m = f.first_m)::int AS new_players,
               COUNT(DISTINCT k.pkey) FILTER (WHERE k.m > f.first_m)::int AS returning_players
        FROM keyed k JOIN firsts f ON f.pkey = k.pkey
        WHERE k.m >= date_trunc('month', now() - interval '12 months')
        GROUP BY k.m ORDER BY k.m
      `)
      return r.rows as any[]
    }, [])

    // Retention: of participants active in the previous 90 days before the last 90,
    // what % returned in the last 90 days. Provisional (same identity key).
    const retention = await safe(async () => {
      const r = await db.execute(sql`
        WITH keyed AS (
          SELECT COALESCE(email, contact_number, name) AS pkey, created_at
          FROM registrations
          WHERE status != 'cancelled' AND COALESCE(email, contact_number, name) IS NOT NULL
        ),
        prior AS (SELECT DISTINCT pkey FROM keyed WHERE created_at >= now() - interval '180 days' AND created_at < now() - interval '90 days'),
        recent AS (SELECT DISTINCT pkey FROM keyed WHERE created_at >= now() - interval '90 days')
        SELECT (SELECT COUNT(*) FROM prior)::int AS prior_count,
               (SELECT COUNT(*) FROM prior p WHERE EXISTS (SELECT 1 FROM recent rc WHERE rc.pkey = p.pkey))::int AS returned_count
      `)
      return r.rows[0] as any
    }, { prior_count: 0, returned_count: 0 })

    // Trend deltas: last 30 days vs the 30 days before, for registrations + collected.
    const trend = await safe(async () => {
      const r = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS reg_cur,
          COUNT(*) FILTER (WHERE created_at < now() - interval '30 days' AND created_at >= now() - interval '60 days')::int AS reg_prev,
          COALESCE(SUM(amount_paid) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::numeric AS cash_cur,
          COALESCE(SUM(amount_paid) FILTER (WHERE created_at < now() - interval '30 days' AND created_at >= now() - interval '60 days'), 0)::numeric AS cash_prev
        FROM registrations WHERE status != 'cancelled'
      `)
      return r.rows[0] as any
    }, { reg_cur: 0, reg_prev: 0, cash_cur: 0, cash_prev: 0 })

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

    // ─── Expenses: total + by category + by month (ACTIVE only, from the ledger) ─
    // Reads the new `expenses` table; archived_at IS NULL = active. Falls back to
    // the older schedule_expenses table if the ledger isn't deployed yet.
    const expenseTotal = await safe(async () => {
      try {
        const r = await db.execute(sql`SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM expenses WHERE archived_at IS NULL`)
        return Number((r.rows[0] as any)?.total ?? 0)
      } catch {
        const r = await db.execute(sql`SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM schedule_expenses`)
        return Number((r.rows[0] as any)?.total ?? 0)
      }
    }, 0)

    const expenseByCategory = await safe(async () => {
      try {
        const r = await db.execute(sql`
          SELECT category, COALESCE(SUM(amount), 0)::numeric AS total
          FROM expenses WHERE archived_at IS NULL GROUP BY category ORDER BY total DESC
        `)
        return r.rows as any[]
      } catch {
        const r = await db.execute(sql`
          SELECT category, COALESCE(SUM(amount), 0)::numeric AS total
          FROM schedule_expenses GROUP BY category ORDER BY total DESC
        `)
        return r.rows as any[]
      }
    }, [])

    const expenseByMonth = await safe(async () => {
      try {
        const r = await db.execute(sql`
          SELECT to_char(date_trunc('month', COALESCE(expense_date, created_at::date)), 'YYYY-MM') AS month,
                 COALESCE(SUM(amount), 0)::numeric AS total
          FROM expenses
          WHERE archived_at IS NULL AND COALESCE(expense_date, created_at::date) >= (now() - interval '12 months')::date
          GROUP BY 1 ORDER BY 1
        `)
        return r.rows as any[]
      } catch {
        const r = await db.execute(sql`
          SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                 COALESCE(SUM(amount), 0)::numeric AS total
          FROM schedule_expenses
          WHERE created_at >= now() - interval '12 months'
          GROUP BY 1 ORDER BY 1
        `)
        return r.rows as any[]
      }
    }, [])

    // ─── Cash flow (collected revenue vs expenses) at three granularities ─────
    // One helper builds a revenue+expense series bucketed by week / month / year,
    // so the dashboard chart can switch grain on click without extra round-trips.
    // Windows: 12 weeks / 12 months / 5 years — enough context without clutter.
    const cashFlowSeries = async (grain: 'week' | 'month' | 'year') => {
      const fmt = grain === 'week' ? 'IYYY-"W"IW' : grain === 'year' ? 'YYYY' : 'YYYY-MM'
      const window = grain === 'week' ? sql`interval '12 weeks'` : grain === 'year' ? sql`interval '5 years'` : sql`interval '12 months'`
      const rev = await safe(async () => {
        const r = await db.execute(sql`
          SELECT to_char(date_trunc(${grain}, created_at), ${fmt}) AS bucket,
                 COALESCE(SUM(amount_paid), 0)::numeric AS collected
          FROM registrations
          WHERE status != 'cancelled' AND created_at >= now() - ${window}
          GROUP BY 1
        `)
        return r.rows as any[]
      }, [])
      const exp = await safe(async () => {
        try {
          const r = await db.execute(sql`
            SELECT to_char(date_trunc(${grain}, COALESCE(expense_date, created_at::date)), ${fmt}) AS bucket,
                   COALESCE(SUM(amount), 0)::numeric AS expenses
            FROM expenses
            WHERE archived_at IS NULL AND COALESCE(expense_date, created_at::date) >= (now() - ${window})::date
            GROUP BY 1
          `)
          return r.rows as any[]
        } catch { return [] }
      }, [])
      // Merge revenue + expenses on the bucket label, filling gaps with 0.
      const map: Record<string, { period: string; collected: number; expenses: number }> = {}
      for (const row of rev) map[row.bucket] = { period: row.bucket, collected: Number(row.collected), expenses: 0 }
      for (const row of exp) {
        map[row.bucket] = map[row.bucket] || { period: row.bucket, collected: 0, expenses: 0 }
        map[row.bucket].expenses = Number(row.expenses)
      }
      return Object.values(map)
        .map((v) => ({ ...v, net: Number((v.collected - v.expenses).toFixed(2)) }))
        .sort((a, b) => a.period.localeCompare(b.period))
    }
    const cashFlow = {
      week: await cashFlowSeries('week'),
      month: await cashFlowSeries('month'),
      year: await cashFlowSeries('year'),
    }

    // ─── Outstanding aging: unpaid balance bucketed by how old the registration is ─
    const aging = await safe(async () => {
      const r = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN created_at >= now() - interval '30 days'  THEN amount_due - amount_paid ELSE 0 END), 0)::numeric AS d0_30,
          COALESCE(SUM(CASE WHEN created_at <  now() - interval '30 days'  AND created_at >= now() - interval '60 days' THEN amount_due - amount_paid ELSE 0 END), 0)::numeric AS d31_60,
          COALESCE(SUM(CASE WHEN created_at <  now() - interval '60 days'  AND created_at >= now() - interval '90 days' THEN amount_due - amount_paid ELSE 0 END), 0)::numeric AS d61_90,
          COALESCE(SUM(CASE WHEN created_at <  now() - interval '90 days'  THEN amount_due - amount_paid ELSE 0 END), 0)::numeric AS d90_plus
        FROM registrations
        WHERE status != 'cancelled' AND amount_due > amount_paid
      `)
      return r.rows[0] as any
    }, { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 })

    const expected = Number(finance.expected ?? 0)
    const collected = Number(finance.collected ?? 0)
    const uniqueParticipants = Number(counts.unique_participants ?? 0)
    const netCollected = Number((collected - expenseTotal).toFixed(2))

    return {
      counts: {
        totalRegistrations: Number(counts.total_registrations ?? 0),
        activeSchedules: Number(counts.active_schedules ?? 0),
        uniqueParticipants,
      },
      byMonth: byMonth.map((m) => ({ month: m.month, count: Number(m.count) })),
      bySchedule: bySchedule.map((s) => ({
        name: s.name,
        registrations: Number(s.registrations),
        capacity: s.capacity != null ? Number(s.capacity) : null,
        fillRate: s.capacity ? Math.round((Number(s.registrations) / Number(s.capacity)) * 100) : null,
      })),
      byType: byType.map((t) => ({ type: t.reg_type, count: Number(t.count) })),
      byVenue: byVenue.map((v) => ({
        venue: v.venue,
        events: Number(v.events),
        registrations: Number(v.registrations),
        collected: Number(v.collected),
      })),
      perSchedule: perSchedule.map((s) => {
        const collected = Number(s.collected)
        const expenses = Number(s.expenses)
        return { name: s.name, collected, expenses, net: Number((collected - expenses).toFixed(2)) }
      }),
      newVsReturning: newVsReturning.map((m) => ({
        month: m.month,
        newPlayers: Number(m.new_players),
        returningPlayers: Number(m.returning_players),
      })),
      retention: {
        priorCount: Number(retention.prior_count ?? 0),
        returnedCount: Number(retention.returned_count ?? 0),
        rate: Number(retention.prior_count) > 0
          ? Math.round((Number(retention.returned_count) / Number(retention.prior_count)) * 100)
          : 0,
      },
      trend: {
        regCur: Number(trend.reg_cur ?? 0),
        regPrev: Number(trend.reg_prev ?? 0),
        regDelta: pctDelta(Number(trend.reg_cur), Number(trend.reg_prev)),
        cashCur: Number(trend.cash_cur ?? 0),
        cashPrev: Number(trend.cash_prev ?? 0),
        cashDelta: pctDelta(Number(trend.cash_cur), Number(trend.cash_prev)),
      },
      byPosition: byPosition.map((p) => ({ position: p.position, count: Number(p.count) })),
      finance: {
        expected,
        collected,
        outstanding: Number((expected - collected).toFixed(2)),
        collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
        paidCount: Number(finance.paid_count ?? 0),
        partialCount: Number(finance.partial_count ?? 0),
        unpaidCount: Number(finance.unpaid_count ?? 0),
        expenses: expenseTotal,
        // Net uses COLLECTED (actual cash in) minus expenses — true profit on hand.
        net: netCollected,
        netExpected: Number((expected - expenseTotal).toFixed(2)),
        // ── Financial-depth metrics ──
        // Net margin = profit as a % of collected revenue (profitability, not raw net).
        netMargin: collected > 0 ? Math.round((netCollected / collected) * 100) : 0,
        // Unit economics per unique participant.
        revenuePerParticipant: uniqueParticipants > 0 ? Number((collected / uniqueParticipants).toFixed(2)) : 0,
        costPerParticipant: uniqueParticipants > 0 ? Number((expenseTotal / uniqueParticipants).toFixed(2)) : 0,
        netPerParticipant: uniqueParticipants > 0 ? Number((netCollected / uniqueParticipants).toFixed(2)) : 0,
        // Break-even: expenses recovered as a % of collected (100%+ = profitable).
        breakEvenPct: expenseTotal > 0 ? Math.round((collected / expenseTotal) * 100) : (collected > 0 ? 100 : 0),
      },
      aging: {
        d0_30: Number(aging.d0_30 ?? 0),
        d31_60: Number(aging.d31_60 ?? 0),
        d61_90: Number(aging.d61_90 ?? 0),
        d90_plus: Number(aging.d90_plus ?? 0),
      },
      expenseByCategory: expenseByCategory.map((e) => ({ category: e.category, total: Number(e.total) })),
      expenseByMonth: expenseByMonth.map((e) => ({ month: e.month, total: Number(e.total) })),
      cashFlow,
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
