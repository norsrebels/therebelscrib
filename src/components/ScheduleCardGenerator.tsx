// src/components/ScheduleCardGenerator.tsx
// Generates a branded 1080x1350 (4:5) JPG schedule card for sharing/inviting.
// Pulls date/venue/time from saved tournament settings but stays editable before
// generating. Layout flexibility: 3 templates, optional photo (upload or gallery,
// full/silhouette treatment, header/background/side placement), plus styling:
// accent color override, font family, text alignment, text color, logo toggle,
// custom footer text, and background style (solid/gradient/pattern).

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download, Sparkles, Image as ImageIcon, Upload, Images, Trash2, Palette } from 'lucide-react'
import { getGalleryImages, type GalleryImage } from '@/server/gallery.functions'
import { FONT_OPTIONS, loadFont, fontFamily, type FontChoice } from '@/lib/schedule-card-fonts'

type Template = 'bold' | 'minimal' | 'energetic'
type ImageTreatment = 'photo' | 'silhouette'
type ImagePlacement = 'header' | 'background' | 'side'
type Alignment = 'left' | 'center' | 'right'
type BackgroundStyle = 'solid' | 'gradient' | 'pattern'

interface CardStyle {
  accentRGB: string       // "r, g, b"
  font: FontChoice
  align: Alignment
  textColor: string       // hex or 'auto' to use template default
  showLogo: boolean
  footerText: string
  background: BackgroundStyle
}

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

function hexToRGBString(hex: string): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
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

/** Maps our Alignment type to canvas textAlign + an x-anchor within a content box. */
function alignAnchor(align: Alignment, left: number, width: number): { x: number; canvasAlign: CanvasTextAlign } {
  if (align === 'left') return { x: left + 60, canvasAlign: 'left' }
  if (align === 'right') return { x: left + width - 60, canvasAlign: 'right' }
  return { x: left + width / 2, canvasAlign: 'center' }
}

/** Fills the base card background per the chosen style + light/dark template mood. */
function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, isDark: boolean, accent: string, bg: BackgroundStyle) {
  if (bg === 'solid') {
    ctx.fillStyle = isDark ? '#0e0e14' : '#fafafa'
    ctx.fillRect(0, 0, w, h)
  } else if (bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, w, h)
    if (isDark) {
      g.addColorStop(0, '#0a0a0f')
      g.addColorStop(1, '#1a1a24')
    } else {
      g.addColorStop(0, '#ffffff')
      g.addColorStop(1, '#f0f0f0')
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  } else {
    // pattern: base fill + faint diagonal accent stripes
    ctx.fillStyle = isDark ? '#0e0e14' : '#fafafa'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.strokeStyle = accent
    ctx.lineWidth = 18
    for (let i = -h; i < w + h; i += 70) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + h, h)
      ctx.stroke()
    }
    ctx.restore()
  }
}

const W = 1080
const H = 1350

