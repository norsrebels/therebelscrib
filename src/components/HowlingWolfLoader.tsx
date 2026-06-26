import { useEffect, useRef, useState } from "react";
import { CanvasPreloader } from "./VolleyballPreloader/CanvasPreloader";
import type { PreloaderConfig } from "./VolleyballPreloader/types";

// One full rally animation cycle, in ms. The old CSS loader looped on a
// 2.4s cycle (hw-ball-x / hw-ball-y keyframes) — kept close to that pace
// here so route transitions still feel snappy. Raise this for a slower,
// more theatrical rally.
const CYCLE_MS = 4200;

// Studio-exported theme + action. Swap "theme" for any of:
// 'midnight-spike' | 'cyber-court' | 'beach-sunset' | 'olympic-gold' | 'minimal-chalk'
// 'minimal-chalk' was picked as the closest match to the previous silver-on-dark look.
const LOADER_CONFIG: PreloaderConfig = {
  theme: "minimal-chalk",
  action: "dig-set-spike",
  speed: 1,
  gravity: 0.22,
  particleDensity: 55,
  soundVolume: 0,
  soundEnabled: false, // route transitions are silent by default — flip on if desired
  welcomeName: "",
  customWelcomeText: "",
  showCustomWelcome: false,
  loadingDuration: CYCLE_MS,
};

export function HowlingWolfLoader({
  message,
}: {
  message?: string;
}) {
  void message; // Ignored visually, kept for compatibility with existing callers

  // Drive the engine with a looping 0->100 progress value instead of letting
  // it auto-complete once. This is what makes the rally repeat indefinitely
  // while the route is loading, matching the previous infinite CSS animation.
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) % CYCLE_MS;
      setProgress((elapsed / CYCLE_MS) * 100);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#09090f] overflow-hidden flex items-center justify-center pointer-events-none">
      <div className="relative w-full max-w-3xl h-[300px] sm:h-[340px]">
        <CanvasPreloader
          config={LOADER_CONFIG}
          progressOverride={progress}
          showOverlayUI={false}
        />
      </div>
    </div>
  );
}
