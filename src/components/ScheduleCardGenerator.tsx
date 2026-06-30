// src/components/ScheduleCardGenerator.tsx
// Generates a branded 1080x1350 (4:5) JPG schedule card for sharing/inviting.
// Pulls date/venue/time from saved tournament settings but stays editable before
// generating. Three template styles, plus an optional photo: source (upload or
// gallery), treatment (photo or accent-colored duotone silhouette), and placement
// (header band / full background / side panel) — all independently selectable.

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download, Sparkles, Image as ImageIcon, Upload, Images, Trash2 } from 'lucide-react'
import { getGalleryImages, type GalleryImage } from '@/server/gallery.functions'

type Template = 'bold' | 'minimal' | 'energetic'
type ImageTreatment = 'photo' | 'silhouette'
type ImagePlacement = 'header' | 'background' | 'side'

const QUOTES = [
  "Leave it all on the court.",
  "Bump. Set. Spike. Repeat.",
  "Every point counts. Every play matters.",
  "Champions are made in practice.",
  "Rise. Serve. Conquer.",
  "Heart of a champion, hands of a setter.",
  "No block, no problem — go around it.",
  "Dig deep, fly high.",
  "One team, one dream, one match at a time.",
  "Sweat now, celebrate later.",
  "Six on the floor, one heartbeat.",
  "Play hard. Play smart. Play together.",
]

function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}

function getLiveAccentRGB(): string {
  if (typeof window === 'undefined') return '0, 113, 227'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-500').trim()
  return v || '0, 113, 227'
}

