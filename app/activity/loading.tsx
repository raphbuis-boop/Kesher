import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonList } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="activity" />
      <SkeletonHeader action={false} />
      <div className="px-6 py-6">
        <div className="max-w-2xl space-y-6">
          <Bone className="h-3 w-20" />
          <SkeletonList rows={5} />
          <Bone className="h-3 w-24" />
          <SkeletonList rows={4} />
        </div>
      </div>
    </div>
  );
}
