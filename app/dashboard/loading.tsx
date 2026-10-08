import { Bone, HeaderSkeleton, ListCardSkeleton, SkeletonPage, StatCardsSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="overview">
      <HeaderSkeleton />
      <div className="px-6 py-6 space-y-6 max-w-7xl">
        <StatCardsSkeleton count={4} />
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ListCardSkeleton rows={7} />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-5">
            <ListCardSkeleton rows={4} />
            <div className="rounded-xl border border-border bg-surface px-5 py-4 space-y-4">
              <Bone className="h-3.5 w-20" />
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bone className="h-3 flex-1" />
                  <Bone className="h-1 w-16" />
                  <Bone className="h-3 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