function formatDateDisplay(iso: string): { day: string; month: string; weekday: string } {
  if (!iso) return { day: '--', month: '', weekday: '' }
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return { day: '--', month: '', weekday: '' }
  return {
    day: d.getDate().toString(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
  }
}

function formatTimeDisplay(t: string): string {
  if (!t) return '--:--'
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return t
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${(m ?? 0).toString().padStart(2, '0')} ${period}`
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height
  const boxRatio = w / h
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / boxRatio
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function buildSilhouetteCanvas(img: HTMLImageElement, accentRGB: string): HTMLCanvasElement {
  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  const octx = off.getContext('2d')!
  octx.drawImage(img, 0, 0)
  const imageData = octx.getImageData(0, 0, off.width, off.height)
  const data = imageData.data
  const [ar, ag, ab] = accentRGB.split(',').map((n) => parseInt(n.trim(), 10))

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    const alpha = Math.min(1, Math.max(0, (luminance - 0.15) / 0.55))
    data[i] = ar
    data[i + 1] = ag
    data[i + 2] = ab
    data[i + 3] = Math.round(alpha * 255)
  }
  octx.putImageData(imageData, 0, 0)
  return off
}

const W = 1080
const H = 1350

async function drawCard(
  canvas: HTMLCanvasElement,
  template: Template,
  data: { scheduleName: string; venue: string; date: string; startTime: string; endTime: string; quote: string },
  accentRGB: string,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  treatment: ImageTreatment,
  placement: ImagePlacement
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = W
  canvas.height = H
  const accent = `rgb(${accentRGB})`
  const { day, month, weekday } = formatDateDisplay(data.date)
  const timeRange = `${formatTimeDisplay(data.startTime)} – ${formatTimeDisplay(data.endTime)}`

  const photoSource: HTMLImageElement | HTMLCanvasElement | null =
    photo ? (treatment === 'silhouette' ? buildSilhouetteCanvas(photo, accentRGB) : photo) : null

  const darkGrad = () => {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#0a0a0f')
    g.addColorStop(1, '#1a1a24')
    return g
  }

  const isDark = template !== 'minimal'
  ctx.fillStyle = template === 'minimal' ? '#fafafa' : darkGrad()
  ctx.fillRect(0, 0, W, H)

  let contentTop = 0
  let contentLeft = 0
  let contentWidth = W

  if (photoSource && placement === 'background') {
    ctx.save()
    if (treatment === 'silhouette') {
      ctx.globalAlpha = 0.5
      const scale = Math.min(W / (photoSource as any).width, H / (photoSource as any).height) * 1.1
      const pw = (photoSource as any).width * scale
      const ph = (photoSource as any).height * scale
      ctx.drawImage(photoSource, (W - pw) / 2, (H - ph) / 2, pw, ph)
    } else {
      ctx.globalAlpha = 0.32
      drawCover(ctx, photoSource as HTMLImageElement, 0, 0, W, H)
      ctx.globalAlpha = 1
      const scrim = ctx.createLinearGradient(0, 0, 0, H)
      scrim.addColorStop(0, isDark ? 'rgba(10,10,15,0.55)' : 'rgba(250,250,250,0.65)')
      scrim.addColorStop(1, isDark ? 'rgba(10,10,15,0.85)' : 'rgba(250,250,250,0.9)')
      ctx.fillStyle = scrim
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  if (photoSource && placement === 'header') {
    const bandH = 420
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, bandH)
    ctx.clip()
    if (treatment === 'silhouette') {
      ctx.fillStyle = isDark ? '#15151c' : '#eeeeee'
      ctx.fillRect(0, 0, W, bandH)
      const scale = Math.min(W / (photoSource as any).width, bandH / (photoSource as any).height) * 1.15
      const pw = (photoSource as any).width * scale
      const ph = (photoSource as any).height * scale
      ctx.drawImage(photoSource, (W - pw) / 2, bandH - ph + 30, pw, ph)
    } else {
      drawCover(ctx, photoSource as HTMLImageElement, 0, 0, W, bandH)
      const fade = ctx.createLinearGradient(0, bandH - 140, 0, bandH)
      fade.addColorStop(0, 'rgba(0,0,0,0)')
      fade.addColorStop(1, isDark ? '#0a0a0f' : '#fafafa')
      ctx.fillStyle = fade
      ctx.fillRect(0, bandH - 140, W, 140)
    }
    ctx.restore()
    contentTop = bandH - 60
  }

  let sideW = 0
  if (photoSource && placement === 'side') {
    sideW = W * 0.34
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, sideW, H)
    ctx.clip()
    if (treatment === 'silhouette') {
      ctx.fillStyle = isDark ? '#15151c' : '#eeeeee'
      ctx.fillRect(0, 0, sideW, H)
      const scale = Math.max(sideW / (photoSource as any).width, H / (photoSource as any).height) * 1.05
      const pw = (photoSource as any).width * scale
      const ph = (photoSource as any).height * scale
      ctx.drawImage(photoSource, (sideW - pw) / 2, (H - ph) / 2, pw, ph)
    } else {
      drawCover(ctx, photoSource as HTMLImageElement, 0, 0, sideW, H)
      ctx.fillStyle = isDark ? 'rgba(10,10,15,0.25)' : 'rgba(250,250,250,0.2)'
      ctx.fillRect(0, 0, sideW, H)
    }
    ctx.fillStyle = accent
    ctx.fillRect(sideW - 5, 0, 5, H)
    ctx.restore()
    contentLeft = sideW
    contentWidth = W - sideW
  }

  const cx = contentLeft + contentWidth / 2

  if (template === 'bold') {
    if (placement !== 'background' || !photoSource) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(contentLeft, contentTop + H * 0.30)
      ctx.lineTo(W, contentTop + H * 0.24)
      ctx.lineTo(W, contentTop + H * 0.40)
      ctx.lineTo(contentLeft, contentTop + H * 0.46)
      ctx.closePath()
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.92
      ctx.fill()
      ctx.restore()
    }

    if (logo && placement !== 'header') ctx.drawImage(logo, cx - 50, contentTop + 50, 100, 100)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 34px Arial'
    ctx.fillText(data.scheduleName.toUpperCase(), cx, contentTop + (placement === 'header' ? 70 : 200))

    ctx.font = `900 ${placement === 'side' ? 150 : 200}px Arial`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(day, cx, contentTop + 460)
    ctx.font = '700 46px Arial'
    ctx.fillStyle = accent
    ctx.fillText(month, cx, contentTop + 510)

    ctx.font = '700 34px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${weekday.toUpperCase()} • ${timeRange}`, cx, contentTop + 590)

    ctx.font = '600 32px Arial'
    ctx.fillStyle = '#ffffff'
    const venueLines = wrapText(ctx, '📍 ' + data.venue, contentWidth - 100)
    venueLines.forEach((l, i) => ctx.fillText(l, cx, contentTop + 650 + i * 40))

    ctx.font = 'italic 400 27px Georgia'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    const lines = wrapText(ctx, `"${data.quote}"`, contentWidth - 120)
    lines.forEach((l, i) => ctx.fillText(l, cx, contentTop + 780 + i * 38))

    ctx.font = '700 26px Arial'
    ctx.fillStyle = accent
    ctx.fillText('THE REBELS VOLLEYBALL', cx, H - 60)

  } else if (template === 'minimal') {
    ctx.strokeStyle = accent
    ctx.lineWidth = 6
    ctx.strokeRect(40, 40, W - 80, H - 80)

    if (logo && placement !== 'header') ctx.drawImage(logo, cx - 45, contentTop + 80, 90, 90)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#111111'
    ctx.font = '600 30px Arial'
    ctx.fillText(data.scheduleName, cx, contentTop + (placement === 'header' ? 60 : 230))

    ctx.fillStyle = accent
    ctx.fillRect(cx - 55, contentTop + 260, 110, 4)

    ctx.font = `300 ${placement === 'side' ? 100 : 120}px Arial`
    ctx.fillStyle = '#111111'
    ctx.fillText(day, cx, contentTop + 420)
    ctx.font = '600 30px Arial'
    ctx.fillStyle = accent
    ctx.fillText(`${month} • ${weekday.toUpperCase()}`, cx, contentTop + 465)

    ctx.font = '500 36px Arial'
    ctx.fillStyle = '#111111'
    ctx.fillText(timeRange, cx, contentTop + 560)

    ctx.font = '400 28px Arial'
    ctx.fillStyle = '#555555'
    const venueLines = wrapText(ctx, data.venue, contentWidth - 100)
    venueLines.forEach((l, i) => ctx.fillText(l, cx, contentTop + 610 + i * 36))

    ctx.font = 'italic 400 26px Georgia'
    ctx.fillStyle = '#888888'
    const lines = wrapText(ctx, `"${data.quote}"`, contentWidth - 160)
    lines.forEach((l, i) => ctx.fillText(l, cx, contentTop + 730 + i * 36))

    ctx.font = '700 22px Arial'
    ctx.fillStyle = accent
    ctx.fillText('THE REBELS VOLLEYBALL', cx, H - 90)

  } else {
    if (!photoSource || placement !== 'background') {
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(contentLeft, contentTop); ctx.lineTo(contentLeft + contentWidth * 0.55, contentTop); ctx.lineTo(contentLeft, contentTop + H * 0.18)
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }

    const padLeft = contentLeft + 70
    if (logo && placement !== 'header' && placement !== 'side') ctx.drawImage(logo, padLeft, contentTop + 50, 85, 85)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 28px Arial'
    ctx.fillText(data.scheduleName.toUpperCase(), placement === 'side' || placement === 'header' ? padLeft : padLeft + 100, contentTop + (placement === 'header' ? 50 : 105))

    ctx.font = `900 ${placement === 'side' ? 130 : 160}px Arial`
    ctx.fillStyle = accent
    ctx.fillText(day, padLeft, contentTop + 430)
    ctx.font = '800 42px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(month, padLeft, contentTop + 485)
    ctx.font = '600 28px Arial'
    ctx.fillStyle = '#cccccc'
    ctx.fillText(weekday.toUpperCase(), padLeft, contentTop + 525)

    ctx.font = '700 40px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('⏱ ' + timeRange, padLeft, contentTop + 610)
    ctx.font = '600 30px Arial'
    ctx.fillStyle = accent
    const venueLines = wrapText(ctx, '📍 ' + data.venue, contentWidth - 140)
    venueLines.forEach((l, i) => ctx.fillText(l, padLeft, contentTop + 660 + i * 36))

    ctx.textAlign = 'center'
    ctx.font = 'italic 600 27px Georgia'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    const lines = wrapText(ctx, `"${data.quote}"`, contentWidth - 140)
    lines.forEach((l, i) => ctx.fillText(l, cx, H - 220 + i * 38))

    ctx.font = '800 24px Arial'
    ctx.fillStyle = accent
    ctx.fillText('THE REBELS VOLLEYBALL CLUB', cx, H - 60)
  }
}

