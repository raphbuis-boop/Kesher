/**
 * Loading skeletons shaped like the real pages, used by each route's
 * loading.tsx so a click paints a matching layout instantly while the
 * server renders. Pulse is disabled under prefers-reduced-motion.
 */

export function Bone({ className = "" }: { className?: string }) {
  const radius = /\brounded-/.test(className) ? "" : "rounded-md";
  return <div aria-hidden className={`${radius} bg-muted-2 motion-safe:animate-pulse ${className}`} />;
}

export function SkeletonHeader({ action = true, wide = false }: { action?: boolean; wide?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Bone className={`h-3.5 ${wide ? "w-48" : "w-24"}`} />
          <Bone className="h-2.5 w-36" />
        </div>
        {action && <Bone className="h-7 w-24 rounded-md" />}
      </div>
    </header>
  );
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
      <div className="flex items-center gap-6 border-b border-muted-2 bg-canvas px-5 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Bone key={i} className={`h-2.5 ${i === 0 ? "w-24" : "w-14"}`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-muted px-5 py-3.5 last:border-0">
          <div className="flex min-w-[180px] items-center gap-3">
            <Bone className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Bone className="h-3 w-28" />
              <Bone className="h-2.5 w-16" />
            </div>
          </div>
          {Array.from({ length: cols - 1 }, (_, c) => (
            <Bone key={c} className={`h-3 ${c === cols - 2 ? "ml-auto w-14" : "w-24"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-card shadow-card p-4 space-y-3">
          <Bone className="h-2.5 w-20" />
          <Bone className="h-6 w-16" />
          <Bone className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-line bg-card shadow-card divide-y divide-muted">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Bone className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3 w-1/3" />
            <Bone className="h-2.5 w-1/4" />
          </div>
          <Bone className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5 rounded-xl border border-line bg-card shadow-card p-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Screen-reader announcement for route transitions. */
export function LoadingAnnouncement({ label }: { label: string }) {
  return <span className="sr-only" role="status">Loading {label}…</span>;
}
