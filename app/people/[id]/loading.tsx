import { Bone, LoadingAnnouncement, SkeletonList } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="contact" />
      <header className="border-b border-line bg-card px-6 py-5">
        <Bone className="h-2.5 w-16 mb-4" />
        <div className="flex items-center gap-4">
          <Bone className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Bone className="h-4 w-44" />
            <Bone className="h-2.5 w-28" />
          </div>
        </div>
      </header>
      <div className="px-6 py-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-line bg-card shadow-card p-5 grid grid-cols-2 gap-x-8 gap-y-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-2.5 w-16" />
              <Bone className="h-3 w-32" />
            </div>
          ))}
        </div>
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}