export function ScheduleCardGenerator({
  scheduleName,
  defaultVenue,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onClose,
}: {
  scheduleName: string
  defaultVenue: string
  defaultDate: string
  defaultStartTime: string
  defaultEndTime: string
  onClose: () => void
}) {
  const [template, setTemplate] = useState<Template>('bold')
  const [venue, setVenue] = useState(defaultVenue)
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState(defaultStartTime)
  const [endTime, setEndTime] = useState(defaultEndTime)
  const [quote, setQuote] = useState(randomQuote())
  const [generating, setGenerating] = useState(false)

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [treatment, setTreatment] = useState<ImageTreatment>('photo')
  const [placement, setPlacement] = useState<ImagePlacement>('header')
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [loadingGallery, setLoadingGallery] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadImage('/logo.png').then((img) => { logoRef.current = img; render() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!photoUrl) { photoRef.current = null; render(); return }
    loadImage(photoUrl).then((img) => { photoRef.current = img; render() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl])

  const render = useCallback(() => {
    if (!canvasRef.current) return
    drawCard(
      canvasRef.current,
      template,
      { scheduleName: scheduleName || 'Tournament', venue, date, startTime, endTime, quote },
      getLiveAccentRGB(),
      logoRef.current,
      photoRef.current,
      treatment,
      placement
    )
  }, [template, venue, date, startTime, endTime, quote, scheduleName, treatment, placement])

  useEffect(() => { render() }, [render])

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const openGalleryPicker = async () => {
    setShowGalleryPicker(true)
    setLoadingGallery(true)
    try {
      const imgs = await getGalleryImages()
      setGalleryImages(imgs)
    } catch {
      setGalleryImages([])
    }
    setLoadingGallery(false)
  }

  const handleDownload = () => {
    if (!canvasRef.current) return
    setGenerating(true)
    canvasRef.current.toBlob((blob) => {
      if (!blob) { setGenerating(false); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(scheduleName || 'schedule').replace(/\s+/g, '-').toLowerCase()}-card.jpg`
      a.click()
      URL.revokeObjectURL(url)
      setGenerating(false)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))] z-10">
          <h3 className="font-bold flex items-center gap-2"><ImageIcon size={18} /> Generate Schedule Card</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={18} /></button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <canvas ref={canvasRef} className="w-full max-w-[300px] rounded-xl shadow-lg border border-[rgb(var(--border-soft))]" />
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-2">1080 × 1350 — Instagram & Facebook ready</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Template</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bold', 'minimal', 'energetic'] as Template[]).map((t) => (
                  <button key={t} onClick={() => setTemplate(t)}
                    className={`py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${
                      template === t ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:border-blue-500'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Photo (optional)</label>
              {photoUrl ? (
                <div className="flex items-center gap-2">
                  <img src={photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-[rgb(var(--border-soft))]" />
                  <button onClick={handleUploadClick} className="text-xs px-3 py-2 rounded-lg border border-[rgb(var(--border-soft))] hover:border-blue-500 transition-colors">Change</button>
                  <button onClick={() => setPhotoUrl(null)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleUploadClick}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-dashed border-[rgb(var(--border-strong))] text-[rgb(var(--muted-fg))] hover:border-blue-500 hover:text-blue-500 transition-colors">
                    <Upload size={14} /> Upload
                  </button>
                  <button onClick={openGalleryPicker}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-dashed border-[rgb(var(--border-strong))] text-[rgb(var(--muted-fg))] hover:border-blue-500 hover:text-blue-500 transition-colors">
                    <Images size={14} /> From Gallery
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {photoUrl && (
              <>
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Treatment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['photo', 'silhouette'] as ImageTreatment[]).map((t) => (
                      <button key={t} onClick={() => setTreatment(t)}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${
                          treatment === t ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:border-blue-500'
                        }`}>
                        {t === 'photo' ? 'Full Photo' : 'Silhouette'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Placement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['header', 'background', 'side'] as ImagePlacement[]).map((p) => (
                      <button key={p} onClick={() => setPlacement(p)}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${
                          placement === p ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:border-blue-500'
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Venue</label>
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Rebels Sports Complex"
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center justify-between">
                <span>Quote</span>
                <button onClick={() => setQuote(randomQuote())} className="text-blue-500 flex items-center gap-1 text-[11px] font-semibold hover:underline">
                  <Sparkles size={11} /> Shuffle
                </button>
              </label>
              <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={2}
                className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 resize-none focus:outline-none focus:border-blue-500" />
            </div>

            <button onClick={handleDownload} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
              <Download size={16} /> {generating ? 'Generating…' : 'Download JPG'}
            </button>
          </div>
        </div>
      </div>

      {showGalleryPicker && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowGalleryPicker(false)}>
          <div className="bg-[rgb(var(--surface))] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))]">
              <h4 className="font-bold text-sm">Choose from Gallery</h4>
              <button onClick={() => setShowGalleryPicker(false)} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={16} /></button>
            </div>
            <div className="p-4">
              {loadingGallery ? (
                <p className="text-center text-sm text-[rgb(var(--muted-fg))] py-10">Loading…</p>
              ) : galleryImages.length === 0 ? (
                <p className="text-center text-sm text-[rgb(var(--muted-fg))] py-10">No gallery photos yet.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryImages.map((img) => (
                    <button key={img.id} onClick={() => { setPhotoUrl(img.url); setShowGalleryPicker(false); }}
                      className="aspect-square rounded-xl overflow-hidden border border-[rgb(var(--border-soft))] hover:border-blue-500 transition-colors">
                      <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
