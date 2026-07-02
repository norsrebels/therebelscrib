// src/server/registration.functions.ts
// Player registration system. Schedules define a signup window (with optional
// admin-defined dynamic custom fields); registrations are individual/team/group
// submissions against a schedule, reviewed via a pending -> confirmed/cancelled/
// waitlisted workflow. Everything lives in Neon so registrations are visible to
// every admin/device immediately — no client-only storage.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser, getStatIdentity } from '@/lib/auth-server'

export interface CustomFieldDefinition {
  id: string
  name: string
  type: 'text' | 'dropdown' | 'checkbox'
  options: string[]
  required: boolean
  defaultValue: any
}

export interface RegistrationSchedule {
  id: number
  name: string
  sport: string
  date: string | null        // 'YYYY-MM-DD' plain text
  startTime: string | null   // 'HH:mm' plain text
  endDate: string | null
  endTime: string | null
  venue: string | null
  description: string | null
  status: 'active' | 'closed' | 'archived'
  capacity: number | null
  customFields: CustomFieldDefinition[]
  linkedTournamentExternalId: string | null
  createdAt: string
  registrationCount?: number
}

export interface RosterMember {
  name: string
  position: string  // OS | OPP | MB | S | L
}

export interface Registration {
  id: number
  scheduleId: number
  scheduleName?: string
  regType: 'individual' | 'team' | 'group'
  name: string | null
  position: string | null   // for individual registrations
  teamName: string | null
  roster: RosterMember[]    // for team/group registrations, position per member
  contactNumber: string | null
  email: string | null
  facebookUrl: string | null
  customAnswers: Record<string, any>
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
  createdAt: string
}

function mapSchedule(r: any): RegistrationSchedule {
  return {
    id: r.id,
    name: r.name,
    sport: r.sport,
    date: r.date,
    startTime: r.start_time,
    endDate: r.end_date,
    endTime: r.end_time,
    venue: r.venue,
    description: r.description,
    status: r.status,
    capacity: r.capacity,
    customFields: r.custom_fields ?? [],
    linkedTournamentExternalId: r.linked_tournament_external_id,
    createdAt: r.created_at,
    registrationCount: r.registration_count !== undefined ? Number(r.registration_count) : undefined,
  }
}

function mapRegistration(r: any): Registration {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    scheduleName: r.schedule_name,
    regType: r.reg_type,
    name: r.name,
    position: r.position,
    teamName: r.team_name,
    roster: r.roster ?? [],
    contactNumber: r.contact_number,
    email: r.email,
    facebookUrl: r.facebook_url,
    customAnswers: r.custom_answers ?? {},
    status: r.status,
    createdAt: r.created_at,
  }
}

// ─── Public: list schedules open for registration (active only) ────────────────
export const getActiveRegistrationSchedules = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    const rows = await db.execute(sql`
      SELECT s.*, COALESCE(SUM(CASE WHEN r.id IS NULL THEN 0 WHEN r.reg_type = 'individual' THEN 1 ELSE GREATEST(jsonb_array_length(r.roster), 1) END), 0)::int AS registration_count
      FROM registration_schedules s
      LEFT JOIN registrations r ON r.schedule_id = s.id AND r.status != 'cancelled'
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY s.date ASC NULLS LAST
    `)
    return (rows.rows as any[]).map(mapSchedule)
  })
})

// ─── Admin: list all schedules (any status), with registration counts ──────────
export const getAllRegistrationSchedules = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Admin access required')
  return withRetry(async () => {
    const rows = await db.execute(sql`
      SELECT s.*, COALESCE(SUM(CASE WHEN r.id IS NULL THEN 0 WHEN r.reg_type = 'individual' THEN 1 ELSE GREATEST(jsonb_array_length(r.roster), 1) END), 0)::int AS registration_count
      FROM registration_schedules s
      LEFT JOIN registrations r ON r.schedule_id = s.id AND r.status != 'cancelled'
      GROUP BY s.id
      ORDER BY s.date DESC NULLS LAST
    `)
    return (rows.rows as any[]).map(mapSchedule)
  })
})

// ─── Admin: create a registration schedule ──────────────────────────────────────
export const createRegistrationSchedule = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    name: string; sport: string
    date: string | null; startTime: string | null; endDate: string | null; endTime: string | null
    venue: string; description: string; capacity: number | null; status?: string
    customFields: CustomFieldDefinition[]; linkedTournamentExternalId: string | null
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      const rows = await db.execute(sql`
        INSERT INTO registration_schedules
          (name, sport, date, start_time, end_date, end_time, venue, description, capacity, status, custom_fields, linked_tournament_external_id)
        VALUES (
          ${data.name}, ${data.sport || 'Volleyball'},
          ${data.date || null}, ${data.startTime || null}, ${data.endDate || null}, ${data.endTime || null},
          ${data.venue}, ${data.description}, ${data.capacity}, ${data.status || 'active'},
          ${JSON.stringify(data.customFields ?? [])}::jsonb, ${data.linkedTournamentExternalId}
        )
        RETURNING *
      `)
      return mapSchedule(rows.rows[0])
    })
  })

