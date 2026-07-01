// src/components/QRShareModal.tsx
// Shows a scannable QR code for registration — either the general page or a
// specific schedule deep-link — with copy-link and PNG download.

import { useMemo, useState } from 'react'
import { X, Download, Copy, Check } from 'lucide-react'
import { registrationUrl, qrToSvg, svgToPngDownload } from '@/lib/qrcode'

export function QRShareModal({
  scheduleId,
  scheduleName,
  onClose,
}: {
  scheduleId?: number | null
  scheduleName?: string | null
  onClose: () => void
}) {
  const url = useMemo(() => registrationUrl(scheduleId), [scheduleId])
  const svg = useMemo(() => qrToSvg(url, { size: 260 }), [url])
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  const download = () => {
    const safe = (scheduleName || 'registration').replace(/\s+/g, '-').toLowerCase()
    svgToPngDownload(svg, `${safe}-qr.png`, 640)
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border-soft))]">
          <h3 className="font-bold text-sm">Share Registration QR</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgb(var(--surface-hover))]"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col items-center">
          <p className="text-xs text-[rgb(var(--muted-fg))] mb-3 text-center">
            {scheduleId
              ? <>Scan to register for <span className="font-bold text-[rgb(var(--fg))]">{scheduleName}</span></>
              : 'Scan to open the registration page'}
          </p>

          <div className="bg-white p-3 rounded-xl border border-[rgb(var(--border-soft))]" dangerouslySetInnerHTML={{ __html: svg }} />

          <p className="text-[11px] text-[rgb(var(--muted-fg))] mt-3 break-all text-center">{url}</p>

          <div className="grid grid-cols-2 gap-2 w-full mt-4">
            <button onClick={copyLink}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border border-[rgb(var(--border-soft))] hover:border-blue-500 transition-colors">
              {copied ? <><Check size={14} className="text-green-500" /> Copied</> : <><Copy size={14} /> Copy Link</>}
            </button>
            <button onClick={download}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <Download size={14} /> Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
