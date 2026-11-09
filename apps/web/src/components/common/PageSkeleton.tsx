export interface PageSkeletonProps {
  title?: string
  description?: string
}

export function PageSkeleton({
  title = 'Memuat Halaman...',
  description = 'Menyiapkan data antarmuka...',
}: PageSkeletonProps) {
  return (
    <div
      className="h-full w-full bg-wa-rail-bg p-6 flex flex-col gap-6 animate-pulse select-none"
      data-testid="page-skeleton"
    >
      {/* Header bar placeholder */}
      <div className="flex items-center justify-between border-b border-wa-hover-dark pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-wa-surface-dark" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-wa-surface-dark rounded" />
            <div className="h-3 w-24 bg-wa-surface-dark/60 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-wa-surface-dark rounded-lg" />
          <div className="h-8 w-24 bg-wa-surface-dark rounded-lg" />
        </div>
      </div>

      {/* Main loading indicator info */}
      <div className="flex items-center gap-2 text-xs text-wa-subtle">
        <div className="w-2 h-2 rounded-full bg-wa-teal-primary animate-ping" />
        <span className="font-medium text-wa-border">{title}</span>
        <span>•</span>
        <span>{description}</span>
      </div>

      {/* Grid cards placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-wa-surface-dark rounded-xl p-4 flex flex-col justify-between">
          <div className="h-3 w-24 bg-wa-hover-dark rounded" />
          <div className="h-6 w-16 bg-wa-hover-dark rounded" />
          <div className="h-2.5 w-32 bg-wa-hover-dark/60 rounded" />
        </div>
        <div className="h-28 bg-wa-surface-dark rounded-xl p-4 flex flex-col justify-between">
          <div className="h-3 w-28 bg-wa-hover-dark rounded" />
          <div className="h-6 w-20 bg-wa-hover-dark rounded" />
          <div className="h-2.5 w-36 bg-wa-hover-dark/60 rounded" />
        </div>
        <div className="h-28 bg-wa-surface-dark rounded-xl p-4 flex flex-col justify-between">
          <div className="h-3 w-20 bg-wa-hover-dark rounded" />
          <div className="h-6 w-14 bg-wa-hover-dark rounded" />
          <div className="h-2.5 w-28 bg-wa-hover-dark/60 rounded" />
        </div>
      </div>

      {/* Table / List rows placeholder */}
      <div className="flex-1 bg-wa-surface-dark rounded-xl p-4 space-y-3">
        <div className="h-5 w-40 bg-wa-hover-dark rounded mb-4" />
        <div className="h-10 bg-wa-rail-bg rounded-lg w-full" />
        <div className="h-10 bg-wa-rail-bg rounded-lg w-full" />
        <div className="h-10 bg-wa-rail-bg rounded-lg w-full" />
        <div className="h-10 bg-wa-rail-bg rounded-lg w-full" />
      </div>
    </div>
  )
}
