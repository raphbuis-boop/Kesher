import { Bone, LoadingAnnouncement, SkeletonForm, SkeletonHeader } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="settings" />
      <SkeletonHeader action={false} />
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 md:grid md:grid-cols-[190px_1fr] md:gap-8">
        <div className="mb-5 flex gap-1 md:mb-0 md:flex-col">
          {Array.from({ length: 7 }, (_, i) => (
            <Bone key={i} className="h-8 w-24 rounded-lg md:w-full" />
          ))}
        </div>
        <div className="space-y-5">
          <Bone className="h-4 w-24" />
          <SkeletonForm fields={1} />
          <SkeletonForm fields={2} />
        </div>
      </div>
    </div>
  );
}
