// src/components/EmptyState.tsx
// Sprint Item 5 — Empty state illustrations
// Drop into: src/components/EmptyState.tsx
// Usage: Replace blank/no-data divs across the app

import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

// Wolf silhouette SVG reused from Modals.tsx style
function WolfIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 65 Q10 60 8 50 Q6 40 10 35 Q12 32 14 28 L16 22 Q18 18 20 20 L22 25 Q24 30 28 28 Q32 26 34 22 L36 16 Q38 12 40 14 L42 20 Q44 26 48 30 Q52 34 58 34 Q64 34 70 32 Q76 30 82 30 Q88 30 94 34 Q100 38 104 42 Q108 46 110 52 Q112 58 110 62 Q108 66 104 68 Q100 70 94 68 Q88 66 84 64 L78 62 Q72 60 66 62 Q60 64 54 64 Q48 64 42 66 Q36 68 30 68 Q24 68 20 66 Z" />
      <circle cx="30" cy="35" r="2" fill="rgb(var(--bg))" />
    </svg>
  )
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="mb-5 text-[rgb(var(--muted-fg))] opacity-40">
        {icon ?? <WolfIcon className="w-24 h-16 mx-auto" />}
      </div>
      <h3 className="text-base font-semibold text-[rgb(var(--fg))] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[rgb(var(--muted-fg))] max-w-xs leading-relaxed mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Preset empty states used across the app ──────────────────────────────────

export function NoMatchesEmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      title="No matches yet"
      description="Add your first match to start tracking stats for this team."
      action={
        onAdd ? (
          <button
            onClick={onAdd}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors"
          >
            + Add Match
          </button>
        ) : undefined
      }
    />
  )
}

export function NoPlayersEmptyState() {
  return (
    <EmptyState
      title="No players found"
      description="No players match the current filter. Try adjusting your search or position filter."
    />
  )
}

export function NoStatsEmptyState() {
  return (
    <EmptyState
      title="No stats recorded yet"
      description="Stats will appear here once a statistician logs rally data for this match."
    />
  )
}

export function NoTournamentsEmptyState() {
  return (
    <EmptyState
      title="No tournaments yet"
      description="Tournaments and schedules will appear here once they're created by an admin."
    />
  )
}

export function NoGalleryEmptyState() {
  return (
    <EmptyState
      title="No photos yet"
      description="Gallery photos will appear here once an admin uploads them."
    />
  )
}

export function LeaderboardEmptyState() {
  return (
    <EmptyState
      title="No stats to rank yet"
      description="No players meet the minimum threshold for this category, or no match data has been recorded yet."
    />
  )
}
