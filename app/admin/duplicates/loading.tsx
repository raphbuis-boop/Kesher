import { Bone, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="duplicate audit">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <Bone className="h-6 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface px-5 py-4 space-y-2">
              <Bone className="h-2.5 w-24" />
              <Bone className="h-6 w-12" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={6} cols={4} />
      </div>
    </SkeletonPage>
  );
}
