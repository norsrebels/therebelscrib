// src/components/ScheduleCardGenerator.tsx
// Generates a branded 1080x1350 (4:5) JPG schedule card for sharing/inviting.
// Pulls date/venue/time from saved tournament settings but stays editable before
// generating, since schedules are sometimes finalized late. Three template styles;
// pulls the club logo and the live accent color so it follows the site's branding.

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download, Sparkles, Image as ImageIcon } from 'lucide-react'

type Template = 'bold' | 'minimal' | 'energetic'

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

const W = 1080
const H = 1350

async function drawCard(
  canvas: HTMLCanvasElement,
  template: Template,
  data: { scheduleName: string; venue: string; date: string; startTime: string; endTime: string; quote: string },
  accentRGB: string,
  logo: HTMLImageElement | null
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = W
  canvas.height = H
  const accent = `rgb(${accentRGB})`
  const { day, month, weekday } = formatDateDisplay(data.date)
  const timeRange = `${formatTimeDisplay(data.startTime)} – ${formatTimeDisplay(data.endTime)}`

  if (template === 'bold') {
    // Full-bleed deep gradient, huge date block, accent diagonal band
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#0a0a0f')
    grad.addColorStop(1, '#1a1a24')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Diagonal accent band
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, H * 0.38)
    ctx.lineTo(W, H * 0.30)
    ctx.lineTo(W, H * 0.46)
    ctx.lineTo(0, H * 0.54)
    ctx.closePath()
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.92
    ctx.fill()
    ctx.restore()

    if (logo) ctx.drawImage(logo, W / 2 - 60, 70, 120, 120)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 38px Arial'
    ctx.fillText(data.scheduleName.toUpperCase(), W / 2, 240)

    // Huge date
    ctx.font = '900 220px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(day, W / 2, 560)
    ctx.font = '700 50px Arial'
    ctx.fillStyle = accent
    ctx.fillText(month, W / 2, 610)

    // Diagonal band text (weekday + time)
    ctx.save()
    ctx.translate(W / 2, H * 0.42)
    ctx.rotate(-0.045)
    ctx.font = '800 42px Arial'
    ctx.fillStyle = '#0a0a0f'
    ctx.fillText(`${weekday.toUpperCase()} • ${timeRange}`, 0, 12)
    ctx.restore()

    // Venue
    ctx.font = '600 36px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('📍 ' + data.venue, W / 2, 760)

    // Quote
    ctx.font = 'italic 400 30px Georgia'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    const lines = wrapText(ctx, `"${data.quote}"`, W - 160)
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 900 + i * 42))

    // Footer
    ctx.font = '700 28px Arial'
    ctx.fillStyle = accent
    ctx.fillText('REBELS VOLLEYBALL CLUB', W / 2, H - 70)

  } else if (template === 'minimal') {
    // Clean white card, thin accent rule, generous whitespace
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = accent
    ctx.lineWidth = 6
    ctx.strokeRect(40, 40, W - 80, H - 80)

    if (logo) ctx.drawImage(logo, W / 2 - 50, 100, 100, 100)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#111111'
    ctx.font = '600 32px Arial'
    ctx.fillText(data.scheduleName, W / 2, 260)

    ctx.fillStyle = accent
    ctx.fillRect(W / 2 - 60, 300, 120, 4)

    ctx.font = '300 130px Arial'
    ctx.fillStyle = '#111111'
    ctx.fillText(day, W / 2, 470)
    ctx.font = '600 34px Arial'
    ctx.fillStyle = accent
    ctx.fillText(`${month} • ${weekday.toUpperCase()}`, W / 2, 520)

    ctx.font = '500 40px Arial'
    ctx.fillStyle = '#111111'
    ctx.fillText(timeRange, W / 2, 630)

    ctx.font = '400 32px Arial'
    ctx.fillStyle = '#555555'
    ctx.fillText(data.venue, W / 2, 690)

    ctx.font = 'italic 400 28px Georgia'
    ctx.fillStyle = '#888888'
    const lines = wrapText(ctx, `"${data.quote}"`, W - 240)
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 950 + i * 40))

    ctx.font = '700 24px Arial'
    ctx.fillStyle = accent
    ctx.fillText('REBELS VOLLEYBALL CLUB', W / 2, H - 90)

  } else {
    // energetic: angular shapes, bright accent, dynamic type
    ctx.fillStyle = '#101014'
    ctx.fillRect(0, 0, W, H)

    // Angular accent shapes
    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.moveTo(0, 0); ctx.lineTo(W * 0.55, 0); ctx.lineTo(0, H * 0.22)
    ctx.closePath(); ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(W, H); ctx.lineTo(W * 0.4, H); ctx.lineTo(W, H * 0.78)
    ctx.closePath(); ctx.fill()
    ctx.restore()

    if (logo) ctx.drawImage(logo, 60, 60, 90, 90)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 30px Arial'
    ctx.fillText(data.scheduleName.toUpperCase(), 170, 110)

    ctx.font = '900 180px Arial'
    ctx.fillStyle = accent
    ctx.fillText(day, 70, 470)
    ctx.font = '800 46px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(month, 70, 530)
    ctx.font = '600 32px Arial'
    ctx.fillStyle = '#cccccc'
    ctx.fillText(weekday.toUpperCase(), 70, 575)

    ctx.font = '700 46px Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('⏱ ' + timeRange, 70, 670)
    ctx.font = '600 36px Arial'
    ctx.fillStyle = accent
    ctx.fillText('📍 ' + data.venue, 70, 725)

    ctx.textAlign = 'center'
    ctx.font = 'italic 600 30px Georgia'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    const lines = wrapText(ctx, `"${data.quote}"`, W - 160)
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 980 + i * 42))

    ctx.font = '800 26px Arial'
    ctx.fillStyle = accent
    ctx.fillText('REBELS VOLLEYBALL CLUB', W / 2, H - 70)
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    loadImage('/logo.png').then((img) => { logoRef.current = img; render() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const render = useCallback(() => {
    if (!canvasRef.current) return
    drawCard(
      canvasRef.current,
      template,
      { scheduleName: scheduleName || 'Tournament', venue, date, startTime, endTime, quote },
      getLiveAccentRGB(),
      logoRef.current
    )
  }, [template, venue, date, startTime, endTime, quote, scheduleName])

  useEffect(() => { render() }, [render])

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
        className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))] z-10">
          <h3 className="font-bold flex items-center gap-2"><ImageIcon size={18} /> Generate Schedule Card</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={18} /></button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="flex flex-col items-center">
            <canvas ref={canvasRef} className="w-full max-w-[280px] rounded-xl shadow-lg border border-[rgb(var(--border-soft))]" />
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-2">1080 × 1350 — Instagram & Facebook ready</p>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Template</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bold', 'minimal', 'energetic'] as Template[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTemplate(t)}
                    className={`py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${
                      template === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))] hover:border-blue-500'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

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

            <button
              onClick={handleDownload}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Download size={16} /> {generating ? 'Generating…' : 'Download JPG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
