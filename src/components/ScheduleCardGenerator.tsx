// src/components/ScheduleCardGenerator.tsx
// Generates a branded JPG schedule card for sharing/inviting. Pulls date/venue/time
// from saved tournament settings but stays editable before generating.
// Flexibility: 4 output dimensions, 6 themes, optional photo (upload/gallery,
// full/silhouette, header/background/side), accent color, font, alignment,
// text color, title size, flexible logo placement, no-quote toggle, background
// style, custom footer, 2x print-quality download, and a randomize button.

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Download, Sparkles, Image as ImageIcon, Upload, Images, Trash2, Palette, Shuffle } from 'lucide-react'
import { getGalleryImages, type GalleryImage } from '@/server/gallery.functions'
import { getCardThemes, saveCardTheme, deleteCardTheme, type CardTheme } from '@/server/card-themes.functions'
import { FONT_OPTIONS, loadFont, fontFamily, type FontChoice } from '@/lib/schedule-card-fonts'
import { drawQrToCanvas, registrationUrl } from '@/lib/qrcode'

type Template = 'bold' | 'minimal' | 'energetic' | 'gradientPop' | 'nightCourt' | 'retroBlock'
type ImageTreatment = 'photo' | 'silhouette' | 'grayscale' | 'duotone' | 'blur' | 'tint'
type ImagePlacement = 'header' | 'footer' | 'background' | 'side' | 'badge'
type SidePosition = 'left' | 'right'
type Alignment = 'left' | 'center' | 'right'
type BackgroundStyle = 'solid' | 'gradient' | 'pattern'
type Dimension = 'portrait' | 'square' | 'banner' | 'story'
type TitleSize = 'small' | 'normal' | 'big' | 'huge'
type LogoH = 'left' | 'center' | 'right'
type LogoV = 'top' | 'bottom'

const DIMENSIONS: Record<Dimension, { w: number; h: number; label: string }> = {
  portrait: { w: 1080, h: 1350, label: 'Portrait 4:5' },
  square:   { w: 1080, h: 1080, label: 'Square 1:1' },
  banner:   { w: 1500, h: 500,  label: 'Banner (wide)' },
  story:    { w: 1080, h: 1920, label: 'Story 9:16' },
}

const TITLE_SCALE: Record<TitleSize, number> = { small: 0.75, normal: 1, big: 1.3, huge: 1.7 }

const THEMES: { value: Template; label: string }[] = [
  { value: 'bold', label: 'Bold' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'gradientPop', label: 'Gradient Pop' },
  { value: 'nightCourt', label: 'Night Court' },
  { value: 'retroBlock', label: 'Retro Block' },
]

interface CardStyle {
  accentRGB: string
  font: FontChoice
  align: Alignment
  textColor: string
  showLogo: boolean
  logoH: LogoH
  logoV: LogoV
  footerText: string
  background: BackgroundStyle
  titleSize: TitleSize
  showQuote: boolean
  showQR: boolean
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
    data[i] = ar; data[i + 1] = ag; data[i + 2] = ab
    data[i + 3] = Math.round(alpha * 255)
  }
  octx.putImageData(imageData, 0, 0)
  return off
}

// Applies a full-image treatment (grayscale / duotone / blur / tint) and returns
// a canvas. 'photo' returns the image untouched; 'silhouette' is handled separately.
function processImage(img: HTMLImageElement, treatment: ImageTreatment, accentRGB: string): HTMLImageElement | HTMLCanvasElement {
  if (treatment === 'photo') return img
  if (treatment === 'silhouette') return buildSilhouetteCanvas(img, accentRGB)

  const off = document.createElement('canvas')
  off.width = img.width
  off.height = img.height
  const octx = off.getContext('2d')!
  const [ar, ag, ab] = accentRGB.split(',').map((n) => parseInt(n.trim(), 10))

  if (treatment === 'blur') {
    // Canvas filter blur, scaled to image size so it reads on large canvases.
    octx.filter = `blur(${Math.round(img.width * 0.012)}px)`
    octx.drawImage(img, 0, 0)
    octx.filter = 'none'
    return off
  }

  octx.drawImage(img, 0, 0)
  const imageData = octx.getImageData(0, 0, off.width, off.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (treatment === 'grayscale') {
      data[i] = data[i + 1] = data[i + 2] = lum
    } else if (treatment === 'duotone') {
      // Map luminance between dark and the accent color (two-tone).
      const t = lum / 255
      data[i] = Math.round(20 + (ar - 20) * t)
      data[i + 1] = Math.round(20 + (ag - 20) * t)
      data[i + 2] = Math.round(20 + (ab - 20) * t)
    } else if (treatment === 'tint') {
      // Keep the photo but wash it toward the accent color.
      data[i] = Math.round(r * 0.55 + ar * 0.45)
      data[i + 1] = Math.round(g * 0.55 + ag * 0.45)
      data[i + 2] = Math.round(b * 0.55 + ab * 0.45)
    }
  }
  octx.putImageData(imageData, 0, 0)
  return off
}

