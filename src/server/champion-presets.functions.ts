// src/server/champion-presets.functions.ts
// Saved, reusable champions-pubmat presets. A preset stores the LOOK (theme,
// accent, fonts, title styling, photo placement, margins, brand, footer) as a
// single jsonb config — NOT event content (winners/photos/title). Shared across
// all admins (unified data): configure the club look once, apply anywhere.
// Reads fail soft so the generator works before the migration runs.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser } from '@/lib/auth-server'

export interface ChampionPreset {
  id: number
  name: string
  config: Record<string, any>
}

function mapPreset(r: any): ChampionPreset {
  let config: Record<string, any> = {}
  try { config = typeof r.config === 'string' ? JSON.parse(r.config) : (r.config ?? {}) } catch { config = {} }
  return { id: Number(r.id), name: r.name, config }
}

export const getChampionPresets = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    try {
      const r = await db.execute(sql`
        SELECT id, name, config FROM champion_presets ORDER BY lower(name) ASC
      `)
      return (r.rows as any[]).map(mapPreset)
    } catch {
      return [] // table not created yet — feature degrades gracefully
    }
  })
})

export const saveChampionPreset = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; config: Record<string, any> }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const name = data.name.trim()
    if (!name) throw new Error('Preset name is required')
    const createdBy = (admin as any)?.email ?? (admin as any)?.id ?? 'admin'
    const configJson = JSON.stringify(data.config ?? {})
    return withRetry(async () => {
      // Upsert by case-insensitive name so re-saving a preset updates it.
      await db.execute(sql`
        INSERT INTO champion_presets (name, config, created_by)
        VALUES (${name}, ${configJson}::jsonb, ${createdBy})
        ON CONFLICT (lower(name)) DO UPDATE SET config = EXCLUDED.config
      `)
      return { ok: true }
    })
  })

export const deleteChampionPreset = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      await db.execute(sql`DELETE FROM champion_presets WHERE id = ${data.id}`)
      return { ok: true }
    })
  })
