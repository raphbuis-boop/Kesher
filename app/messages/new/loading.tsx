import { Bone, LoadingAnnouncement, SkeletonForm } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <LoadingAnnouncement label="composer" />
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 px-6 py-3.5">
        <div className="max-w-2xl mx-auto space-y-1.5">
          <Bone className="h-3.5 w-28" />
          <Bone className="h-2.5 w-52" />
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-6 space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <Bone key={i} className="h-9 flex-1 rounded-lg" />)}
        </div>
        <SkeletonForm fields={3} />
      </div>
    </div>
  );
}
