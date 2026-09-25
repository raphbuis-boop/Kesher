import { Bone, ListCardSkeleton, SkeletonPage, StatCardsSkeleton, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="campaign">
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Bone className="h-3.5 w-20" />
            <Bone className="h-3.5 w-56" />
            <Bone className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Bone className="h-7 w-20 rounded-lg" />
            <Bone className="h-7 w-32 rounded-lg" />
          </div>
        </div>
        <div className="px-6 pb-3">
          <Bone className="h-2.5 w-48" />
        </div>
      </div>
      <div className="px-6 py-6 space-y-6">
        <StatCardsSkeleton count={4} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-xl border border-border bg-surface p-5">
            <Bone className="h-3.5 w-32" />
            <Bone className="mt-5 h-[160px] w-full rounded-lg" />
          </div>
          <div className="lg:col-span-2">
            <ListCardSkeleton rows={4} />
          </div>
        </div>
        <TableSkeleton rows={8} cols={5} avatar />
      </div>
    </SkeletonPage>
  );
}
