import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonList } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="audiences" />
      <SkeletonHeader />
      <div className="px-6 py-6 space-y-6">
        <Bone className="h-3 w-32" />
        <SkeletonList rows={9} />
        <Bone className="h-3 w-32" />
        <SkeletonList rows={3} />
      </div>
    </div>
  );
}
