import { HeaderSkeleton, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="custom audiences">
      <HeaderSkeleton />
      <div className="px-6 py-4">
        <TableSkeleton rows={5} cols={4} />
      </div>
    </SkeletonPage>
  );
}