// A stack element to be laid out vertically and centered in the content area.
type StackItem =
  | { kind: 'text'; text: string; font: string; color: string; gapAfter: number; lineHeight: number; maxWidth?: number }
  | { kind: 'gap'; height: number }
  | { kind: 'rule'; width: number; height: number; color: string; gapAfter: number }

function measureStack(ctx: CanvasRenderingContext2D, items: StackItem[]): { total: number; lines: (string[] | null)[] } {
  let total = 0
  const lines: (string[] | null)[] = []
  for (const it of items) {
    if (it.kind === 'gap') { total += it.height; lines.push(null); continue }
    if (it.kind === 'rule') { total += it.height + it.gapAfter; lines.push(null); continue }
    ctx.font = it.font
    const wrapped = it.maxWidth ? wrapText(ctx, it.text, it.maxWidth) : [it.text]
    lines.push(wrapped)
    total += wrapped.length * it.lineHeight + it.gapAfter
  }
  return { total, lines }
}

// Renders a measured stack, vertically centered within [top, top+areaH], at anchorX.
function renderStack(
  ctx: CanvasRenderingContext2D,
  items: StackItem[],
  anchorX: number, canvasAlign: CanvasTextAlign,
  top: number, areaH: number
) {
  const { total, lines } = measureStack(ctx, items)
  let y = top + Math.max(0, (areaH - total) / 2)
  ctx.textAlign = canvasAlign
  items.forEach((it, idx) => {
    if (it.kind === 'gap') { y += it.height; return }
    if (it.kind === 'rule') {
      const rx = canvasAlign === 'left' ? anchorX : canvasAlign === 'right' ? anchorX - it.width : anchorX - it.width / 2
      ctx.fillStyle = it.color
      ctx.fillRect(rx, y + it.height, it.width, it.height)
      y += it.height + it.gapAfter
      return
    }
    ctx.font = it.font
    ctx.fillStyle = it.color
    const wrapped = lines[idx] as string[]
    wrapped.forEach((ln) => { y += it.lineHeight; ctx.fillText(ln, anchorX, y) })
    y += it.gapAfter
  })
}

function alignAnchor(align: Alignment, left: number, width: number): { x: number; canvasAlign: CanvasTextAlign } {
  if (align === 'left') return { x: left + width * 0.08, canvasAlign: 'left' }
  if (align === 'right') return { x: left + width * 0.92, canvasAlign: 'right' }
  return { x: left + width / 2, canvasAlign: 'center' }
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, isDark: boolean, accent: string, bg: BackgroundStyle) {
  if (bg === 'solid') {
    ctx.fillStyle = isDark ? '#0e0e14' : '#fafafa'
    ctx.fillRect(0, 0, w, h)
  } else if (bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, w, h)
    if (isDark) { g.addColorStop(0, '#0a0a0f'); g.addColorStop(1, '#1a1a24') }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f0f0f0') }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = isDark ? '#0e0e14' : '#fafafa'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.strokeStyle = accent
    ctx.lineWidth = 18
    for (let i = -h; i < w + h; i += 70) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke()
    }
    ctx.restore()
  }
}

// Draws the logo at the chosen horizontal/vertical corner within a content box.
function drawLogo(
  ctx: CanvasRenderingContext2D, logo: HTMLImageElement,
  boxLeft: number, boxWidth: number, boxTop: number, boxH: number,
  logoH: LogoH, logoV: LogoV, size: number
) {
  const pad = Math.max(30, boxWidth * 0.05)
  let x = logoH === 'left' ? boxLeft + pad : logoH === 'right' ? boxLeft + boxWidth - pad - size : boxLeft + (boxWidth - size) / 2
  let y = logoV === 'top' ? boxTop + pad : boxTop + boxH - pad - size
  ctx.drawImage(logo, x, y, size, size)
}

