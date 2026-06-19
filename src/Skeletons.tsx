// src/components/Skeletons.tsx
// Sprint Item 1 — Skeleton loading screens
// Drop into: src/components/Skeletons.tsx

function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[rgb(var(--surface-hover))] ${className}`}
    />
  )
}

/** Used on /leaderboard while stats are loading */
export function LeaderboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3 flex-1">
          <SkeletonBox className="w-6 h-6 rounded-lg" />
          <div className="space-y-2">
            <SkeletonBox className="w-40 h-6" />
            <SkeletonBox className="w-28 h-3" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBox className="w-36 h-10 rounded-xl" />
          <SkeletonBox className="w-32 h-10 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left sidebar — ranking categories */}
        <div className="space-y-4">
          {['Points', 'Attack', 'Serve', 'Reception'].map(group => (
            <div key={group}>
              <SkeletonBox className="w-14 h-3 mb-2 ml-1" />
              <div className="space-y-1">
                {[...Array(group === 'Points' ? 2 : 2)].map((_, i) => (
                  <SkeletonBox key={i} className="w-full h-12 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right — leaderboard rows */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgb(var(--border))] flex items-center gap-2">
            <SkeletonBox className="w-4 h-4 rounded" />
            <SkeletonBox className="w-32 h-4" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-3.5 border-b border-[rgb(var(--border-soft))] ${i % 2 !== 0 ? 'bg-[rgb(var(--surface-hover))]' : ''}`}
            >
              <SkeletonBox className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBox className="w-32 h-4" />
                <SkeletonBox className="w-20 h-3" />
              </div>
              <SkeletonBox className="w-14 h-6 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Used on /vis-stats while match data is loading */
export function VISStatsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <SkeletonBox className="w-6 h-6 rounded-lg" />
        <SkeletonBox className="w-48 h-7" />
      </div>

      {/* Match selector bar */}
      <div className="flex gap-3 flex-wrap">
        <SkeletonBox className="w-48 h-10 rounded-xl" />
        <SkeletonBox className="w-36 h-10 rounded-xl" />
        <SkeletonBox className="w-28 h-10 rounded-xl" />
      </div>

      {/* Set tabs */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <SkeletonBox key={i} className="w-20 h-9 rounded-xl" />
        ))}
      </div>

      {/* Stat entry grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 space-y-3"
          >
            <SkeletonBox className="w-24 h-4" />
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, j) => (
                <SkeletonBox key={j} className="h-10 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Generic page-level skeleton for any route that needs one */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <SkeletonBox className="w-56 h-8 mb-6" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <SkeletonBox className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className={`h-4 ${i % 3 === 0 ? 'w-3/4' : i % 3 === 1 ? 'w-1/2' : 'w-2/3'}`} />
            <SkeletonBox className="w-1/3 h-3" />
          </div>
        </div>
      ))}
    </div>
  )
}
