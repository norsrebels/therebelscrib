// src/components/ChampionsCardGenerator.tsx
// Pubmat generator: showcases the winner(s) of a tournament/schedule as a
// shareable, high-resolution card. The photo is the hero — with a flexible,
// zone-based layout engine so the winner's photo, title, and placements can be
// arranged deliberately (not a fixed stack).
//
// Full control (principle 2 — flexibility): photo placement (background / badge /
// split / inset / top / bottom / center), title alignment + bold + all-caps,
// font family + size, and margins. Reuses the app's shared gallery and font
// system (principle 1 — one image source, one font system).

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download, Trophy, Plus, Trash2, Palette, Images, Upload, Type, LayoutGrid } from 'lucide-react'
import { getGalleryImages, type GalleryImage } from '@/server/gallery.functions'
import { FONT_OPTIONS, loadFont, fontFamily, type FontChoice } from '@/lib/schedule-card-fonts'

const FORMATS: Record<string, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: 'Portrait 4:5' },
  square: { w: 1080, h: 1080, label: 'Square 1:1' },
  story: { w: 1080, h: 1920, label: 'Story 9:16' },
}

type ThemeKey = 'podiumGold' | 'spotlight' | 'laurel' | 'midnightCourt' | 'emberBlaze' | 'cleanSlate'
const THEMES: { key: ThemeKey; label: string }[] = [
  { key: 'podiumGold', label: 'Podium Gold' },
  { key: 'spotlight', label: 'Champion Spotlight' },
  { key: 'laurel', label: 'Classic Laurel' },
  { key: 'midnightCourt', label: 'Midnight Court' },
  { key: 'emberBlaze', label: 'Ember Blaze' },
  { key: 'cleanSlate', label: 'Clean Slate' },
]

type PhotoMode = 'none' | 'background' | 'badge' | 'splitLeft' | 'splitRight' | 'insetLeft' | 'insetRight' | 'top' | 'bottom' | 'center'
const PHOTO_MODES: { key: PhotoMode; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'background', label: 'Background' },
  { key: 'badge', label: 'Badge' },
  { key: 'splitLeft', label: 'Split L' },
  { key: 'splitRight', label: 'Split R' },
  { key: 'insetLeft', label: 'Inset L' },
  { key: 'insetRight', label: 'Inset R' },
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'center', label: 'Center' },
]

type Align = 'left' | 'center' | 'right'

function rankColor(rank: number): { main: string; glow: string; label: string } {
  switch (rank) {
    case 1: return { main: '#f5c518', glow: '#8a6d0b', label: 'CHAMPION' }
    case 2: return { main: '#c8cdd4', glow: '#6b7079', label: '2ND PLACE' }
    case 3: return { main: '#cd7f32', glow: '#7a4a1e', label: '3RD PLACE' }
    default: return { main: '#b8c0cc', glow: '#5a616b', label: `${rank}TH PLACE` }
  }
}

interface Placement { id: string; rank: number; name: string; detail: string }

interface Style {
  theme: ThemeKey
  accent: string
  photoMode: PhotoMode
  titleAlign: Align
  titleBold: boolean
  titleCaps: boolean
  font: FontChoice
  titleSize: number   // multiplier, 0.6–1.6
  marginPct: number   // outer margin as % of width, 0–12
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
  const [dimension, setDimension] = useState('portrait')
  const [placements, setPlacements] = useState<Placement[]>([{ id: 'p1', rank: 1, name: '', detail: '' }])

  const [style, setStyle] = useState<Style>({
    theme: 'podiumGold',
    accent: communityColors?.[0]?.primary ?? '#f5c518',
    photoMode: 'none',
    titleAlign: 'center',
    titleBold: true,
    titleCaps: true,
    font: 'bebas',
    titleSize: 1,
    marginPct: 5,
  })
  const set = <K extends keyof Style>(k: K, v: Style[K]) => setStyle((s) => ({ ...s, [k]: v }))

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [generating, setGenerating] = useState(false)
  const [fontReady, setFontReady] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoImgRef = useRef<HTMLImageElement | null>(null)

