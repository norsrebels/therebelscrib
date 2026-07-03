// src/server/card-themes.functions.ts
// Saved, reusable schedule-card themes. Shared across all admins (unified data):
// a theme created once lives in the DB and can be applied to any card by anyone.
// Fail-soft reads so the card generator works even before the migration runs.

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import { withRetry } from '@/lib/db-retry'
import { getAdminUser } from '@/lib/auth-server'

export interface CardTheme {
  id: number
  name: string
  accentHex: string
  textMode: string
  textHex: string | null
  template: string | null
  background: string | null
}

function mapTheme(r: any): CardTheme {
  return {
    id: Number(r.id),
    name: r.name,
    accentHex: r.accent_hex ?? '#0071e3',
    textMode: r.text_mode ?? 'auto',
    textHex: r.text_hex ?? null,
    template: r.template ?? null,
    background: r.background ?? null,
  }
}

export const getCardThemes = createServerFn({ method: 'GET' }).handler(async () => {
  return withRetry(async () => {
    try {
      const r = await db.execute(sql`
        SELECT id, name, accent_hex, text_mode, text_hex, template, background
        FROM card_themes ORDER BY lower(name) ASC
      `)
      return (r.rows as any[]).map(mapTheme)
    } catch {
      return [] // table not created yet — feature degrades gracefully
    }
  })
})

export const saveCardTheme = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    name: string; accentHex: string; textMode?: string; textHex?: string | null
    template?: string | null; background?: string | null
  }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    const name = data.name.trim()
    if (!name) throw new Error('Theme name is required')
    const createdBy = (admin as any)?.email ?? (admin as any)?.id ?? 'admin'
    return withRetry(async () => {
      // Upsert by case-insensitive name so re-saving a theme updates it.
      await db.execute(sql`
        INSERT INTO card_themes (name, accent_hex, text_mode, text_hex, template, background, created_by)
        VALUES (${name}, ${data.accentHex}, ${data.textMode ?? 'auto'}, ${data.textHex ?? null}, ${data.template ?? null}, ${data.background ?? null}, ${createdBy})
        ON CONFLICT (lower(name)) DO UPDATE SET
          accent_hex = EXCLUDED.accent_hex,
          text_mode  = EXCLUDED.text_mode,
          text_hex   = EXCLUDED.text_hex,
          template   = EXCLUDED.template,
          background = EXCLUDED.background
      `)
      return { ok: true }
    })
  })

export const deleteCardTheme = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const admin = await getAdminUser()
    if (!admin) throw new Error('Admin access required')
    return withRetry(async () => {
      await db.execute(sql`DELETE FROM card_themes WHERE id = ${data.id}`)
      return { ok: true }
    })
  })
