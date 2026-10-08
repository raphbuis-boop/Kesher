import { Bone, HeaderSkeleton, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="audiences">
      <HeaderSkeleton />
      <div className="px-6 py-6 space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <Bone className="h-2.5 w-28" />
            <Bone className="h-2.5 w-24" />
          </div>
          <TableSkeleton rows={9} cols={3} />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <Bone className="h-2.5 w-28" />
            <Bone className="h-7 w-40 rounded-md" />
          </div>
          <TableSkeleton rows={3} cols={4} />
        </section>
      </div>
    </SkeletonPage>
  );
}
