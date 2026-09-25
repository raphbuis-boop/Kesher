import { Bone, SkeletonPage, TableSkeleton } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="audience">
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Bone className="h-3.5 w-20" />
            <Bone className="h-3.5 w-28" />
            <Bone className="h-5 w-10 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Bone className="h-7 w-24 rounded-md" />
            <Bone className="h-7 w-24 rounded-md" />
          </div>
        </div>
        <div className="border-t border-border-subtle px-6 py-2.5">
          <div className="flex items-center gap-4">
            <Bone className="h-7 w-full max-w-xs rounded-lg" />
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="px-6 py-4">
        <TableSkeleton rows={10} cols={5} avatar />
      </div>
    </SkeletonPage>
  );
}
