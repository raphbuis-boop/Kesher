import { Bone, HeaderSkeleton, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="people">
      <HeaderSkeleton />
      <div className="border-b border-border bg-surface px-6 py-2.5">
        <div className="flex items-center gap-3">
          <Bone className="h-8 w-[280px] rounded-lg" />
          <Bone className="h-6 w-20 rounded-full" />
          <Bone className="h-6 w-20 rounded-full" />
          <Bone className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="px-6 py-4">
        <TableSkeleton rows={10} cols={5} avatar />
      </div>
    </SkeletonPage>
  );
}
