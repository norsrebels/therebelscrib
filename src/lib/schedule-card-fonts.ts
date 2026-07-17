// src/lib/schedule-card-fonts.ts
// Curated font set for the schedule card generator. Canvas text needs the font
// fully loaded before drawing or it silently falls back — loadFont() resolves
// only once the browser confirms the face is ready.

export type FontChoice =
  | 'arial' | 'georgia' | 'impact' | 'montserrat' | 'bebas'
  | 'oswald' | 'anton' | 'poppins' | 'playfair' | 'teko'

export const FONT_OPTIONS: { value: FontChoice; label: string; family: string; googleFont?: string }[] = [
  { value: 'arial', label: 'Arial (Clean)', family: 'Arial, sans-serif' },
  { value: 'georgia', label: 'Georgia (Classic)', family: 'Georgia, serif' },
  { value: 'impact', label: 'Impact (Bold)', family: 'Impact, Haettenschweiler, sans-serif' },
  { value: 'montserrat', label: 'Montserrat (Modern)', family: '"Montserrat", sans-serif', googleFont: 'Montserrat:wght@400;600;700;800;900' },
  { value: 'bebas', label: 'Bebas Neue (Sporty)', family: '"Bebas Neue", sans-serif', googleFont: 'Bebas+Neue' },
  { value: 'oswald', label: 'Oswald (Condensed)', family: '"Oswald", sans-serif', googleFont: 'Oswald:wght@400;600;700' },
  { value: 'anton', label: 'Anton (Impact)', family: '"Anton", sans-serif', googleFont: 'Anton' },
  { value: 'poppins', label: 'Poppins (Geometric)', family: '"Poppins", sans-serif', googleFont: 'Poppins:wght@400;600;700;800;900' },
  { value: 'playfair', label: 'Playfair (Elegant)', family: '"Playfair Display", serif', googleFont: 'Playfair+Display:wght@400;600;700;800;900' },
  { value: 'teko', label: 'Teko (Scoreboard)', family: '"Teko", sans-serif', googleFont: 'Teko:wght@400;600;700' },
]

const loadedFonts = new Set<FontChoice>()

/** Loads a Google Font (if needed) and waits until it's actually usable on canvas. */
export async function loadFont(choice: FontChoice): Promise<void> {
  if (loadedFonts.has(choice)) return
  const opt = FONT_OPTIONS.find((f) => f.value === choice)
  if (!opt) return

  if (opt.googleFont) {
    const existing = document.querySelector(`link[data-font="${choice}"]`)
    if (!existing) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${opt.googleFont}&display=swap`
      link.dataset.font = choice
      document.head.appendChild(link)
    }
    try {
      // Force the browser to actually fetch + parse the face before we draw with it.
      await document.fonts.load(`900 100px ${opt.family}`)
      await document.fonts.load(`400 40px ${opt.family}`)
    } catch {
      // Non-fatal — canvas will fall back to a default sans-serif if the load fails.
    }
  }
  loadedFonts.add(choice)
}

export function fontFamily(choice: FontChoice): string {
  return FONT_OPTIONS.find((f) => f.value === choice)?.family ?? 'Arial, sans-serif'
}
