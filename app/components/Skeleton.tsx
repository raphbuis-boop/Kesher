// Skeleton primitives for route-level loading.tsx files. Each skeleton mirrors
// the layout of the page it stands in for, so content swaps in without a jump.
// Uses the .skeleton shimmer from globals.css (disabled under reduced motion).

export function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`skeleton ${className}`} style={style} />;
}

/** Announces loading to assistive tech; wraps the whole skeleton page. */
export function SkeletonPage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading {label}…</span>
      {children}
    </div>
  );
}

/** Matches the sticky page header used across the app (title, subtitle, action). */
export function HeaderSkeleton({
  actions = 1,
  maxWidth,
  back = false,
}: {
  actions?: number;
  maxWidth?: string;
  back?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-6 py-3.5">
      <div className={`flex items-center justify-between gap-4 ${maxWidth ? `${maxWidth} mx-auto` : ""}`}>
        {back ? (
          <Bone className="h-3.5 w-16" />
        ) : (
          <div className="space-y-1.5">
            <Bone className="h-3.5 w-24" />
            <Bone className="h-2.5 w-32" />
          </div>
        )}
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-7 w-24 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Table card: header row + N body rows. `avatar` adds a leading circle to column 1. */
export function TableSkeleton({
  rows = 8,
  cols = 4,
  avatar = false,
}: {
  rows?: number;
  cols?: number;
  avatar?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-6 border-b border-border-subtle bg-background px-5 py-3">
        {Array.from({ length: cols }, (_, c) => (
          <Bone key={c} className={`h-2.5 ${c === 0 ? "w-24 flex-[2]" : "w-14 flex-1"}`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex items-center gap-6 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
        >
          <div className="flex flex-[2] items-center gap-3">
            {avatar && <Bone className="h-7 w-7 shrink-0 rounded-full" />}
            <Bone className="h-3 w-3/5" />
          </div>
          {Array.from({ length: cols - 1 }, (_, c) => (
            <Bone key={c} className="h-3 w-2/3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card with a title bar and list rows (icon + two text lines). */
export function ListCardSkeleton({ rows = 5, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {title && (
        <div className="border-b border-border-subtle px-5 py-4">
          <Bone className="h-3.5 w-28" />
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-3 border-b border-border-subtle px-5 py-4 last:border-b-0">
          <Bone className="h-7 w-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-2/3" />
            <Bone className="h-2.5 w-1/3" />
          </div>
          <Bone className="h-2.5 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Row of KPI stat cards. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${count === 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4"}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface px-4 py-4">
          <Bone className="h-2.5 w-20" />
          <Bone className="mt-3 h-7 w-16" />
          <Bone className="mt-3 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Form card with labelled fields. */
export function FormCardSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-9 w-full rounded-lg" />
          <Bone className="h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}
