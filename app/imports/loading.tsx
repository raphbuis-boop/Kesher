import { Bone, HeaderSkeleton, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="imports">
      <HeaderSkeleton actions={0} />
      <div className="px-6 py-6 max-w-2xl space-y-8">
        <section>
          <Bone className="mb-3 h-2.5 w-24" />
          <Bone className="h-44 w-full rounded-lg" />
        </section>
        <section>
          <Bone className="mb-3 h-2.5 w-28" />
          <TableSkeleton rows={4} cols={3} />
        </section>
      </div>
    </SkeletonPage>
  );
}
