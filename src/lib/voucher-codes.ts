// src/lib/voucher-codes.ts
// Voucher code helpers: normalization (case/space) + cryptographically-strong
// auto-generation with an unambiguous alphabet and optional campaign prefix/suffix.

// Excludes easily-confused characters (0/O, 1/I/L) so hand-typed codes don't fail.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Canonical form of a code for matching + storage: strip ALL whitespace (not just
 * ends) and uppercase. `  howl 20 ` and `HOWL20` both become `HOWL20`.
 */
export function normalizeCode(raw: string): string {
  return (raw || '').replace(/\s+/g, '').toUpperCase()
}

/** Cryptographically-strong random int in [0, max) — works in browser and Node. */
function randInt(max: number): number {
  const g: any = (typeof globalThis !== 'undefined' && (globalThis as any).crypto) || null
  if (g && typeof g.getRandomValues === 'function') {
    // Rejection sampling to avoid modulo bias.
    const limit = Math.floor(0xffffffff / max) * max
    const buf = new Uint32Array(1)
    let x = 0
    do { g.getRandomValues(buf); x = buf[0] } while (x >= limit)
    return x % max
  }
  // Last-resort fallback (non-crypto) — only if no secure RNG is present.
  return Math.floor(Math.random() * max)
}

export interface GenOptions {
  groups?: number      // number of character groups (default 2)
  groupLen?: number    // chars per group (default 4)
  prefix?: string      // campaign/partner tag, e.g. 'CLUB1'
  suffix?: string
  separator?: string   // between groups (default '-')
}

/** Generates one code like `X7F9-B2M4`, optionally `CLUB1-X7F9-B2M4`. */
export function generateVoucherCode(opts: GenOptions = {}): string {
  const groups = Math.max(1, opts.groups ?? 2)
  const groupLen = Math.max(2, opts.groupLen ?? 4)
  const sep = opts.separator ?? '-'
  const parts: string[] = []
  for (let g = 0; g < groups; g++) {
    let s = ''
    for (let i = 0; i < groupLen; i++) s += ALPHABET[randInt(ALPHABET.length)]
    parts.push(s)
  }
  const core = parts.join(sep)
  const pre = opts.prefix ? normalizeCode(opts.prefix) + sep : ''
  const suf = opts.suffix ? sep + normalizeCode(opts.suffix) : ''
  return pre + core + suf
}

/** Generates a batch of unique codes (dedup within the batch). */
export function generateVoucherBatch(count: number, opts: GenOptions = {}): string[] {
  const out = new Set<string>()
  let guard = 0
  while (out.size < count && guard < count * 20) {
    out.add(generateVoucherCode(opts))
    guard++
  }
  return Array.from(out)
}
