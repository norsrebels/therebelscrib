// src/components/LiveIntroSplash.tsx
// Intro splash for the live tournament view. Plays one rally cycle of the
// CanvasPreloader (themed to read like the app's court accent), then reveals
// the live content. Shows only once per browser session and is tap-to-skip,
// so people refreshing live scores aren't forced to rewatch it.

import { useEffect, useRef, useState } from 'react'
import { CanvasPreloader } from './VolleyballPreloader/CanvasPreloader'
import type { PreloaderConfig } from './VolleyballPreloader/types'

const SPLASH_MS = 3200
const SESSION_KEY = 'tr_live_intro_seen'

// 'cyber-court' (cyan) is the closest preloader palette to the app's default
// blue accent — and reads as a volleyball court, which fits the live view.
const INTRO_CONFIG: PreloaderConfig = {
  theme: 'cyber-court',
  action: 'dig-set-spike',
  speed: 1,
  gravity: 0.22,
  particleDensity: 60,
  soundVolume: 0,
  soundEnabled: false,
  welcomeName: '',
  customWelcomeText: 'Live',
  showCustomWelcome: false,
  loadingDuration: SPLASH_MS,
}

export function LiveIntroSplash({ children }: { children: React.ReactNode }) {
  // Decide synchronously so there's no flash of content before the splash.
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return sessionStorage.getItem(SESSION_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [progress, setProgress] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  const dismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    setShowSplash(false)
  }

  useEffect(() => {
    if (!showSplash) return
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const pct = Math.min(100, (elapsed / SPLASH_MS) * 100)
      setProgress(pct)
      if (pct >= 100) {
        dismiss()
        return
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash])

  if (!showSplash) return <>{children}</>

  return (
    <>
      {/* Keep children mounted underneath so data is ready when the splash lifts */}
      <div aria-hidden className="pointer-events-none select-none opacity-0">
        {children}
      </div>
      <div
        className="fixed inset-0 z-[120] bg-[#06121a] overflow-hidden flex flex-col items-center justify-center cursor-pointer"
        onClick={dismiss}
        role="button"
        aria-label="Skip intro"
      >
        <div className="relative w-full max-w-3xl h-[320px] sm:h-[380px]">
          <CanvasPreloader config={INTRO_CONFIG} progressOverride={progress} />
        </div>
        <p className="mt-4 text-xs text-white/40 tracking-wide">Tap to skip</p>
      </div>
    </>
  )
}