async function drawCard(
  canvas: HTMLCanvasElement,
  template: Template,
  dimension: Dimension,
  data: { scheduleName: string; venue: string; date: string; startTime: string; endTime: string; quote: string },
  style: CardStyle,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  treatment: ImageTreatment,
  placement: ImagePlacement,
  sidePos: SidePosition,
  scaleFactor: number = 1
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dim = DIMENSIONS[dimension]
  const W = dim.w * scaleFactor
  const H = dim.h * scaleFactor
  canvas.width = W
  canvas.height = H

  // Base unit scales type to the canvas so text fills each format proportionally.
  // Banner is short and wide — key off its (small) height with extra compaction
  // so the whole text stack fits the limited vertical space.
  const bannerMode = dimension === 'banner'
  const U = (bannerMode ? (H / 500) * 0.62 : (H / 1350)) * scaleFactor
  const ts = TITLE_SCALE[style.titleSize]

  const accent = `rgb(${style.accentRGB})`
  const fam = fontFamily(style.font)
  const { day, month, weekday } = formatDateDisplay(data.date)
  const timeRange = `${formatTimeDisplay(data.startTime)} – ${formatTimeDisplay(data.endTime)}`

  const isSilhouette = treatment === 'silhouette'
  const photoSource: HTMLImageElement | HTMLCanvasElement | null =
    photo ? processImage(photo, treatment, style.accentRGB) : null

  const lightTheme = template === 'minimal'
  const isDark = !lightTheme
  const primaryText = style.textColor !== 'auto' ? style.textColor : (isDark ? '#ffffff' : '#111111')
  const mutedText = style.textColor !== 'auto' ? style.textColor : (isDark ? 'rgba(255,255,255,0.78)' : '#555555')

  // ── Base background per theme ──
  if (template === 'gradientPop') {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, accent)
    g.addColorStop(1, '#111118')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (template === 'nightCourt') {
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.8)
    g.addColorStop(0, '#141b2e'); g.addColorStop(1, '#05070d')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (template === 'retroBlock') {
    ctx.fillStyle = '#f4ede0'; ctx.fillRect(0, 0, W, H)
  } else {
    paintBackground(ctx, W, H, isDark, accent, style.background)
  }

  // ── Photo placement (shared across all themes) ──
  let contentTop = 0, contentLeft = 0, contentWidth = W, contentHeight = H

  if (photoSource && placement === 'background') {
    ctx.save()
    if (isSilhouette) {
      ctx.globalAlpha = 0.5
      const s = Math.min(W / (photoSource as any).width, H / (photoSource as any).height) * 1.1
      const pw = (photoSource as any).width * s, ph = (photoSource as any).height * s
      ctx.drawImage(photoSource, (W - pw) / 2, (H - ph) / 2, pw, ph)
    } else {
      ctx.globalAlpha = 0.32
      drawCover(ctx, photoSource as HTMLImageElement, 0, 0, W, H)
      ctx.globalAlpha = 1
      const scrim = ctx.createLinearGradient(0, 0, 0, H)
      scrim.addColorStop(0, isDark ? 'rgba(10,10,15,0.55)' : 'rgba(250,250,250,0.65)')
      scrim.addColorStop(1, isDark ? 'rgba(10,10,15,0.85)' : 'rgba(250,250,250,0.9)')
      ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  if (photoSource && placement === 'header') {
    if (dimension === 'banner') {
      // On a wide banner, a top band is too short — render as a side image instead.
      const sideW = W * 0.32
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sideW, H); ctx.clip()
      drawCover(ctx, photoSource as HTMLImageElement, 0, 0, sideW, H)
      ctx.fillStyle = accent; ctx.fillRect(sideW - 5 * U, 0, 5 * U, H); ctx.restore()
      contentLeft = sideW; contentWidth = W - sideW
    } else {
      const bandH = H * 0.32
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, bandH); ctx.clip()
      if (isSilhouette) {
        ctx.fillStyle = isDark ? '#15151c' : '#eeeeee'; ctx.fillRect(0, 0, W, bandH)
        const s = Math.min(W / (photoSource as any).width, bandH / (photoSource as any).height) * 1.15
        const pw = (photoSource as any).width * s, ph = (photoSource as any).height * s
        ctx.drawImage(photoSource, (W - pw) / 2, bandH - ph + 30 * U, pw, ph)
      } else {
        drawCover(ctx, photoSource as HTMLImageElement, 0, 0, W, bandH)
        const fade = ctx.createLinearGradient(0, bandH - 140 * U, 0, bandH)
        fade.addColorStop(0, 'rgba(0,0,0,0)')
        fade.addColorStop(1, template === 'retroBlock' ? '#f4ede0' : (isDark ? '#0e0e14' : '#fafafa'))
        ctx.fillStyle = fade; ctx.fillRect(0, bandH - 140 * U, W, 140 * U)
      }
      ctx.restore()
      contentTop = bandH; contentHeight = H - bandH
    }
  }

  if (photoSource && placement === 'footer') {
    // Mirror of header — a photo band across the bottom.
    const bandH = H * 0.30
    const bandTop = H - bandH
    ctx.save(); ctx.beginPath(); ctx.rect(0, bandTop, W, bandH); ctx.clip()
    if (isSilhouette) {
      ctx.fillStyle = isDark ? '#15151c' : '#eeeeee'; ctx.fillRect(0, bandTop, W, bandH)
      const s = Math.min(W / (photoSource as any).width, bandH / (photoSource as any).height) * 1.15
      const pw = (photoSource as any).width * s, ph = (photoSource as any).height * s
      ctx.drawImage(photoSource, (W - pw) / 2, bandTop, pw, ph)
    } else {
      drawCover(ctx, photoSource as HTMLImageElement, 0, bandTop, W, bandH)
      const fade = ctx.createLinearGradient(0, bandTop, 0, bandTop + 140 * U)
      fade.addColorStop(0, template === 'retroBlock' ? '#f4ede0' : (isDark ? '#0e0e14' : '#fafafa'))
      fade.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = fade; ctx.fillRect(0, bandTop, W, 140 * U)
    }
    ctx.restore()
    contentHeight = bandTop
  }

  if (photoSource && placement === 'side') {
    const sideW = W * 0.34
    const onLeft = sidePos === 'left'
    const sx = onLeft ? 0 : W - sideW
    ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, sideW, H); ctx.clip()
    if (isSilhouette) {
      ctx.fillStyle = isDark ? '#15151c' : '#eeeeee'; ctx.fillRect(sx, 0, sideW, H)
      const s = Math.max(sideW / (photoSource as any).width, H / (photoSource as any).height) * 1.05
      const pw = (photoSource as any).width * s, ph = (photoSource as any).height * s
      ctx.drawImage(photoSource, sx + (sideW - pw) / 2, (H - ph) / 2, pw, ph)
    } else {
      drawCover(ctx, photoSource as HTMLImageElement, sx, 0, sideW, H)
      ctx.fillStyle = isDark ? 'rgba(10,10,15,0.25)' : 'rgba(250,250,250,0.2)'; ctx.fillRect(sx, 0, sideW, H)
    }
    // accent divider on the inner edge
    ctx.fillStyle = accent
    ctx.fillRect(onLeft ? sideW - 5 * U : W - sideW, 0, 5 * U, H)
    ctx.restore()
    if (onLeft) { contentLeft = sideW; contentWidth = W - sideW }
    else { contentLeft = 0; contentWidth = W - sideW }
  }

  if (photoSource && placement === 'badge') {
    // Circular avatar-style photo near the top of the content area.
    const r = Math.min(contentWidth, contentHeight) * (dimension === 'banner' ? 0.28 : 0.16)
    const bcx = contentLeft + contentWidth / 2
    const bcy = contentTop + r + 40 * U
    ctx.save()
    ctx.beginPath(); ctx.arc(bcx, bcy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
    if (isSilhouette) {
      ctx.fillStyle = isDark ? '#15151c' : '#eeeeee'; ctx.fillRect(bcx - r, bcy - r, r * 2, r * 2)
    }
    // cover-fit into the circle's bounding box
    const src = photoSource as any
    const box = r * 2
    const ratio = src.width / src.height
    let dw = box, dh = box
    if (ratio > 1) { dw = box * ratio } else { dh = box / ratio }
    ctx.drawImage(photoSource, bcx - dw / 2, bcy - dh / 2, dw, dh)
    ctx.restore()
    // accent ring
    ctx.beginPath(); ctx.arc(bcx, bcy, r, 0, Math.PI * 2)
    ctx.strokeStyle = accent; ctx.lineWidth = 8 * U; ctx.stroke()
    // push content below the badge
    contentTop = bcy + r + 20 * U
    contentHeight = H - contentTop
  }

  // ── Theme-specific accent shapes ──
  if ((template === 'bold') && (placement !== 'background' || !photoSource)) {
    ctx.save(); ctx.beginPath()
    ctx.moveTo(contentLeft, contentTop + contentHeight * 0.30)
    ctx.lineTo(contentLeft + contentWidth, contentTop + contentHeight * 0.24)
    ctx.lineTo(contentLeft + contentWidth, contentTop + contentHeight * 0.40)
    ctx.lineTo(contentLeft, contentTop + contentHeight * 0.46)
    ctx.closePath(); ctx.fillStyle = accent; ctx.globalAlpha = 0.92; ctx.fill(); ctx.restore()
  }
  if (template === 'energetic' && (placement !== 'background' || !photoSource)) {
    ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = accent; ctx.beginPath()
    ctx.moveTo(contentLeft, contentTop)
    ctx.lineTo(contentLeft + contentWidth * 0.55, contentTop)
    ctx.lineTo(contentLeft, contentTop + contentHeight * 0.18)
    ctx.closePath(); ctx.fill(); ctx.restore()
  }
  if (template === 'retroBlock') {
    // Chunky offset accent blocks top-left + bottom-right
    ctx.save(); ctx.fillStyle = accent
    ctx.fillRect(contentLeft, contentTop, contentWidth * 0.28, 22 * U)
    ctx.fillRect(contentLeft + contentWidth - contentWidth * 0.28, contentTop + contentHeight - 22 * U, contentWidth * 0.28, 22 * U)
    ctx.restore()
  }
  if (template === 'nightCourt') {
    // subtle court centre-line motif
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = accent; ctx.lineWidth = 6 * U
    ctx.beginPath(); ctx.moveTo(contentLeft + contentWidth / 2, contentTop + contentHeight * 0.12)
    ctx.lineTo(contentLeft + contentWidth / 2, contentTop + contentHeight * 0.88); ctx.stroke()
    ctx.beginPath(); ctx.arc(contentLeft + contentWidth / 2, contentTop + contentHeight / 2, contentWidth * 0.14, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  }

  // ── Minimal theme border ──
  if (template === 'minimal') {
    ctx.strokeStyle = accent; ctx.lineWidth = 6 * U
    ctx.strokeRect(40 * U, 40 * U, W - 80 * U, H - 80 * U)
  }

  // ── Logo ──
  if (style.showLogo && logo) {
    const logoSize = 90 * U * (dimension === 'banner' ? 0.8 : 1)
    drawLogo(ctx, logo, contentLeft, contentWidth, contentTop, contentHeight, style.logoH, style.logoV, logoSize)
  }

  // ── Text stack (shared engine, theme tweaks via fonts/colors) ──
  const { x: anchorX, canvasAlign } = alignAnchor(style.align, contentLeft, contentWidth)
  const wrapW = contentWidth * 0.84

  const upper = (s: string) => s.toUpperCase()
  const useUpperTitle = template !== 'minimal'
  const dayColor = (template === 'energetic' || template === 'gradientPop' || template === 'retroBlock') ? accent : primaryText
  const monthColor = accent

  // Font sizes in base units, then × title scale for the headline group.
  const titlePx = 34 * U * (ts * 0.85 + 0.15)
  const dayPx = (dimension === 'banner' ? 150 : 200) * U * (ts * 0.7 + 0.3)
  const monthPx = 46 * U
  const metaPx = 32 * U
  const venuePx = 30 * U
  const quotePx = 27 * U
  const footerPx = 26 * U

  const stack: StackItem[] = []
  stack.push({ kind: 'text', text: useUpperTitle ? upper(data.scheduleName) : data.scheduleName,
    font: `700 ${titlePx}px ${fam}`, color: primaryText, gapAfter: 18 * U, lineHeight: titlePx * 1.05, maxWidth: wrapW })
  if (template === 'minimal') {
    stack.push({ kind: 'rule', width: 110 * U, height: 4 * U, color: accent, gapAfter: 24 * U })
  }
  stack.push({ kind: 'text', text: day, font: `900 ${dayPx}px ${fam}`, color: dayColor, gapAfter: 4 * U, lineHeight: dayPx * 0.95 })
  stack.push({ kind: 'text', text: `${month} • ${weekday.toUpperCase()}`, font: `700 ${monthPx}px ${fam}`, color: monthColor, gapAfter: 20 * U, lineHeight: monthPx * 1.1 })
  stack.push({ kind: 'text', text: timeRange, font: `700 ${metaPx}px ${fam}`, color: primaryText, gapAfter: 14 * U, lineHeight: metaPx * 1.1 })
  stack.push({ kind: 'text', text: '📍 ' + data.venue, font: `600 ${venuePx}px ${fam}`, color: (template === 'energetic' ? accent : primaryText), gapAfter: 24 * U, lineHeight: venuePx * 1.2, maxWidth: wrapW })
  if (style.showQuote && data.quote) {
    stack.push({ kind: 'text', text: `"${data.quote}"`, font: `italic 400 ${quotePx}px Georgia`, color: mutedText, gapAfter: 0, lineHeight: quotePx * 1.3, maxWidth: wrapW })
  }

  // Reserve a footer strip at the very bottom; center the stack in the rest.
  const footerBand = 90 * U
  renderStack(ctx, stack, anchorX, canvasAlign, contentTop + 30 * U, contentHeight - footerBand - 30 * U)

  // Footer (always centered horizontally in content area, pinned near bottom)
  ctx.textAlign = 'center'
  ctx.font = `700 ${footerPx}px ${fam}`
  ctx.fillStyle = accent
  ctx.fillText(upper(style.footerText), contentLeft + contentWidth / 2, contentTop + contentHeight - 40 * U)

  // Optional QR code — links to the registration page so people can scan & sign up.
  // Placed in a bottom corner (opposite the side image, if any) on a white chip.
  if (style.showQR) {
    const qrSize = Math.min(contentWidth, H) * (dimension === 'banner' ? 0.5 : 0.22)
    const pad = 36 * U
    // avoid the side-image column: put QR on the side with more room
    const qx = contentLeft + contentWidth - qrSize - pad
    const qy = contentTop + contentHeight - qrSize - pad
    const chip = qrSize + 20 * U
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = accent
    ctx.lineWidth = 4 * U
    const cxp = qx - 10 * U, cyp = qy - 10 * U
    ctx.fillRect(cxp, cyp, chip, chip)
    ctx.strokeRect(cxp, cyp, chip, chip)
    drawQrToCanvas(ctx, registrationUrl(), qx, qy, qrSize, '#111111', '#ffffff', 1)
    ctx.font = `700 ${11 * U}px ${fam}`
    ctx.fillStyle = '#111111'
    ctx.textAlign = 'center'
    ctx.fillText('SCAN TO REGISTER', cxp + chip / 2, cyp + chip + 20 * U)
    ctx.restore()
  }
}

export function ScheduleCardGenerator({
  scheduleName,
  defaultVenue,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  communityColors,
  onClose,
}: {
  scheduleName: string
  defaultVenue: string
  defaultDate: string
  defaultStartTime: string
  defaultEndTime: string
  communityColors?: { primary: string; secondary: string }[]
  onClose: () => void
}) {
  const [template, setTemplate] = useState<Template>('bold')
  const [dimension, setDimension] = useState<Dimension>('portrait')
  const [venue, setVenue] = useState(defaultVenue)
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState(defaultStartTime)
  const [endTime, setEndTime] = useState(defaultEndTime)
  const [quote, setQuote] = useState(randomQuote())
  const [generating, setGenerating] = useState(false)

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [treatment, setTreatment] = useState<ImageTreatment>('photo')
  const [placement, setPlacement] = useState<ImagePlacement>('header')
  const [sidePos, setSidePos] = useState<SidePosition>('left')
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [loadingGallery, setLoadingGallery] = useState(false)

  // Pre-load from the schedule's community palette when it has tags.
  // Primary community color drives the accent; secondary can drive text.
  const communityPrimary = communityColors && communityColors.length > 0 ? communityColors[0].primary : null
  const communitySecondary = communityColors && communityColors.length > 0 ? communityColors[0].secondary : null
  const hasCommunityPalette = !!communityPrimary

  const [useCustomAccent, setUseCustomAccent] = useState(hasCommunityPalette)
  const [customAccentHex, setCustomAccentHex] = useState(communityPrimary ?? '#0071e3')
  const [font, setFont] = useState<FontChoice>('arial')
  const [fontLoading, setFontLoading] = useState(false)
  const [align, setAlign] = useState<Alignment>('center')
  const [textColorMode, setTextColorMode] = useState<'auto' | 'custom'>('auto')
  const [customTextHex, setCustomTextHex] = useState('#ffffff')

  // Saved, reusable named themes (shared across admins via the DB).
  const [savedThemes, setSavedThemes] = useState<CardTheme[]>([])
  const [themeName, setThemeName] = useState('')
  const [themeMsg, setThemeMsg] = useState('')
  useEffect(() => { getCardThemes().then(setSavedThemes).catch(() => {}) }, [])

  const applyTheme = (t: CardTheme) => {
    setUseCustomAccent(true)
    setCustomAccentHex(t.accentHex)
    if (t.textMode === 'custom' && t.textHex) { setTextColorMode('custom'); setCustomTextHex(t.textHex) }
    else setTextColorMode('auto')
    if (t.template) setTemplate(t.template as Template)
    if (t.background) setBackground(t.background as BackgroundStyle)
  }

  const handleSaveTheme = async () => {
    const name = themeName.trim()
    if (!name) { setThemeMsg('Enter a theme name'); return }
    try {
      await saveCardTheme({ data: {
        name,
        accentHex: useCustomAccent ? customAccentHex : '#0071e3',
        textMode: textColorMode,
        textHex: textColorMode === 'custom' ? customTextHex : null,
        template, background,
      } })
      setThemeMsg(`Saved "${name}"`)
      setThemeName('')
      getCardThemes().then(setSavedThemes).catch(() => {})
    } catch (e: any) { setThemeMsg(e?.message || 'Save failed') }
  }

  const handleDeleteTheme = async (id: number) => {
    try { await deleteCardTheme({ data: { id } }); setSavedThemes((prev) => prev.filter((t) => t.id !== id)) }
    catch { /* non-fatal */ }
  }
  const [showLogo, setShowLogo] = useState(true)
  const [logoH, setLogoH] = useState<LogoH>('center')
  const [logoV, setLogoV] = useState<LogoV>('top')
  const [footerText, setFooterText] = useState('The Rebels Volleyball')
  const [background, setBackground] = useState<BackgroundStyle>('gradient')
  const [titleSize, setTitleSize] = useState<TitleSize>('normal')
  const [showQuote, setShowQuote] = useState(true)
  const [showQR, setShowQR] = useState(false)

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

  const buildStyle = (): CardStyle => ({
    accentRGB: useCustomAccent ? hexToRGBString(customAccentHex) : getLiveAccentRGB(),
    font, align,
    textColor: textColorMode === 'custom' ? customTextHex : 'auto',
    showLogo, logoH, logoV,
    footerText: footerText || 'The Rebels Volleyball',
    background, titleSize, showQuote, showQR,
  })

  const render = useCallback(() => {
    if (!canvasRef.current) return
    drawCard(
      canvasRef.current, template, dimension,
      { scheduleName: scheduleName || 'Tournament', venue, date, startTime, endTime, quote },
      buildStyle(), logoRef.current, photoRef.current, treatment, placement, sidePos, 1
    )
  }, [template, dimension, venue, date, startTime, endTime, quote, scheduleName, treatment, placement, sidePos,
      useCustomAccent, customAccentHex, font, align, textColorMode, customTextHex, showLogo, logoH, logoV,
      footerText, background, titleSize, showQuote, showQR])

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
    setShowGalleryPicker(true); setLoadingGallery(true)
    try { setGalleryImages(await getGalleryImages()) } catch { setGalleryImages([]) }
    setLoadingGallery(false)
  }

  const randomizeStyle = () => {
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
    setTemplate(pick(THEMES).value)
    setFont(pick(FONT_OPTIONS).value)
    setAlign(pick<Alignment>(['left', 'center', 'right']))
    setBackground(pick<BackgroundStyle>(['solid', 'gradient', 'pattern']))
    setTitleSize(pick<TitleSize>(['small', 'normal', 'big', 'huge']))
    setLogoH(pick<LogoH>(['left', 'center', 'right']))
    setLogoV(pick<LogoV>(['top', 'bottom']))
    setSidePos(pick<SidePosition>(['left', 'right']))
    setQuote(randomQuote())
  }

  const handleDownload = (retina: boolean) => {
    // Render at 2x into an offscreen canvas for print quality when requested.
    setGenerating(true)
    const target = retina ? document.createElement('canvas') : canvasRef.current
    const finish = (cv: HTMLCanvasElement | null) => {
      if (!cv) { setGenerating(false); return }
      cv.toBlob((blob) => {
        if (!blob) { setGenerating(false); return }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${(scheduleName || 'schedule').replace(/\s+/g, '-').toLowerCase()}-${dimension}${retina ? '-2x' : ''}.jpg`
        a.click(); URL.revokeObjectURL(url); setGenerating(false)
      }, 'image/jpeg', 0.92)
    }
    if (retina && target) {
      drawCard(target, template, dimension,
        { scheduleName: scheduleName || 'Tournament', venue, date, startTime, endTime, quote },
        buildStyle(), logoRef.current, photoRef.current, treatment, placement, sidePos, 2)
      // drawCard is async only for silhouette setup which is sync here; give it a tick.
      setTimeout(() => finish(target), 50)
    } else {
      finish(target)
    }
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

  const previewMax = dimension === 'banner' ? 380 : dimension === 'story' ? 220 : 300

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))] sticky top-0 bg-[rgb(var(--surface))] z-10">
          <h3 className="font-bold flex items-center gap-2"><ImageIcon size={18} /> Generate Schedule Card</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={18} /></button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center md:sticky md:top-20 self-start">
            <canvas ref={canvasRef} className="rounded-xl shadow-lg border border-[rgb(var(--border-soft))]" style={{ width: '100%', maxWidth: previewMax }} />
            <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-2">{DIMENSIONS[dimension].w} × {DIMENSIONS[dimension].h}</p>
            {fontLoading && <p className="text-[11px] text-blue-500 mt-1">Loading font…</p>}
            <button onClick={randomizeStyle}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[rgb(var(--border-soft))] hover:border-blue-500 transition-colors">
              <Shuffle size={13} /> Randomize Style
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Dimension</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DIMENSIONS) as Dimension[]).map((d) => (
                  <SegBtn key={d} active={dimension === d} onClick={() => setDimension(d)}>{DIMENSIONS[d].label}</SegBtn>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <SegBtn key={t.value} active={template === t.value} onClick={() => setTemplate(t.value)}>{t.label}</SegBtn>
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
                  <button onClick={handleUploadClick} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-dashed border-[rgb(var(--border-strong))] text-[rgb(var(--muted-fg))] hover:border-blue-500 hover:text-blue-500 transition-colors"><Upload size={14} /> Upload</button>
                  <button onClick={openGalleryPicker} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-dashed border-[rgb(var(--border-strong))] text-[rgb(var(--muted-fg))] hover:border-blue-500 hover:text-blue-500 transition-colors"><Images size={14} /> From Gallery</button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {photoUrl && (
              <>
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Treatment</label>
                  <div className="grid grid-cols-3 gap-2">
                    <SegBtn active={treatment === 'photo'} onClick={() => setTreatment('photo')}>Full Photo</SegBtn>
                    <SegBtn active={treatment === 'silhouette'} onClick={() => setTreatment('silhouette')}>Silhouette</SegBtn>
                    <SegBtn active={treatment === 'grayscale'} onClick={() => setTreatment('grayscale')}>Grayscale</SegBtn>
                    <SegBtn active={treatment === 'duotone'} onClick={() => setTreatment('duotone')}>Duotone</SegBtn>
                    <SegBtn active={treatment === 'blur'} onClick={() => setTreatment('blur')}>Blur</SegBtn>
                    <SegBtn active={treatment === 'tint'} onClick={() => setTreatment('tint')}>Tint</SegBtn>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Placement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['header', 'footer', 'background', 'side', 'badge'] as ImagePlacement[]).map((p) => (
                      <SegBtn key={p} active={placement === p} onClick={() => setPlacement(p)}>{p}</SegBtn>
                    ))}
                  </div>
                </div>
                {placement === 'side' && (
                  <div>
                    <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Side Position</label>
                    <div className="grid grid-cols-2 gap-2">
                      <SegBtn active={sidePos === 'left'} onClick={() => setSidePos('left')}>Left</SegBtn>
                      <SegBtn active={sidePos === 'right'} onClick={() => setSidePos('right')}>Right</SegBtn>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-[rgb(var(--border-soft))] pt-4">
              <p className="text-xs font-bold text-[rgb(var(--fg))] mb-3 flex items-center gap-1.5"><Palette size={13} /> Design Flexibility</p>

              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Title Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['small', 'normal', 'big', 'huge'] as TitleSize[]).map((t) => (
                    <SegBtn key={t} active={titleSize === t} onClick={() => setTitleSize(t)}>{t}</SegBtn>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Accent Color</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setUseCustomAccent(false)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${!useCustomAccent ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>Site Theme</button>
                  <button onClick={() => setUseCustomAccent(true)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${useCustomAccent ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>Custom</button>
                  {useCustomAccent && <input type="color" value={customAccentHex} onChange={(e) => setCustomAccentHex(e.target.value)} className="w-10 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />}
                </div>
                {hasCommunityPalette && (
                  <button
                    onClick={() => { setUseCustomAccent(true); setCustomAccentHex(communityPrimary!); if (communitySecondary) { setTextColorMode('custom'); setCustomTextHex(communitySecondary) } }}
                    className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold border border-[rgb(var(--border-soft))] hover:border-blue-500 flex items-center justify-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: communityPrimary! }} />
                    Reset to community palette
                  </button>
                )}
                {communityColors && communityColors.length > 1 && (
                  <p className="mt-1 text-[10px] text-[rgb(var(--muted-fg))]">This schedule spans {communityColors.length} communities — using the first community's primary. Pick Custom to blend manually.</p>
                )}
                {/* Saved, reusable named themes */}
                <div className="mt-3 pt-3 border-t border-[rgb(var(--border-soft))]">
                  <label className="text-[11px] font-bold text-[rgb(var(--muted-fg))] flex items-center gap-1 mb-1.5"><Palette size={11} /> Saved Themes</label>
                  {savedThemes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {savedThemes.map((t) => (
                        <span key={t.id} className="group inline-flex items-center gap-1 text-[10px] font-bold pl-1 pr-1.5 py-0.5 rounded-full border border-[rgb(var(--border-soft))]">
                          <button onClick={() => applyTheme(t)} className="inline-flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: t.accentHex }} />
                            {t.name}
                          </button>
                          <button onClick={() => handleDeleteTheme(t.id)} className="opacity-40 hover:opacity-100" title="Delete theme">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <input value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Name this theme…"
                      className="flex-1 text-[11px] rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-2 py-1.5 focus:outline-none focus:border-blue-500" />
                    <button onClick={handleSaveTheme} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
                  </div>
                  {themeMsg && <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1">{themeMsg}</p>}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Font Style</label>
                <select value={font} onChange={(e) => setFont(e.target.value as FontChoice)} className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500">
                  {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Text Alignment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'right'] as Alignment[]).map((a) => (
                    <SegBtn key={a} active={align === a} onClick={() => setAlign(a)}>{a}</SegBtn>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Text Color</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTextColorMode('auto')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${textColorMode === 'auto' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>Auto</button>
                  <button onClick={() => setTextColorMode('custom')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${textColorMode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border-soft))] text-[rgb(var(--muted-fg))]'}`}>Custom</button>
                  {textColorMode === 'custom' && <input type="color" value={customTextHex} onChange={(e) => setCustomTextHex(e.target.value)} className="w-10 h-9 rounded-lg border border-[rgb(var(--border-soft))] cursor-pointer" />}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-2">Background Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['solid', 'gradient', 'pattern'] as BackgroundStyle[]).map((b) => (
                    <SegBtn key={b} active={background === b} onClick={() => setBackground(b)}>{b}</SegBtn>
                  ))}
                </div>
                <p className="text-[10px] text-[rgb(var(--muted-fg))] mt-1">Note: some themes use their own signature background.</p>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))]">Show Quote</label>
                <button onClick={() => setShowQuote(!showQuote)} className={`w-11 h-6 rounded-full transition-colors relative ${showQuote ? 'bg-blue-600' : 'bg-[rgb(var(--border-soft))]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showQuote ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))]">Show QR (Scan to Register)</label>
                <button onClick={() => setShowQR(!showQR)} className={`w-11 h-6 rounded-full transition-colors relative ${showQR ? 'bg-blue-600' : 'bg-[rgb(var(--border-soft))]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showQR ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))]">Show Club Logo</label>
                <button onClick={() => setShowLogo(!showLogo)} className={`w-11 h-6 rounded-full transition-colors relative ${showLogo ? 'bg-blue-600' : 'bg-[rgb(var(--border-soft))]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showLogo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {showLogo && (
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Logo Horizontal</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['left', 'center', 'right'] as LogoH[]).map((h) => (
                        <SegBtn key={h} active={logoH === h} onClick={() => setLogoH(h)}>{h[0].toUpperCase()}</SegBtn>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--muted-fg))] block mb-1">Logo Vertical</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['top', 'bottom'] as LogoV[]).map((v) => (
                        <SegBtn key={v} active={logoV === v} onClick={() => setLogoV(v)}>{v}</SegBtn>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Footer Text</label>
                <input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="The Rebels Volleyball" className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="border-t border-[rgb(var(--border-soft))] pt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Venue</label>
                <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Rebels Sports Complex" className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">Start Time</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1">End Time</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[rgb(var(--muted-fg))] block mb-1 flex items-center justify-between">
                  <span>Quote</span>
                  <button onClick={() => setQuote(randomQuote())} className="text-blue-500 flex items-center gap-1 text-[11px] font-semibold hover:underline"><Sparkles size={11} /> Shuffle</button>
                </label>
                <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={2} className="w-full text-sm rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--bg))] px-3 py-2 resize-none focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleDownload(false)} disabled={generating} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
                <Download size={16} /> {generating ? 'Working…' : 'Download JPG'}
              </button>
              <button onClick={() => handleDownload(true)} disabled={generating} className="flex items-center justify-center gap-2 bg-[rgb(var(--bg))] border border-[rgb(var(--border-soft))] hover:border-blue-500 rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-50">
                <Download size={16} /> 2× Quality
              </button>
            </div>
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
                    <button key={img.id} onClick={() => { setPhotoUrl(img.url); setShowGalleryPicker(false) }} className="aspect-square rounded-xl overflow-hidden border border-[rgb(var(--border-soft))] hover:border-blue-500 transition-colors">
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
