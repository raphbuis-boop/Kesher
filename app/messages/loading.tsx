import { HeaderSkeleton, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="messages">
      <HeaderSkeleton />
      <div className="px-6 py-4">
        <TableSkeleton rows={10} cols={5} />
      </div>
    </SkeletonPage>
  );
}