// ─── Admin: update a registration schedule ──────────────────────────────────────
export const updateRegistrationSchedule = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    id: number; name: string; sport: string
    date: string | null; startTime: string | null; endDate: string | null; endTime: string | null
    venue: string; description: string; status: string; capacity: number | null
    customFields: CustomFieldDefinition[]; linkedTournamentExternalId: string | null
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      const rows = await db.execute(sql`
        UPDATE registration_schedules SET
          name = ${data.name}, sport = ${data.sport},
          date = ${data.date || null}, start_time = ${data.startTime || null},
          end_date = ${data.endDate || null}, end_time = ${data.endTime || null},
          venue = ${data.venue}, description = ${data.description}, status = ${data.status},
          capacity = ${data.capacity}, custom_fields = ${JSON.stringify(data.customFields ?? [])}::jsonb,
          linked_tournament_external_id = ${data.linkedTournamentExternalId}, updated_at = now()
        WHERE id = ${data.id}
        RETURNING *
      `)
      return mapSchedule(rows.rows[0])
    })
  })

// ─── Admin: delete a schedule (cascades to its registrations) ──────────────────
// Archives a schedule (soft-delete) instead of removing the row. Hard-deleting
// would cascade-delete every registration attached to it — permanently losing the
// signup history for that event. Archiving preserves all that data while hiding the
// schedule from the public form and the active admin views.
export const deleteRegistrationSchedule = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      await db.execute(sql`
        UPDATE registration_schedules
        SET status = 'archived', updated_at = now()
        WHERE id = ${data.id}
      `)
      return { ok: true }
    })
  })

// ─── Public: submit a registration ──────────────────────────────────────────────
export const submitRegistration = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    scheduleId: number; regType: 'individual' | 'team' | 'group'
    name: string; position: string; teamName: string; roster: RosterMember[]
    contactNumber: string; email: string; facebookUrl: string; customAnswers: Record<string, any>
  }) => data)
  .handler(async ({ data }) => {
    // Optional identity — registration works for guests, but we tag the member if logged in.
    const identity = await getStatIdentity().catch(() => null)

    return withRetry(async () => {
      // Read the schedule for capacity/status info and a friendly pre-check.
      const schedRows = await db.execute(sql`
        SELECT s.*, COALESCE(SUM(CASE WHEN r.id IS NULL THEN 0 WHEN r.reg_type = 'individual' THEN 1 ELSE GREATEST(jsonb_array_length(r.roster), 1) END), 0)::int AS registration_count
        FROM registration_schedules s
        LEFT JOIN registrations r ON r.schedule_id = s.id AND r.status != 'cancelled'
        WHERE s.id = ${data.scheduleId}
        GROUP BY s.id
      `)
      const sched = schedRows.rows[0] as any
      if (!sched) throw new Error('This schedule is no longer available — it may have been removed. Please refresh the page and pick an open schedule.')
      if (sched.status !== 'active') throw new Error('Registration is closed for this schedule')

      const isFull = sched.capacity !== null && Number(sched.registration_count) >= Number(sched.capacity)
      const initialStatus = isFull ? 'waitlisted' : 'pending'

      // Insert atomically: the row is only created if the schedule still exists at
      // write time (INSERT ... SELECT ... WHERE EXISTS). This does the existence
      // check and the insert in ONE statement on ONE connection, so a stale or
      // just-deleted schedule can't slip through as a raw foreign-key error —
      // instead we detect zero rows inserted and return a clean message.
      const rows = await db.execute(sql`
        INSERT INTO registrations
          (schedule_id, reg_type, name, position, team_name, roster, contact_number, email, facebook_url, custom_answers, status, netlify_user_id)
        SELECT
          ${data.scheduleId}, ${data.regType}, ${data.name || null}, ${data.position || null}, ${data.teamName || null},
          ${JSON.stringify(data.roster ?? [])}::jsonb, ${data.contactNumber || null}, ${data.email || null}, ${data.facebookUrl || null},
          ${JSON.stringify(data.customAnswers ?? {})}::jsonb, ${initialStatus}, ${identity?.userId ?? null}
        WHERE EXISTS (SELECT 1 FROM registration_schedules WHERE id = ${data.scheduleId})
        RETURNING *
      `)

      if (!rows.rows[0]) {
        throw new Error('This schedule is no longer available — it may have been removed. Please refresh the page and pick an open schedule.')
      }
      return { registration: mapRegistration(rows.rows[0]), waitlisted: isFull }
    })
  })

