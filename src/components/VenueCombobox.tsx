// src/components/VenueCombobox.tsx
// Pick-or-add venue input. Suggests existing venues as you type (consistency),
// and lets you add a new one on the spot (flexibility). Stores the canonical name.
// Degrades to a plain text input if the venues table isn't there yet.

import { useState, useEffect, useRef } from 'react'
import { MapPin, Plus, Check } from 'lucide-react'
import { getVenues, addVenue, type Venue } from '@/server/venues.functions'

export function VenueCombobox({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [venues, setVenues] = useState<Venue[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [adding, setAdding] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { getVenues().then(setVenues).catch(() => setVenues([])) }, [])
  useEffect(() => { setQuery(value) }, [value])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = query.trim().toLowerCase()
  const matches = venues.filter((v) => v.name.toLowerCase().includes(q))
  const exact = venues.some((v) => v.name.toLowerCase() === q)
  const canAdd = q.length > 0 && !exact

  const pick = (name: string) => { onChange(name); setQuery(name); setOpen(false) }

  const handleAddNew = async () => {
    const name = query.trim()
    if (!name) return
    setAdding(true)
    try {
      const v = await addVenue({ data: { name } })
      setVenues((prev) => prev.some((x) => x.id === v.id) ? prev : [...prev, v].sort((a, b) => a.name.localeCompare(b.name)))
      pick(v.name)
    } catch {
      // If the server rejects (e.g. table missing), still accept the typed value.
      pick(name)
    } finally { setAdding(false) }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 focus-within:border-blue-500">
        <MapPin size={14} className="text-[rgb(var(--muted-fg))] shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Pick or type a venue"
          className="w-full text-sm bg-transparent py-2 focus:outline-none" />
      </div>
      {open && (matches.length > 0 || canAdd) && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] shadow-lg">
          {matches.map((v) => (
            <button key={v.id} type="button" onClick={() => pick(v.name)}
              className="w-full text-left text-sm px-3 py-2 hover:bg-[rgb(var(--bg))] flex items-center gap-2">
              <MapPin size={12} className="text-[rgb(var(--muted-fg))]" />
              <span className="flex-1">{v.name}</span>
              {v.name.toLowerCase() === q && <Check size={13} className="text-blue-500" />}
            </button>
          ))}
          {canAdd && (
            <button type="button" onClick={handleAddNew} disabled={adding}
              className="w-full text-left text-sm px-3 py-2 hover:bg-[rgb(var(--bg))] flex items-center gap-2 text-blue-600 font-bold border-t border-[rgb(var(--border-soft))]">
              <Plus size={13} /> {adding ? 'Adding…' : `Add "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
