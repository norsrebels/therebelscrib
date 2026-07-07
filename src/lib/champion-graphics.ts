// src/lib/champion-graphics.ts
// Volleyball-themed vector graphics for the champions pubmat. Each graphic is an
// SVG path set drawn onto a 100x100 unit box, so it scales crisply to any size and
// can be tinted. Kept as data (not image files) so they need no hosting/CORS and
// serialize cleanly into saved pubmat presets (future-proof). Add new graphics by
// appending to GRAPHICS — no rendering changes needed.

export type GraphicKey = 'volleyball' | 'net' | 'starburst' | 'ribbon' | 'medal' | 'whistle'

export interface GraphicDef {
  key: GraphicKey
  label: string
  // Draw into a 0..100 box. `color` is the themed accent; `dark` a contrast tone.
  draw: (ctx: CanvasRenderingContext2D, color: string, dark: string) => void
  // Preview SVG markup for the palette (small, uses currentColor).
  preview: string
}

export const GRAPHICS: GraphicDef[] = [
  {
    key: 'volleyball',
    label: 'Volleyball',
    preview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3c-3 4-3 10 0 18M12 3c3 4 3 10 0 18M3.5 8c5 1 11 1 17 0M4 16c4-2 12-2 16 0"/></svg>`,
    draw: (ctx, color, dark) => {
      ctx.save()
      // Ball body.
      ctx.beginPath(); ctx.arc(50, 50, 46, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.fill()
      ctx.lineWidth = 4; ctx.strokeStyle = dark; ctx.stroke()
      // Panel seams (three curved families).
      ctx.lineWidth = 3.5; ctx.strokeStyle = color
      ctx.beginPath(); ctx.moveTo(50, 5); ctx.bezierCurveTo(38, 30, 38, 70, 50, 95); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(50, 5); ctx.bezierCurveTo(62, 30, 62, 70, 50, 95); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(8, 30); ctx.bezierCurveTo(35, 40, 65, 40, 92, 30); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(9, 66); ctx.bezierCurveTo(35, 58, 65, 58, 91, 66); ctx.stroke()
      ctx.restore()
    },
  },
  {
    key: 'net',
    label: 'Net',
    preview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6h20M2 18h20M5 6v12M9 6v12M13 6v12M17 6v12M21 6v12M2 10h20M2 14h20"/></svg>`,
    draw: (ctx, color) => {
      ctx.save()
      ctx.lineWidth = 3; ctx.strokeStyle = color
      // Top & bottom bands.
      ctx.strokeRect(4, 20, 92, 60)
      // Vertical strings.
      for (let x = 16; x < 96; x += 12) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 80); ctx.stroke() }
      // Horizontal strings.
      for (let y = 32; y < 80; y += 12) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(96, y); ctx.stroke() }
      ctx.restore()
    },
  },
  {
    key: 'starburst',
    label: 'Star burst',
    preview: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.5L21 9l-5 4.2L17.5 20 12 16.2 6.5 20 8 13.2 3 9l6.6-.5z"/></svg>`,
    draw: (ctx, color, dark) => {
      ctx.save(); ctx.translate(50, 50)
      // Radiant rays.
      ctx.fillStyle = color
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12)
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(6, -46); ctx.lineTo(-6, -46); ctx.closePath(); ctx.fill()
      }
      // Center star.
      ctx.fillStyle = dark
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 20 : 9
        const a = (Math.PI / 5) * i - Math.PI / 2
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.closePath(); ctx.fill()
      ctx.restore()
    },
  },
  {
    key: 'ribbon',
    label: 'Ribbon',
    preview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="6"/><path d="M8.5 13l-2.5 8 6-3 6 3-2.5-8"/></svg>`,
    draw: (ctx, color, dark) => {
      ctx.save()
      // Tails.
      ctx.fillStyle = dark
      ctx.beginPath(); ctx.moveTo(35, 55); ctx.lineTo(28, 95); ctx.lineTo(48, 80); ctx.lineTo(50, 60); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(65, 55); ctx.lineTo(72, 95); ctx.lineTo(52, 80); ctx.lineTo(50, 60); ctx.closePath(); ctx.fill()
      // Rosette.
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(50, 38, 30, 0, Math.PI * 2); ctx.fill()
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(50, 38, 22, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(50, 38, 10, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    },
  },
  {
    key: 'medal',
    label: 'Medal',
    preview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3l4 8 4-8"/><circle cx="12" cy="16" r="5"/></svg>`,
    draw: (ctx, color, dark) => {
      ctx.save()
      // Ribbon straps.
      ctx.fillStyle = dark
      ctx.beginPath(); ctx.moveTo(35, 4); ctx.lineTo(50, 48); ctx.lineTo(44, 48); ctx.lineTo(30, 6); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(65, 4); ctx.lineTo(50, 48); ctx.lineTo(56, 48); ctx.lineTo(70, 6); ctx.closePath(); ctx.fill()
      // Medal disc.
      const g = ctx.createRadialGradient(44, 60, 4, 50, 66, 30)
      g.addColorStop(0, '#fff'); g.addColorStop(0.3, color); g.addColorStop(1, dark)
      ctx.beginPath(); ctx.arc(50, 66, 28, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff88'; ctx.stroke()
      // Star.
      ctx.fillStyle = '#ffffff'; ctx.beginPath()
      for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? 14 : 6; const a = (Math.PI / 5) * i - Math.PI / 2; ctx.lineTo(50 + Math.cos(a) * r, 66 + Math.sin(a) * r) }
      ctx.closePath(); ctx.fill()
      ctx.restore()
    },
  },
  {
    key: 'whistle',
    label: 'Whistle',
    preview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10h9l4-2v8l-4-2H8a5 5 0 1 1-5 4z"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/></svg>`,
    draw: (ctx, color, dark) => {
      ctx.save()
      ctx.fillStyle = color
      // Body.
      ctx.beginPath(); ctx.arc(38, 60, 26, 0, Math.PI * 2); ctx.fill()
      ctx.fillRect(38, 34, 44, 26)
      // Mouthpiece.
      ctx.beginPath(); ctx.moveTo(82, 34); ctx.lineTo(94, 30); ctx.lineTo(94, 60); ctx.lineTo(82, 60); ctx.closePath(); ctx.fill()
      // Pea hole.
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(38, 62, 7, 0, Math.PI * 2); ctx.fill()
      // Loop.
      ctx.lineWidth = 4; ctx.strokeStyle = color
      ctx.beginPath(); ctx.arc(20, 74, 12, -Math.PI * 0.4, Math.PI * 1.2); ctx.stroke()
      ctx.restore()
    },
  },
]

export function getGraphic(key: GraphicKey): GraphicDef | undefined {
  return GRAPHICS.find((g) => g.key === key)
}