// ─── Admin: list registrations with filters (schedule, date range, status, search) ──
export const getRegistrations = createServerFn({ method: 'GET' })
  .inputValidator((data: {
    scheduleId?: number | null
    scheduleName?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    status?: string | null
    search?: string | null
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      const conditions = [sql`1=1`]
      if (data.scheduleId) conditions.push(sql`r.schedule_id = ${data.scheduleId}`)
      if (data.scheduleName) conditions.push(sql`LOWER(s.name) LIKE ${`%${data.scheduleName.toLowerCase()}%`}`)
      if (data.status) conditions.push(sql`r.status = ${data.status}`)
      // Filter by the schedule's event date (not the registration submission date) —
      // this answers "who's registered for events happening in this date range."
      // date is plain 'YYYY-MM-DD' text now, so lexical comparison sorts and
      // ranges correctly — and dateTo is naturally inclusive (no time component).
      if (data.dateFrom) conditions.push(sql`s.date >= ${data.dateFrom}`)
      if (data.dateTo) conditions.push(sql`s.date <= ${data.dateTo}`)
      if (data.search) {
        const term = `%${data.search.toLowerCase()}%`
        conditions.push(sql`(
          LOWER(COALESCE(r.name, '')) LIKE ${term} OR
          LOWER(COALESCE(r.team_name, '')) LIKE ${term} OR
          LOWER(COALESCE(r.email, '')) LIKE ${term} OR
          LOWER(COALESCE(r.contact_number, '')) LIKE ${term}
        )`)
      }
      const whereClause = sql.join(conditions, sql` AND `)

      const rows = await db.execute(sql`
        SELECT r.*, s.name AS schedule_name, s.date AS schedule_date
        FROM registrations r
        JOIN registration_schedules s ON s.id = r.schedule_id
        WHERE ${whereClause}
        ORDER BY r.created_at DESC
      `)
      return (rows.rows as any[]).map(mapRegistration)
    })
  })

// ─── Admin: update a registration's status ──────────────────────────────────────
export const updateRegistrationStatus = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      const rows = await db.execute(sql`
        UPDATE registrations SET status = ${data.status}, updated_at = now()
        WHERE id = ${data.id}
        RETURNING *
      `)
      return mapRegistration(rows.rows[0])
    })
  })

// ─── Admin: delete a registration ───────────────────────────────────────────────
export const deleteRegistration = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      await db.execute(sql`DELETE FROM registrations WHERE id = ${data.id}`)
      return { ok: true }
    })
  })

// ─── Lightweight polling endpoint: just the count + latest timestamp ───────────
// Cheap enough to poll every 15-20s without hammering the DB; the admin UI
// compares this against what it has and only refetches the full list when it
// detects something new, which is how we "assure data will be there" without
// constantly re-running the heavier filtered query.
export const getRegistrationsHeartbeat = createServerFn({ method: 'GET' })
  .inputValidator((data: { scheduleId?: number | null }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) return { count: 0, latest: null }
    return withRetry(async () => {
      const rows = await db.execute(
        data.scheduleId
          ? sql`SELECT COUNT(*)::int AS count, MAX(created_at) AS latest FROM registrations WHERE schedule_id = ${data.scheduleId}`
          : sql`SELECT COUNT(*)::int AS count, MAX(created_at) AS latest FROM registrations`
      )
      const row = rows.rows[0] as any
      return { count: Number(row?.count ?? 0), latest: row?.latest ?? null }
    })
  })

// ─── Admin diagnostic: report what the APP's own DB connection actually sees ──────
// This runs on the exact same connection as submitRegistration, so it answers
// definitively: which database is the app writing to, and does it contain the
// schedules the form is offering? Use this to catch environment/branch mismatches
// where the app and a manual SQL editor point at different databases.
export const getRegistrationDbDiagnostic = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Admin access required')
  return withRetry(async () => {
    const info = await db.execute(sql`SELECT current_database() AS database, current_user AS db_user`)
    const counts = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM registration_schedules) AS schedules,
        (SELECT COUNT(*) FROM registrations) AS registrations
    `)
    const schedules = await db.execute(sql`
      SELECT id, name, status FROM registration_schedules ORDER BY id
    `)
    const c = counts.rows[0] as any
    const i = info.rows[0] as any
    return {
      database: i?.database ?? null,
      dbUser: i?.db_user ?? null,
      scheduleCount: Number(c?.schedules ?? 0),
      registrationCount: Number(c?.registrations ?? 0),
      schedules: (schedules.rows as any[]).map((r) => ({ id: r.id, name: r.name, status: r.status })),
    }
  })
})