  // Load the chosen font before drawing (bump fontReady to trigger re-render).
  useEffect(() => { loadFont(style.font).then(() => setFontReady((n) => n + 1)) }, [style.font])

  const addPlacement = () => {
    const nextRank = (placements.length > 0 ? Math.max(...placements.map((p) => p.rank)) : 0) + 1
    setPlacements((prev) => [...prev, { id: `p${Date.now()}`, rank: nextRank, name: '', detail: '' }])
  }
  const removePlacement = (id: string) => setPlacements((prev) => prev.filter((p) => p.id !== id))
  const updatePlacement = (id: string, field: keyof Placement, value: string | number) =>
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  const openGallery = async () => {
    setShowGallery(true)
    try { setGalleryImages(await getGalleryImages()) } catch { setGalleryImages([]) }
  }
  const selectPhoto = async (url: string) => {
    const img = await loadImage(url)
    photoImgRef.current = img
    setPhotoUrl(url)
    if (style.photoMode === 'none') set('photoMode', 'insetRight')
    setShowGallery(false)
    render()
  }
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const img = await loadImage(reader.result as string)
      photoImgRef.current = img
      setPhotoUrl(reader.result as string)
      if (style.photoMode === 'none') set('photoMode', 'insetRight')
      render()
    }
    reader.readAsDataURL(file)
  }
  const clearPhoto = () => { photoImgRef.current = null; setPhotoUrl(null); set('photoMode', 'none') }

  const render = useCallback(() => {
    const cv = canvasRef.current
    if (cv) drawCard(cv, { title, subtitle, placements, style, photoImg: photoImgRef.current }, dimension, 1)
  }, [title, subtitle, placements, style, dimension, photoUrl, fontReady])

  useEffect(() => { render() }, [render])

  const handleDownload = () => {
    setGenerating(true)
    const target = document.createElement('canvas')
    drawCard(target, { title, subtitle, placements, style, photoImg: photoImgRef.current }, dimension, 2)
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

  const Seg = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${active ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600' : 'border-[rgb(var(--border-soft))]'}`}>{children}</button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border-soft))] w-full max-w-5xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))] z-10">
          <h3 className="font-bold text-lg flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Champions Pubmat</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4">
          {/* Preview */}
          <div className="flex items-start justify-center md:sticky md:top-20 self-start">
            <canvas ref={canvasRef} className="w-full max-w-[380px] rounded-xl border border-[rgb(var(--border-soft))]" />
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

            {/* Title styling */}
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center gap-1"><Type size={11} /> Title style</label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                <span className="text-[10px] text-[rgb(var(--muted-fg))] self-center">Align:</span>
                {(['left', 'center', 'right'] as Align[]).map((a) => <Seg key={a} active={style.titleAlign === a} onClick={() => set('titleAlign', a)}>{a}</Seg>)}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Seg active={style.titleBold} onClick={() => set('titleBold', !style.titleBold)}>Bold</Seg>
                <Seg active={style.titleCaps} onClick={() => set('titleCaps', !style.titleCaps)}>ALL CAPS</Seg>
              </div>
            </div>

            {/* Font family + size */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Font</label>
                <select value={style.font} onChange={(e) => set('font', e.target.value as FontChoice)}
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-2 focus:outline-none focus:border-yellow-500">
                  {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Title size: {Math.round(style.titleSize * 100)}%</label>
                <input type="range" min="0.6" max="1.6" step="0.05" value={style.titleSize} onChange={(e) => set('titleSize', Number(e.target.value))} className="w-full accent-yellow-500" />
              </div>
            </div>

            {/* Margin */}
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Margin: {style.marginPct}%</label>
              <input type="range" min="0" max="12" step="0.5" value={style.marginPct} onChange={(e) => set('marginPct', Number(e.target.value))} className="w-full accent-yellow-500" />
            </div>

            {/* Theme + format */}
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center gap-1"><Palette size={11} /> Theme</label>
              <div className="flex gap-1.5 flex-wrap">
                {THEMES.map((t) => <Seg key={t.key} active={style.theme === t.key} onClick={() => set('theme', t.key)}>{t.label}</Seg>)}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Format</label>
              <div className="flex gap-1.5">
                {Object.entries(FORMATS).map(([k, v]) => <Seg key={k} active={dimension === k} onClick={() => setDimension(k)}>{v.label}</Seg>)}
              </div>
            </div>

            {/* Photo */}
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center gap-1"><Images size={11} /> Winner photo</label>
              <div className="flex gap-1.5 mb-2">
                <button onClick={openGallery} className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg border border-[rgb(var(--border-soft))] hover:border-yellow-500 flex items-center justify-center gap-1"><Images size={12} /> Gallery</button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg border border-[rgb(var(--border-soft))] hover:border-yellow-500 flex items-center justify-center gap-1"><Upload size={12} /> Upload</button>
                {photoUrl && <button onClick={clearPhoto} className="text-[11px] font-bold px-3 py-2 rounded-lg border border-[rgb(var(--border-soft))] text-red-500 hover:border-red-500">Remove</button>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              {photoUrl && (
                <>
                  <label className="text-[10px] font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center gap-1"><LayoutGrid size={10} /> Placement</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PHOTO_MODES.filter((m) => m.key !== 'none').map((m) => <Seg key={m.key} active={style.photoMode === m.key} onClick={() => set('photoMode', m.key)}>{m.label}</Seg>)}
                  </div>
                </>
              )}
            </div>

            {/* Placements */}
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

            <button onClick={handleDownload} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
              <Download size={16} /> {generating ? 'Generating…' : 'Download Pubmat (2x)'}
            </button>
          </div>
        </div>
      </div>

      {showGallery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowGallery(false)}>
          <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border-soft))] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold flex items-center gap-2"><Images size={16} /> Choose from Gallery</h4>
              <button onClick={() => setShowGallery(false)}><X size={18} /></button>
            </div>
            {galleryImages.length === 0 ? (
              <p className="text-sm text-[rgb(var(--muted-fg))] text-center py-8">No gallery images found.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {galleryImages.map((img) => (
                  <button key={img.id} onClick={() => selectPhoto(img.url)} className="aspect-square rounded-lg overflow-hidden border border-[rgb(var(--border-soft))] hover:border-yellow-500 transition-colors">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Image helpers (shared approach with schedule card) ──────────────────────
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height, br = w / h
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ir > br) { sw = img.height * br; sx = (img.width - sw) / 2 } else { sh = img.width / br; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// ─── Canvas rendering ────────────────────────────────────────────────────────
interface CardData { title: string; subtitle: string; placements: Placement[]; style: Style; photoImg: HTMLImageElement | null }
interface Rect { x: number; y: number; w: number; h: number }

function drawCard(canvas: HTMLCanvasElement, data: CardData, dimension: string, scale: number) {
  const fmt = FORMATS[dimension] ?? FORMATS.portrait
  const W = fmt.w * scale, H = fmt.h * scale
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const U = H / 1350
  const s = data.style
  const fam = fontFamily(s.font)
  const hasPhoto = s.photoMode !== 'none' && !!data.photoImg
  const margin = (s.marginPct / 100) * W

  paintBackground(ctx, W, H, s.theme, s.accent)

  // Full-bleed background photo (special: covers whole card behind everything).
  if (s.photoMode === 'background' && data.photoImg) {
    ctx.globalAlpha = 0.55; drawCover(ctx, data.photoImg, 0, 0, W, H); ctx.globalAlpha = 1
    const ov = ctx.createLinearGradient(0, 0, 0, H)
    ov.addColorStop(0, 'rgba(10,8,4,0.78)'); ov.addColorStop(0.5, 'rgba(14,12,7,0.55)'); ov.addColorStop(1, 'rgba(10,8,4,0.85)')
    ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H)
  }

  // Compute the CONTENT rect and (optionally) draw the photo in its own zone.
  let content: Rect = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 }
  if (hasPhoto && data.photoImg) {
    content = layoutPhoto(ctx, W, H, margin, s, data.photoImg)
  }

  const lightText = isLightTheme(s.theme) && s.photoMode !== 'background'
  const textCol = lightText ? '#1a1d24' : '#ffffff'
  const subCol = lightText ? 'rgba(26,29,36,0.65)' : 'rgba(255,255,255,0.72)'

  // ── Header zone: trophy + title + subtitle, within content rect ──
  const cx = content.x + content.w / 2
  const alignX = s.titleAlign === 'left' ? content.x : s.titleAlign === 'right' ? content.x + content.w : cx

  let y = content.y + U * 20
  // Trophy scales down a touch when a side photo narrows the content.
  const narrow = content.w < W * 0.62
  const trophyS = (narrow ? U * 48 : U * 62) * (s.photoMode === 'top' ? 0.8 : 1)
  drawTrophy(ctx, s.titleAlign === 'center' ? cx : alignX + (s.titleAlign === 'left' ? trophyS : -trophyS), y + trophyS * 0.7, trophyS, s.accent)
  y += trophyS * 1.5 + U * 10

  ctx.textAlign = s.titleAlign
  ctx.fillStyle = textCol
  const titlePx = (narrow ? U * 44 : U * 58) * s.titleSize
  ctx.font = `${s.titleBold ? '800' : '500'} ${titlePx}px ${fam}`
  const titleText = s.titleCaps ? (data.title || 'Champions').toUpperCase() : (data.title || 'Champions')
  y = wrapText(ctx, titleText, alignX, y + titlePx, content.w, titlePx * 1.08) + U * 6

  if (data.subtitle) {
    ctx.fillStyle = subCol
    ctx.font = `600 ${U * 26}px ${fam}`
    ctx.fillText(data.subtitle, alignX, y + U * 22)
    y += U * 44
  }

  // ── Placements zone: fills remaining content height below the header ──
  const sorted = [...data.placements].sort((a, b) => a.rank - b.rank)
  const zoneTop = y + U * 20
  const zoneBottom = content.y + content.h
  const rowH = Math.min((zoneBottom - zoneTop) / Math.max(sorted.length, 1), U * 175)
  sorted.forEach((p, i) => drawPlacementRow(ctx, content.x, content.w, zoneTop + i * rowH, rowH, p, U, fam, lightText))

  // Footer accent line.
  ctx.fillStyle = s.accent
  ctx.fillRect(0, H - U * 10, W, U * 10)
}

// Places the photo per mode and RETURNS the remaining content rect.
function layoutPhoto(ctx: CanvasRenderingContext2D, W: number, H: number, margin: number, s: Style, img: HTMLImageElement): Rect {
  const gap = margin > 0 ? margin : W * 0.03
  const full: Rect = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 }

  const roundedPhoto = (r: Rect, radius: number) => {
    ctx.save(); roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.clip()
    drawCover(ctx, img, r.x, r.y, r.w, r.h); ctx.restore()
    ctx.lineWidth = Math.max(2, W / 300); ctx.strokeStyle = s.accent
    roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.stroke()
  }

  switch (s.photoMode) {
    case 'badge': {
      const br = Math.min(W, H) * 0.14
      const bx = W / 2, by = margin + br + H * 0.16
      ctx.save(); ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.clip()
      drawCover(ctx, img, bx - br, by - br, br * 2, br * 2); ctx.restore()
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.lineWidth = Math.max(3, W / 200); ctx.strokeStyle = s.accent; ctx.stroke()
      return { x: margin, y: by + br + gap, w: W - margin * 2, h: (H - margin) - (by + br + gap) }
    }
    case 'splitLeft': {
      const pw = W * 0.5
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, pw, H); ctx.clip(); drawCover(ctx, img, 0, 0, pw, H); ctx.restore()
      return { x: pw + gap, y: margin, w: W - pw - gap - margin, h: H - margin * 2 }
    }
    case 'splitRight': {
      const pw = W * 0.5
      ctx.save(); ctx.beginPath(); ctx.rect(W - pw, 0, pw, H); ctx.clip(); drawCover(ctx, img, W - pw, 0, pw, H); ctx.restore()
      return { x: margin, y: margin, w: W - pw - gap - margin, h: H - margin * 2 }
    }
    case 'insetLeft': {
      const pw = (W - margin * 2) * 0.44
      roundedPhoto({ x: margin, y: margin, w: pw, h: H - margin * 2 }, W * 0.02)
      return { x: margin + pw + gap, y: margin, w: W - margin * 2 - pw - gap, h: H - margin * 2 }
    }
    case 'insetRight': {
      const pw = (W - margin * 2) * 0.44
      roundedPhoto({ x: W - margin - pw, y: margin, w: pw, h: H - margin * 2 }, W * 0.02)
      return { x: margin, y: margin, w: W - margin * 2 - pw - gap, h: H - margin * 2 }
    }
    case 'top': {
      const ph = (H - margin * 2) * 0.42
      roundedPhoto({ x: margin, y: margin, w: W - margin * 2, h: ph }, W * 0.02)
      return { x: margin, y: margin + ph + gap, w: W - margin * 2, h: H - margin * 2 - ph - gap }
    }
    case 'bottom': {
      const ph = (H - margin * 2) * 0.42
      roundedPhoto({ x: margin, y: H - margin - ph, w: W - margin * 2, h: ph }, W * 0.02)
      return { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 - ph - gap }
    }
    case 'center': {
      // Photo block occupies the middle; content flows above it (header) —
      // placements are drawn below by returning a rect starting under the block.
      const ph = (H - margin * 2) * 0.34
      const py = margin + H * 0.24
      roundedPhoto({ x: margin, y: py, w: W - margin * 2, h: ph }, W * 0.02)
      return { x: margin, y: py + ph + gap, w: W - margin * 2, h: (H - margin) - (py + ph + gap) }
    }
    default:
      return full
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function paintBackground(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeKey, accent: string) {
  if (theme === 'spotlight') {
    const g = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, H * 0.7)
    g.addColorStop(0, '#2a2140'); g.addColorStop(1, '#0d0a17'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.save(); ctx.translate(W / 2, H * 0.32); ctx.globalAlpha = 0.06
    for (let i = 0; i < 12; i++) { ctx.rotate((Math.PI * 2) / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-W * 0.05, H); ctx.lineTo(W * 0.05, H); ctx.closePath(); ctx.fillStyle = accent; ctx.fill() }
    ctx.restore()
  } else if (theme === 'laurel') {
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, W, H); drawLaurel(ctx, W / 2, H * 0.5, Math.min(W, H) * 0.42, accent)
  } else if (theme === 'midnightCourt') {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1428'); g.addColorStop(1, '#060b18'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = Math.max(1, W / 600); const step = W / 16
    for (let x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    const gv = ctx.createRadialGradient(W / 2, H * 0.15, 0, W / 2, H * 0.15, H * 0.55); gv.addColorStop(0, hexA(accent, 0.14)); gv.addColorStop(1, hexA(accent, 0)); ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H)
  } else if (theme === 'emberBlaze') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a0a06'); g.addColorStop(0.55, '#4a1208'); g.addColorStop(1, '#1a0603'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const gv = ctx.createRadialGradient(W / 2, H * 0.18, 0, W / 2, H * 0.18, H * 0.6); gv.addColorStop(0, 'rgba(255,120,40,0.22)'); gv.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H)
  } else if (theme === 'cleanSlate') {
    ctx.fillStyle = '#f6f7f9'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = hexA(accent, 0.08); ctx.fillRect(0, 0, W, H * 0.32)
    ctx.strokeStyle = hexA(accent, 0.5); ctx.lineWidth = Math.max(2, W / 240); ctx.strokeRect(W * 0.04, H * 0.04, W * 0.92, H * 0.92)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#14110a'); g.addColorStop(0.5, '#1c1810'); g.addColorStop(1, '#0e0c07'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const gv = ctx.createRadialGradient(W / 2, H * 0.15, 0, W / 2, H * 0.15, H * 0.5); gv.addColorStop(0, 'rgba(245,197,24,0.10)'); gv.addColorStop(1, 'rgba(245,197,24,0)'); ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H)
  }
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) || 0, g = parseInt(h.substring(2, 4), 16) || 0, b = parseInt(h.substring(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${a})`
}
function isLightTheme(theme: ThemeKey): boolean { return theme === 'cleanSlate' }

function drawPlacementRow(ctx: CanvasRenderingContext2D, cxStart: number, cw: number, y: number, h: number, p: Placement, U: number, fam: string, lightText: boolean) {
  const rc = rankColor(p.rank)
  const medR = Math.min(h * 0.32, U * 48)
  const mx = cxStart + medR + U * 6
  const my = y + h / 2
  const g = ctx.createRadialGradient(mx - medR * 0.3, my - medR * 0.3, medR * 0.1, mx, my, medR)
  g.addColorStop(0, rc.main); g.addColorStop(1, rc.glow)
  ctx.beginPath(); ctx.arc(mx, my, medR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
  ctx.lineWidth = U * 3; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke()
  ctx.fillStyle = '#1a1200'; ctx.font = `900 ${medR * 0.9}px ${fam}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(String(p.rank), mx, my + medR * 0.04); ctx.textBaseline = 'alphabetic'

  const tx = mx + medR + U * 18
  const maxTextW = (cxStart + cw) - tx
  ctx.textAlign = 'left'
  ctx.fillStyle = rc.main; ctx.font = `800 ${U * 20}px ${fam}`
  ctx.fillText(rc.label, tx, my - U * 20)
  ctx.fillStyle = lightText ? '#1a1d24' : '#ffffff'; ctx.font = `800 ${U * 36}px ${fam}`
  ctx.fillText(truncate(ctx, p.name || '—', maxTextW), tx, my + U * 10)
  if (p.detail) {
    ctx.fillStyle = lightText ? 'rgba(26,29,36,0.55)' : 'rgba(255,255,255,0.6)'; ctx.font = `500 ${U * 20}px ${fam}`
    ctx.fillText(truncate(ctx, p.detail, maxTextW), tx, my + U * 40)
  }
}

function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, accent: string) {
  ctx.save(); ctx.translate(cx, cy)
  const g = ctx.createLinearGradient(0, -s, 0, s); g.addColorStop(0, '#ffe98a'); g.addColorStop(0.5, accent); g.addColorStop(1, '#8a6d0b')
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = s * 0.03
  ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.55); ctx.lineTo(s * 0.5, -s * 0.55); ctx.lineTo(s * 0.34, s * 0.05)
  ctx.quadraticCurveTo(0, s * 0.28, -s * 0.34, s * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.lineWidth = s * 0.08
  ctx.beginPath(); ctx.arc(-s * 0.5, -s * 0.35, s * 0.22, Math.PI * 0.5, Math.PI * 1.5, true); ctx.stroke()
  ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.35, s * 0.22, Math.PI * 0.5, Math.PI * 1.5, false); ctx.stroke()
  ctx.fillRect(-s * 0.07, s * 0.05, s * 0.14, s * 0.28); ctx.fillRect(-s * 0.28, s * 0.33, s * 0.56, s * 0.1)
  ctx.restore()
}

function drawLaurel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string) {
  ctx.save(); ctx.strokeStyle = accent; ctx.globalAlpha = 0.5; ctx.lineWidth = r * 0.02
  for (const dir of [-1, 1]) for (let a = 0.15; a <= 0.85; a += 0.08) {
    const ang = Math.PI * (0.5 + dir * a), x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.06, r * 0.02, ang + Math.PI / 2, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}

// Draws wrapped text and returns the y after the last line.
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const words = text.split(' '); let line = ''; const lines: string[] = []
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t }
  if (line) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return y + (lines.length - 1) * lineH
}
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}
