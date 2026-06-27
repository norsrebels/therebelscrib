// src/components/InstallAppButton.tsx
// "Install app" button for the sidebar.
//  • Android/Chrome/Edge: captures the beforeinstallprompt event and triggers the
//    native install dialog on click.
//  • iOS/Safari: Apple blocks programmatic prompts, so we show a how-to hint popup.
//  • Hidden entirely when the app is already installed (standalone display mode).

import { useState, useEffect } from 'react'
import { Download, X, Share } from 'lucide-react'

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function InstallAppButton({ collapsed }: { collapsed?: boolean }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    // Already installed? (standalone display mode, or iOS standalone)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (standalone) {
      setInstalled(true)
      return
    }

    // Detect iOS (no beforeinstallprompt support)
    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(ios)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferred(null)
    } else if (isIOS) {
      setShowIOSHint(true)
    }
  }

  // Hide when installed, or when there's nothing actionable
  // (non-iOS browser that hasn't fired beforeinstallprompt yet / unsupported).
  if (installed) return null
  if (!deferred && !isIOS) return null

  return (
    <>
      <button
        onClick={handleClick}
        title={collapsed ? 'Install app' : undefined}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-500 hover:bg-blue-500/10 transition-colors',
          collapsed && 'justify-center',
        )}
      >
        <Download size={18} />
        {!collapsed && 'Install app'}
      </button>

      {showIOSHint && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="relative bg-[rgb(var(--surface))] border border-[rgb(var(--border-soft))] rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSHint(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[rgb(var(--muted-fg))] hover:bg-[rgb(var(--surface-hover))]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Download size={22} className="text-blue-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Install on iPhone</h3>
            <p className="text-sm text-[rgb(var(--muted-fg))] mb-4">
              Safari doesn't allow a one-tap install, but it only takes two steps:
            </p>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="flex items-center gap-1.5">
                  Tap the Share icon <Share size={15} className="inline text-blue-500" /> in Safari's toolbar
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                <span>Scroll down and tap <b>Add to Home Screen</b></span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSHint(false)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
