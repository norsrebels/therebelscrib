// src/components/ChampionsCardGenerator.tsx
// Celebrates tournament winners with a shareable, high-resolution champions card.
// Shares the canvas-export approach of ScheduleCardGenerator but with champion
// content (flexible placements) and champion design (trophy, gold foil, medallion).
//
// Flexible by design (principle 2): you add as many placement rows as you want —
// champion only, full podium, or any mix. Each row has a rank, a name, and an
// optional detail line (roster/score/MVP). The theme colors each rank
// automatically (gold/silver/bronze), so meaning and design stay in sync.

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download, Trophy, Plus, Trash2, Palette } from 'lucide-react'

const FORMATS: Record<string, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: 'Portrait 4:5' },
  square: { w: 1080, h: 1080, label: 'Square 1:1' },
  story: { w: 1080, h: 1920, label: 'Story 9:16' },
}

type ThemeKey = 'podiumGold' | 'spotlight' | 'laurel'
const THEMES: { key: ThemeKey; label: string }[] = [
  { key: 'podiumGold', label: 'Podium Gold' },
  { key: 'spotlight', label: 'Champion Spotlight' },
  { key: 'laurel', label: 'Classic Laurel' },
]

// Rank → medal color. Beyond 3rd falls back to a neutral platinum.
function rankColor(rank: number): { main: string; glow: string; label: string } {
  switch (rank) {
    case 1: return { main: '#f5c518', glow: '#8a6d0b', label: 'CHAMPION' }
    case 2: return { main: '#c8cdd4', glow: '#6b7079', label: '2ND PLACE' }
    case 3: return { main: '#cd7f32', glow: '#7a4a1e', label: '3RD PLACE' }
    default: return { main: '#b8c0cc', glow: '#5a616b', label: `${rank}TH PLACE` }
  }
}

interface Placement {
  id: string
  rank: number
  name: string
  detail: string
}

