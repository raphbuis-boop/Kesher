import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonTable } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="audience" />
      <SkeletonHeader wide />
      <div className="border-b border-line bg-card px-6 py-3.5">
        <Bone className="h-7 w-72 rounded-lg" />
      </div>
      <div className="px-6 py-4">
        <SkeletonTable rows={10} cols={5} />
      </div>
    </div>
  );
}
