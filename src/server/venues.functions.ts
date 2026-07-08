// src/server/venues.functions.ts
// Managed venue list. Keeps venue names consistent so per-venue analytics are
// reliable (unify). Adding a venue is one call (flexible); archiving keeps history.
// Schedules still store the venue NAME (the canonical one from this list) — so this
// is backward compatible with everything that reads schedule.venue.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser } from '@/lib/auth-server'

export interface Venue {
  id: number
  name: string
  address: string | null
  archivedAt: string | null
}

function mapVenue(r: any): Venue {
  return {
    id: Number(r.id),
    name: r.name,
    address: r.address ?? null,
    archivedAt: r.archived_at ? String(r.archived_at) : null,
  }
}

// Active venues (archived excluded), alphabetical — powers the combobox.
export const getVenues = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    try {
      const r = await db.execute(sql`
        SELECT id, name, address, archived_at FROM venues
        WHERE archived_at IS NULL ORDER BY lower(name) ASC
      `)
      return (r.rows as any[]).map(mapVenue)
    } catch {
      return [] // table not created yet — combobox still lets you free-type
    }
  })
})

// Add (or return existing) a venue by name — case-insensitive upsert. Returns the
// canonical name to store on the schedule, so casing stays consistent everywhere.
export const addVenue = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; address?: string | null }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const name = data.name.trim()
    if (!name) throw new Error('Venue name is required')
    const createdBy = (admin as any)?.email ?? (admin as any)?.id ?? 'admin'
    return withRetry(async () => {
      await db.execute(sql`
        INSERT INTO venues (name, address, created_by)
        VALUES (${name}, ${data.address ?? null}, ${createdBy})
        ON CONFLICT (lower(name)) DO NOTHING
      `)
      const r = await db.execute(sql`SELECT id, name, address, archived_at FROM venues WHERE lower(name) = lower(${name}) LIMIT 1`)
      const row = (r.rows as any[])[0]
      return row ? mapVenue(row) : { id: 0, name, address: data.address ?? null, archivedAt: null }
    })
  })

export const setVenueArchived = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; archived: boolean }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      if (data.archived) await db.execute(sql`UPDATE venues SET archived_at = now() WHERE id = ${data.id}`)
      else await db.execute(sql`UPDATE venues SET archived_at = NULL WHERE id = ${data.id}`)
      return { ok: true }
    })
  })
