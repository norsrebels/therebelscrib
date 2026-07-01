// src/lib/qrcode.ts
// QR helpers for registration sharing. Uses `uqr` (dependency-free) to produce a
// boolean module matrix, then renders it either as an inline SVG string (for the
// admin page display/download) or straight onto a canvas (for the schedule card).

import { encode } from 'uqr'

/** Builds the public registration URL, optionally deep-linked to one schedule. */
export function registrationUrl(scheduleId?: number | null): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://therebelscrib.netlify.app'
  return scheduleId ? `${base}/registration?schedule=${scheduleId}` : `${base}/registration`
}

/** Returns a standalone SVG string for a QR code encoding `text`. */
export function qrToSvg(text: string, opts?: { size?: number; dark?: string; light?: string; margin?: number }): string {
  const size = opts?.size ?? 240
  const dark = opts?.dark ?? '#111111'
  const light = opts?.light ?? '#ffffff'
  const margin = opts?.margin ?? 2

  const result = encode(text)
  const modules = result.size
  const total = modules + margin * 2
  const cell = size / total

  let rects = ''
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (result.data[r][c]) {
        const x = (c + margin) * cell
        const y = (r + margin) * cell
        rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${light}"/>` +
    `<g fill="${dark}">${rects}</g></svg>`
}

/**
 * Draws a QR code for `text` directly onto a canvas context at (x, y) sized `size`.
 * Used by the schedule card generator so the QR is baked into the exported image.
 */
export function drawQrToCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number, size: number,
  dark = '#111111', light = '#ffffff', margin = 2
) {
  const result = encode(text)
  const modules = result.size
  const total = modules + margin * 2
  const cell = size / total

  ctx.save()
  ctx.fillStyle = light
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = dark
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (result.data[r][c]) {
        ctx.fillRect(
          x + (c + margin) * cell,
          y + (r + margin) * cell,
          Math.ceil(cell), Math.ceil(cell)
        )
      }
    }
  }
  ctx.restore()
}

/** Converts an SVG string to a downloadable PNG blob URL via an offscreen canvas. */
export function svgToPngDownload(svg: string, filename: string, size = 512) {
  const img = new window.Image()
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(svgBlob)
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      if (!blob) return
      const pngUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
  }
  img.src = url
}