export function ChampionsCardGenerator({
  tournamentName,
  defaultDate,
  communityColors,
  onClose,
}: {
  tournamentName: string
  defaultDate?: string
  communityColors?: { primary: string; secondary: string }[]
  onClose: () => void
}) {
  const [title, setTitle] = useState(tournamentName || 'Tournament Champions')
  const [subtitle, setSubtitle] = useState(defaultDate || '')
  const [theme, setTheme] = useState<ThemeKey>('podiumGold')
  const [dimension, setDimension] = useState('portrait')
  const [accent, setAccent] = useState(communityColors?.[0]?.primary ?? '#f5c518')
  const [placements, setPlacements] = useState<Placement[]>([
    { id: 'p1', rank: 1, name: '', detail: '' },
  ])
  const [generating, setGenerating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const addPlacement = () => {
    const nextRank = (placements.length > 0 ? Math.max(...placements.map((p) => p.rank)) : 0) + 1
    setPlacements((prev) => [...prev, { id: `p${Date.now()}`, rank: nextRank, name: '', detail: '' }])
  }
  const removePlacement = (id: string) => setPlacements((prev) => prev.filter((p) => p.id !== id))
  const updatePlacement = (id: string, field: keyof Placement, value: string | number) =>
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  const render = useCallback(() => {
    const cv = canvasRef.current
    if (cv) drawChampionsCard(cv, { title, subtitle, theme, accent, placements }, dimension, 1)
  }, [title, subtitle, theme, accent, placements, dimension])

  useEffect(() => { render() }, [render])

  const handleDownload = () => {
    setGenerating(true)
    const target = document.createElement('canvas')
    drawChampionsCard(target, { title, subtitle, theme, accent, placements }, dimension, 2)
    setTimeout(() => {
      target.toBlob((blob) => {
        if (!blob) { setGenerating(false); return }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${(title || 'champions').replace(/\s+/g, '-').toLowerCase()}-${dimension}-2x.jpg`
        a.click(); URL.revokeObjectURL(url); setGenerating(false)
      }, 'image/jpeg', 0.92)
    }, 50)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border-soft))] w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))] z-10">
          <h3 className="font-bold text-lg flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Champions Card</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4">
          {/* Preview */}
          <div className="flex items-start justify-center">
            <canvas ref={canvasRef} className="w-full max-w-[360px] rounded-xl border border-[rgb(var(--border-soft))]" />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-yellow-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Subtitle (date / division)</label>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Spring Cup 2026"
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-yellow-500" />
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center gap-1"><Palette size={11} /> Theme</label>
              <div className="flex gap-1.5 flex-wrap">
                {THEMES.map((t) => (
                  <button key={t.key} onClick={() => setTheme(t.key)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${theme === t.key ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600' : 'border-[rgb(var(--border-soft))]'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Format</label>
              <div className="flex gap-1.5">
                {Object.entries(FORMATS).map(([k, v]) => (
                  <button key={k} onClick={() => setDimension(k)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${dimension === k ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600' : 'border-[rgb(var(--border-soft))]'}`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Flexible placements */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))]">Placements</label>
                <button onClick={addPlacement} className="text-[11px] font-bold text-yellow-600 flex items-center gap-0.5"><Plus size={11} /> Add</button>
              </div>
              <div className="space-y-2">
                {placements.map((p) => {
                  const rc = rankColor(p.rank)
                  return (
                    <div key={p.id} className="rounded-lg border border-[rgb(var(--border-soft))] p-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <select value={p.rank} onChange={(e) => updatePlacement(p.id, 'rank', Number(e.target.value))}
                          className="text-[11px] font-bold rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5">
                          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{rankColor(n).label}</option>)}
                        </select>
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: rc.main }} />
                        <button onClick={() => removePlacement(p.id)} className="ml-auto text-red-500 hover:bg-red-500/10 rounded p-1"><Trash2 size={12} /></button>
                      </div>
                      <input value={p.name} onChange={(e) => updatePlacement(p.id, 'name', e.target.value)} placeholder="Team / player name"
                        className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5 mb-1 focus:outline-none focus:border-yellow-500" />
                      <input value={p.detail} onChange={(e) => updatePlacement(p.id, 'detail', e.target.value)} placeholder="Detail (roster / score / MVP) — optional"
                        className="w-full text-[12px] rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5 focus:outline-none focus:border-yellow-500" />
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Accent color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                  className="w-10 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />
                <div className="flex gap-1.5">
                  {['#f5c518', '#e0e0e0', '#cd7f32', ...(communityColors?.map((c) => c.primary) ?? [])].slice(0, 5).map((c) => (
                    <button key={c} onClick={() => setAccent(c)} className="w-7 h-7 rounded-full border-2 border-[rgb(var(--border-soft))]" style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
              {communityColors && communityColors.length > 0 && (
                <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-0.5">Includes this tournament's community colors.</p>
              )}
            </div>

            <button onClick={handleDownload} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
              <Download size={16} /> {generating ? 'Generating…' : 'Download Card (2x)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Canvas rendering ────────────────────────────────────────────────────────

interface CardData { title: string; subtitle: string; theme: ThemeKey; accent: string; placements: Placement[] }

function drawChampionsCard(canvas: HTMLCanvasElement, data: CardData, dimension: string, scale: number) {
  const fmt = FORMATS[dimension] ?? FORMATS.portrait
  const W = fmt.w * scale
  const H = fmt.h * scale
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const U = (H / 1350) // base unit scales type to the canvas

  // Background per theme.
  paintBackground(ctx, W, H, data.theme, data.accent)

  // Header: trophy motif + title.
  const cx = W / 2
  drawTrophy(ctx, cx, H * 0.13, U * 70, data.accent)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${U * 58}px system-ui, sans-serif`
  wrapText(ctx, (data.title || 'Champions').toUpperCase(), cx, H * 0.24, W * 0.86, U * 64)

  if (data.subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `600 ${U * 26}px system-ui, sans-serif`
    ctx.fillText(data.subtitle, cx, H * 0.29)
  }

  // Placements — sorted by rank, drawn as medallion rows.
  const sorted = [...data.placements].sort((a, b) => a.rank - b.rank)
  const startY = H * 0.37
  const rowH = Math.min((H * 0.5) / Math.max(sorted.length, 1), U * 190)
  sorted.forEach((p, i) => {
    drawPlacementRow(ctx, W, startY + i * rowH, rowH, p, U)
  })

  // Footer accent line.
  ctx.fillStyle = data.accent
  ctx.fillRect(0, H - U * 10, W, U * 10)
}

function paintBackground(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeKey, accent: string) {
  if (theme === 'spotlight') {
    const g = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, H * 0.7)
    g.addColorStop(0, '#2a2140'); g.addColorStop(1, '#0d0a17')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (theme === 'laurel') {
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, W, H)
    drawLaurel(ctx, W / 2, H * 0.5, Math.min(W, H) * 0.42, accent)
  } else {
    // Podium Gold: deep charcoal with a subtle gold vignette.
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#14110a'); g.addColorStop(0.5, '#1c1810'); g.addColorStop(1, '#0e0c07')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const gv = ctx.createRadialGradient(W / 2, H * 0.15, 0, W / 2, H * 0.15, H * 0.5)
    gv.addColorStop(0, 'rgba(245,197,24,0.10)'); gv.addColorStop(1, 'rgba(245,197,24,0)')
    ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H)
  }
}

function drawPlacementRow(ctx: CanvasRenderingContext2D, W: number, y: number, h: number, p: Placement, U: number) {
  const rc = rankColor(p.rank)
  const medR = Math.min(h * 0.32, U * 52)
  // Medallion.
  const mx = W * 0.16
  const my = y + h / 2
  const g = ctx.createRadialGradient(mx - medR * 0.3, my - medR * 0.3, medR * 0.1, mx, my, medR)
  g.addColorStop(0, rc.main); g.addColorStop(1, rc.glow)
  ctx.beginPath(); ctx.arc(mx, my, medR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
  ctx.lineWidth = U * 3; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke()
  ctx.fillStyle = '#1a1200'; ctx.font = `900 ${medR * 0.9}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(String(p.rank), mx, my + medR * 0.04)
  ctx.textBaseline = 'alphabetic'

  // Rank label + name + detail, left-aligned next to medallion.
  const tx = W * 0.28
  ctx.textAlign = 'left'
  ctx.fillStyle = rc.main
  ctx.font = `800 ${U * 22}px system-ui, sans-serif`
  ctx.fillText(rc.label, tx, my - U * 22)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${U * 40}px system-ui, sans-serif`
  ctx.fillText(truncate(ctx, p.name || '—', W * 0.6), tx, my + U * 10)
  if (p.detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `500 ${U * 22}px system-ui, sans-serif`
    ctx.fillText(truncate(ctx, p.detail, W * 0.6), tx, my + U * 42)
  }
  ctx.textAlign = 'center'
}

// Simple trophy icon drawn on canvas (cup + handles + base).
function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, accent: string) {
  ctx.save()
  ctx.translate(cx, cy)
  const g = ctx.createLinearGradient(0, -s, 0, s)
  g.addColorStop(0, '#ffe98a'); g.addColorStop(0.5, accent); g.addColorStop(1, '#8a6d0b')
  ctx.fillStyle = g
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = s * 0.03
  // Cup bowl.
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, -s * 0.55)
  ctx.lineTo(s * 0.5, -s * 0.55)
  ctx.lineTo(s * 0.34, s * 0.05)
  ctx.quadraticCurveTo(0, s * 0.28, -s * 0.34, s * 0.05)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  // Handles.
  ctx.lineWidth = s * 0.08
  ctx.beginPath(); ctx.arc(-s * 0.5, -s * 0.35, s * 0.22, Math.PI * 0.5, Math.PI * 1.5, true); ctx.stroke()
  ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.35, s * 0.22, Math.PI * 0.5, Math.PI * 1.5, false); ctx.stroke()
  // Stem + base.
  ctx.fillRect(-s * 0.07, s * 0.05, s * 0.14, s * 0.28)
  ctx.fillRect(-s * 0.28, s * 0.33, s * 0.56, s * 0.1)
  ctx.restore()
}

function drawLaurel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string) {
  ctx.save(); ctx.strokeStyle = accent; ctx.globalAlpha = 0.5; ctx.lineWidth = r * 0.02
  for (const dir of [-1, 1]) {
    for (let a = 0.15; a <= 0.85; a += 0.08) {
      const ang = Math.PI * (0.5 + dir * a)
      const x = cx + Math.cos(ang) * r
      const y = cy + Math.sin(ang) * r
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.06, r * 0.02, ang + Math.PI / 2, 0, Math.PI * 2); ctx.stroke()
    }
  }
  ctx.restore()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ')
  let line = ''
  const lines: string[] = []
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  const startY = y - ((lines.length - 1) * lineH) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineH))
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}
