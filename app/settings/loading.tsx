import { LoadingAnnouncement, SkeletonForm, SkeletonHeader } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <LoadingAnnouncement label="settings" />
      <SkeletonHeader action={false} />
      <div className="px-6 py-6 max-w-lg space-y-6">
        <SkeletonForm fields={3} />
        <SkeletonForm fields={3} />
      </div>
    </div>
  );
}