async function drawCard(
  canvas: HTMLCanvasElement,
  template: Template,
  data: { scheduleName: string; venue: string; date: string; startTime: string; endTime: string; quote: string },
  style: CardStyle,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  treatment: ImageTreatment,
  placement: ImagePlacement
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = W
  canvas.height = H
  const accent = `rgb(${style.accentRGB})`
  const fam = fontFamily(style.font)
  const { day, month, weekday } = formatDateDisplay(data.date)
  const timeRange = `${formatTimeDisplay(data.startTime)} – ${formatTimeDisplay(data.endTime)}`

  const photoSource: HTMLImageElement | HTMLCanvasElement | null =
    photo ? (treatment === 'silhouette' ? buildSilhouetteCanvas(photo, style.accentRGB) : photo) : null

  const isDark = template !== 'minimal'
  const primaryText = style.textColor !== 'auto' ? style.textColor : (isDark ? '#ffffff' : '#111111')
  const mutedText = style.textColor !== 'auto' ? style.textColor : (isDark ? 'rgba(255,255,255,0.75)' : '#555555')

  paintBackground(ctx, W, H, isDark, accent, style.background)

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
      fade.addColorStop(1, isDark ? '#0e0e14' : '#fafafa')
      ctx.fillStyle = fade
      ctx.fillRect(0, bandH - 140, W, 140)
    }
    ctx.restore()
    contentTop = bandH - 60
  }

  if (photoSource && placement === 'side') {
    const sideW = W * 0.34
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

  const { x: anchorX, canvasAlign } = alignAnchor(style.align, contentLeft, contentWidth)
  ctx.textAlign = canvasAlign
  // For quotes/footer we always want them readable across the full content width,
  // so compute a center-x separately regardless of the chosen text alignment.
  const cx = contentLeft + contentWidth / 2
  const wrapW = contentWidth - 140

  // ════════════════════════════════════ BOLD ════════════════════════════════
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

    if (style.showLogo && logo && placement !== 'header') ctx.drawImage(logo, cx - 50, contentTop + 50, 100, 100)

    ctx.fillStyle = primaryText
    ctx.font = `700 34px ${fam}`
    ctx.fillText(data.scheduleName.toUpperCase(), anchorX, contentTop + (placement === 'header' ? 70 : 200))

    ctx.textAlign = canvasAlign
    ctx.font = `900 ${placement === 'side' ? 150 : 200}px ${fam}`
    ctx.fillStyle = primaryText
    ctx.fillText(day, anchorX, contentTop + 460)
    ctx.font = `700 46px ${fam}`
    ctx.fillStyle = accent
    ctx.fillText(month, anchorX, contentTop + 510)

    ctx.font = `700 34px ${fam}`
    ctx.fillStyle = primaryText
    ctx.fillText(`${weekday.toUpperCase()} • ${timeRange}`, anchorX, contentTop + 590)

    ctx.font = `600 32px ${fam}`
    ctx.fillStyle = primaryText
    wrapText(ctx, '📍 ' + data.venue, wrapW).forEach((l, i) => ctx.fillText(l, anchorX, contentTop + 650 + i * 40))

    ctx.textAlign = 'center'
    ctx.font = `italic 400 27px Georgia`
    ctx.fillStyle = mutedText
    wrapText(ctx, `"${data.quote}"`, wrapW).forEach((l, i) => ctx.fillText(l, cx, contentTop + 780 + i * 38))

    ctx.font = `700 26px ${fam}`
    ctx.fillStyle = accent
    ctx.fillText(style.footerText.toUpperCase(), cx, H - 60)

  // ═══════════════════════════════════ MINIMAL ══════════════════════════════
  } else if (template === 'minimal') {
    ctx.strokeStyle = accent
    ctx.lineWidth = 6
    ctx.strokeRect(40, 40, W - 80, H - 80)

    if (style.showLogo && logo && placement !== 'header') ctx.drawImage(logo, cx - 45, contentTop + 80, 90, 90)

    ctx.textAlign = canvasAlign
    ctx.fillStyle = primaryText
    ctx.font = `600 30px ${fam}`
    ctx.fillText(data.scheduleName, anchorX, contentTop + (placement === 'header' ? 60 : 230))

    ctx.fillStyle = accent
    const ruleX = style.align === 'left' ? anchorX : style.align === 'right' ? anchorX - 110 : cx - 55
    ctx.fillRect(ruleX, contentTop + 260, 110, 4)

    ctx.font = `300 ${placement === 'side' ? 100 : 120}px ${fam}`
    ctx.fillStyle = primaryText
    ctx.fillText(day, anchorX, contentTop + 420)
    ctx.font = `600 30px ${fam}`
    ctx.fillStyle = accent
    ctx.fillText(`${month} • ${weekday.toUpperCase()}`, anchorX, contentTop + 465)

    ctx.font = `500 36px ${fam}`
    ctx.fillStyle = primaryText
    ctx.fillText(timeRange, anchorX, contentTop + 560)

    ctx.font = `400 28px ${fam}`
    ctx.fillStyle = mutedText
    wrapText(ctx, data.venue, wrapW).forEach((l, i) => ctx.fillText(l, anchorX, contentTop + 610 + i * 36))

    ctx.textAlign = 'center'
    ctx.font = `italic 400 26px Georgia`
    ctx.fillStyle = mutedText
    wrapText(ctx, `"${data.quote}"`, wrapW).forEach((l, i) => ctx.fillText(l, cx, contentTop + 730 + i * 36))

    ctx.font = `700 22px ${fam}`
    ctx.fillStyle = accent
    ctx.fillText(style.footerText.toUpperCase(), cx, H - 90)

  // ══════════════════════════════════ ENERGETIC ═════════════════════════════
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
    const leftAnchor = style.align === 'right' ? contentLeft + contentWidth - 70 : padLeft
    const leftCanvasAlign: CanvasTextAlign = style.align === 'right' ? 'right' : style.align === 'center' ? 'center' : 'left'
    const effAnchor = style.align === 'center' ? cx : leftAnchor

    if (style.showLogo && logo && placement !== 'header' && placement !== 'side') ctx.drawImage(logo, padLeft, contentTop + 50, 85, 85)

    ctx.textAlign = leftCanvasAlign
    ctx.fillStyle = primaryText
    ctx.font = `800 28px ${fam}`
    ctx.fillText(data.scheduleName.toUpperCase(), effAnchor, contentTop + (placement === 'header' ? 50 : 105))

    ctx.font = `900 ${placement === 'side' ? 130 : 160}px ${fam}`
    ctx.fillStyle = accent
    ctx.fillText(day, effAnchor, contentTop + 430)
    ctx.font = `800 42px ${fam}`
    ctx.fillStyle = primaryText
    ctx.fillText(month, effAnchor, contentTop + 485)
    ctx.font = `600 28px ${fam}`
    ctx.fillStyle = mutedText
    ctx.fillText(weekday.toUpperCase(), effAnchor, contentTop + 525)

    ctx.font = `700 40px ${fam}`
    ctx.fillStyle = primaryText
    ctx.fillText('⏱ ' + timeRange, effAnchor, contentTop + 610)
    ctx.font = `600 30px ${fam}`
    ctx.fillStyle = accent
    wrapText(ctx, '📍 ' + data.venue, wrapW).forEach((l, i) => ctx.fillText(l, effAnchor, contentTop + 660 + i * 36))

    ctx.textAlign = 'center'
    ctx.font = `italic 600 27px Georgia`
    ctx.fillStyle = mutedText
    wrapText(ctx, `"${data.quote}"`, wrapW).forEach((l, i) => ctx.fillText(l, cx, H - 220 + i * 38))

    ctx.font = `800 24px ${fam}`
    ctx.fillStyle = accent
    ctx.fillText(style.footerText.toUpperCase(), cx, H - 60)
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

  // Image
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [treatment, setTreatment] = useState<ImageTreatment>('photo')
  const [placement, setPlacement] = useState<ImagePlacement>('header')
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [loadingGallery, setLoadingGallery] = useState(false)

  // Style
  const [useCustomAccent, setUseCustomAccent] = useState(false)
  const [customAccentHex, setCustomAccentHex] = useState('#0071e3')
  const [font, setFont] = useState<FontChoice>('arial')
  const [fontLoading, setFontLoading] = useState(false)
  const [align, setAlign] = useState<Alignment>('center')
  const [textColorMode, setTextColorMode] = useState<'auto' | 'custom'>('auto')
  const [customTextHex, setCustomTextHex] = useState('#ffffff')
  const [showLogo, setShowLogo] = useState(true)
  const [footerText, setFooterText] = useState('The Rebels Volleyball')
  const [background, setBackground] = useState<BackgroundStyle>('gradient')

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

  useEffect(() => {
    let cancelled = false
    setFontLoading(true)
    loadFont(font).then(() => { if (!cancelled) { setFontLoading(false); render() } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [font])

  const render = useCallback(() => {
    if (!canvasRef.current) return
    const style: CardStyle = {
      accentRGB: useCustomAccent ? hexToRGBString(customAccentHex) : getLiveAccentRGB(),
      font,
      align,
      textColor: textColorMode === 'custom' ? customTextHex : 'auto',
      showLogo,
      footerText: footerText || 'The Rebels Volleyball',
      background,
    }
    drawCard(
      canvasRef.current,
      template,
      { scheduleName: scheduleName || 'Tournament', venue, date, startTime, endTime, quote },
      style,
      logoRef.current,
      photoRef.current,
      treatment,
      placement
    )
  }, [template, venue, date, startTime, endTime, quote, scheduleName, treatment, placement,
      useCustomAccent, customAccentHex, font, align, textColorMode, customTextHex, showLogo, footerText, background])

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

  const SegBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={`py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${
        active ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:border-blue-500'
      }`}>
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))] z-10">
          <h3 className="font-bold flex items-center gap-2"><ImageIcon size={18} /> Generate Schedule Card</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={18} /></button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="flex flex-col items-center md:sticky md:top-20 self-start">
            <canvas ref={canvasRef} className="w-full max-w-[300px] rounded-xl shadow-lg border border-[rgb(var(--border-soft))]" />
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-2">1080 × 1350 — Instagram & Facebook ready</p>
            {fontLoading && <p className="text-[11px] text-blue-500 mt-1">Loading font…</p>}
          </div>

          {/* Controls */}
          <div className="space-y-5">
            {/* Template */}
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Template</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bold', 'minimal', 'energetic'] as Template[]).map((t) => (
                  <SegBtn key={t} active={template === t} onClick={() => setTemplate(t)}>{t}</SegBtn>
                ))}
              </div>
            </div>

            {/* Photo */}
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
                    <SegBtn active={treatment === 'photo'} onClick={() => setTreatment('photo')}>Full Photo</SegBtn>
                    <SegBtn active={treatment === 'silhouette'} onClick={() => setTreatment('silhouette')}>Silhouette</SegBtn>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Placement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['header', 'background', 'side'] as ImagePlacement[]).map((p) => (
                      <SegBtn key={p} active={placement === p} onClick={() => setPlacement(p)}>{p}</SegBtn>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-[rgb(var(--border-soft))] pt-4">
              <p className="text-xs font-bold text-[rgb(var(--fg))] mb-3 flex items-center gap-1.5"><Palette size={13} /> Design Flexibility</p>

              {/* Accent color */}
              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Accent Color</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setUseCustomAccent(false)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${!useCustomAccent ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>
                    Site Theme
                  </button>
                  <button onClick={() => setUseCustomAccent(true)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${useCustomAccent ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>
                    Custom
                  </button>
                  {useCustomAccent && (
                    <input type="color" value={customAccentHex} onChange={(e) => setCustomAccentHex(e.target.value)}
                      className="w-10 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />
                  )}
                </div>
              </div>

              {/* Font */}
              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Font Style</label>
                <select value={font} onChange={(e) => setFont(e.target.value as FontChoice)}
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500">
                  {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              {/* Alignment */}
              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Text Alignment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'right'] as Alignment[]).map((a) => (
                    <SegBtn key={a} active={align === a} onClick={() => setAlign(a)}>{a}</SegBtn>
                  ))}
                </div>
              </div>

              {/* Text color */}
              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Text Color</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTextColorMode('auto')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${textColorMode === 'auto' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>
                    Auto (Template Default)
                  </button>
                  <button onClick={() => setTextColorMode('custom')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${textColorMode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>
                    Custom
                  </button>
                  {textColorMode === 'custom' && (
                    <input type="color" value={customTextHex} onChange={(e) => setCustomTextHex(e.target.value)}
                      className="w-10 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />
                  )}
                </div>
              </div>

              {/* Background style */}
              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Background Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['solid', 'gradient', 'pattern'] as BackgroundStyle[]).map((b) => (
                    <SegBtn key={b} active={background === b} onClick={() => setBackground(b)}>{b}</SegBtn>
                  ))}
                </div>
              </div>

              {/* Logo toggle */}
              <div className="mb-4 flex items-center justify-between">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))]">Show Club Logo</label>
                <button onClick={() => setShowLogo(!showLogo)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${showLogo ? 'bg-blue-600' : 'bg-[rgb(var(--border-soft))]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showLogo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Footer text */}
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Footer Text</label>
                <input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="The Rebels Volleyball"
                  className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="border-t border-[rgb(var(--border-soft))] pt-4 space-y-4">
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
