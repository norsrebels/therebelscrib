// ─── Raw stat row (mirrors player_stats DB columns) ──────────────────────────
export type PlayerStatRow = {
  attackKill: number; attackError: number; attackAttempt: number
  serveAce: number; serveError: number; serveAttempt: number
  receptionPerfect: number; receptionGood: number; receptionOk: number
  receptionError: number; receiveAttempt: number
  setAssist: number; setAttempt: number; setBallHandlingError: number
  blockSolo: number; blockAssist: number; blockError: number; blockRebound: number
  dig: number; digError: number; digAttempt: number
}

// ─── Formatters ──────────────────────────────────────────────────────────────
export const fmt2   = (n: number | null) => (n === null ? '—' : n.toFixed(2))
export const fmtPct = (n: number | null) => (n === null ? '—' : n.toFixed(1) + '%')
export const fmtEff = (n: number | null) => (n === null ? '—' : n.toFixed(3))
export const fmtPts = (n: number): string => Number.isInteger(n) ? String(n) : n.toFixed(1)

// ─── Attack ──────────────────────────────────────────────────────────────────
// Total attempts = kills + errors + neutral in-play attacks (attackAttempt button)
export const attackTotal = (K: number, E: number, Other: number): number => K + E + Other
export const attackEfficiency = (K: number, E: number, Other: number): number | null => {
  const total = attackTotal(K, E, Other)
  return total > 0 ? (K - E) / total : null
}
export const killPct = (K: number, E: number, Other: number): number | null => {
  const total = attackTotal(K, E, Other)
  return total > 0 ? (K / total) * 100 : null
}

// ─── Serve ───────────────────────────────────────────────────────────────────
// Total attempts = aces + errors + neutral in-play serves (serveAttempt "In" button)
export const serveTotal = (SA: number, SE: number, In: number): number => SA + SE + In
export const serveAcePct = (SA: number, SE: number, In: number): number | null => {
  const total = serveTotal(SA, SE, In)
  return total > 0 ? (SA / total) * 100 : null
}
export const serveErrorPct = (SA: number, SE: number, In: number): number | null => {
  const total = serveTotal(SA, SE, In)
  return total > 0 ? (SE / total) * 100 : null
}

// ─── Reception ───────────────────────────────────────────────────────────────
export const passEfficiency = (
  perfect: number, good: number, ok: number, error: number,
): number | null => {
  const total = perfect + good + ok + error
  return total > 0 ? (3 * perfect + 2 * good + 1 * ok) / total : null
}
export const receptionErrorPct = (
  error: number, perfect: number, good: number, ok: number,
): number | null => {
  const total = perfect + good + ok + error
  return total > 0 ? (error / total) * 100 : null
}

// ─── Set ─────────────────────────────────────────────────────────────────────
// Total attempts = assists + ball-handling errors (setAttempt is no longer manually tracked)
export const setTotal = (assists: number, bhe: number): number => assists + bhe
export const setEfficiency = (assists: number, bhe: number): number | null => {
  const total = setTotal(assists, bhe)
  return total > 0 ? (assists / total) * 100 : null
}

// ─── Block ───────────────────────────────────────────────────────────────────
export const blockPoints = (BS: number, BA: number): number => BS + BA * 0.5
/** Alias — VISStatsTab imports this name */
export const blockTotal = blockPoints
export const blocksPerSet = (BS: number, BA: number, sets: number): number | null =>
  sets > 0 ? blockPoints(BS, BA) / sets : null

// ─── Dig ─────────────────────────────────────────────────────────────────────
export const digSuccessRate = (
  dig: number, digError: number, digAttempt: number,
): number | null => {
  const total = digAttempt > 0 ? digAttempt : dig + digError
  return total > 0 ? (dig / total) * 100 : null
}

// ─── Points ──────────────────────────────────────────────────────────────────
export const pointsTotal = (K: number, SA: number, BS: number, BA: number): number =>
  K + SA + blockPoints(BS, BA)
export const pointsPerSet = (pts: number, sets: number): number | null =>
  sets > 0 ? pts / sets : null
export const perSet = (count: number, sets: number): number | null =>
  sets > 0 ? count / sets : null

// ─── Aggregation ─────────────────────────────────────────────────────────────
export const aggregateTeamStats = (rows: PlayerStatRow[]) => ({
  attackKill:           rows.reduce((s, r) => s + r.attackKill, 0),
  attackError:          rows.reduce((s, r) => s + r.attackError, 0),
  attackAttempt:        rows.reduce((s, r) => s + r.attackAttempt, 0),
  serveAce:             rows.reduce((s, r) => s + r.serveAce, 0),
  serveError:           rows.reduce((s, r) => s + r.serveError, 0),
  serveAttempt:         rows.reduce((s, r) => s + r.serveAttempt, 0),
  receptionPerfect:     rows.reduce((s, r) => s + r.receptionPerfect, 0),
  receptionGood:        rows.reduce((s, r) => s + r.receptionGood, 0),
  receptionOk:          rows.reduce((s, r) => s + r.receptionOk, 0),
  receptionError:       rows.reduce((s, r) => s + r.receptionError, 0),
  receiveAttempt:       rows.reduce((s, r) => s + r.receiveAttempt, 0),
  setAssist:            rows.reduce((s, r) => s + r.setAssist, 0),
  setAttempt:           rows.reduce((s, r) => s + r.setAttempt, 0),
  setBallHandlingError: rows.reduce((s, r) => s + r.setBallHandlingError, 0),
  blockSolo:            rows.reduce((s, r) => s + r.blockSolo, 0),
  blockAssist:          rows.reduce((s, r) => s + r.blockAssist, 0),
  blockError:           rows.reduce((s, r) => s + r.blockError, 0),
  blockRebound:         rows.reduce((s, r) => s + r.blockRebound, 0),
  dig:                  rows.reduce((s, r) => s + r.dig, 0),
  digError:             rows.reduce((s, r) => s + r.digError, 0),
  digAttempt:           rows.reduce((s, r) => s + r.digAttempt, 0),
})

// ─── Stat fields (for live entry tap buttons) ────────────────────────────────
export const STAT_FIELDS = [
  'attackKill', 'attackError', 'attackAttempt',
  'serveAce', 'serveError', 'serveAttempt',
  'receptionPerfect', 'receptionGood', 'receptionOk', 'receptionError',
  'setAssist', 'setAttempt', 'setBallHandlingError',
  'blockSolo', 'blockAssist', 'blockError', 'blockRebound',
  'dig', 'digError', 'digAttempt',
] as const

export type StatField = (typeof STAT_FIELDS)[number]
