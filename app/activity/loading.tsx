import { Bone, HeaderSkeleton, ListCardSkeleton, SkeletonPage } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="activity">
      <HeaderSkeleton actions={0} />
      <div className="px-6 py-6">
        <div className="max-w-2xl space-y-6">
          {[4, 3].map((rows, i) => (
            <div key={i}>
              <div className="mb-2 flex items-center gap-3">
                <Bone className="h-2.5 w-20" />
                <div className="h-px flex-1 bg-border" />
              </div>
              <ListCardSkeleton rows={rows} title={false} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
