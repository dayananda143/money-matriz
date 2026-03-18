// Base pulsing block
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />;
}

// Page title + subtitle
export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

// A single stat card skeleton
export function SkeletonStatCard() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-7 w-36" />
    </div>
  );
}

// Row of N stat cards
export function SkeletonStatCards({ count = 4, cols = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
  );
}

// Table with N skeleton rows
export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="card overflow-hidden">
      {/* header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {/* data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-4 flex-1 ${j === 0 ? 'max-w-[140px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Search bar skeleton
export function SkeletonSearchBar() {
  return <Skeleton className="h-9 w-72 max-w-sm" />;
}

// Filter pill buttons row
export function SkeletonFilterPills({ count = 3 }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-16 rounded-lg" />
      ))}
    </div>
  );
}
