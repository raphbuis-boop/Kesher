/**
 * Hero section rendered at the top of every legal page.
 * Shows brand identity, page title, and effective/updated dates.
 */

interface LegalPageHeaderProps {
  title: string;
  effectiveDate: string;
  lastUpdated?: string;
}

export function LegalPageHeader({ title, effectiveDate, lastUpdated }: LegalPageHeaderProps) {
  return (
    <div className="border-b border-zinc-100 pb-10 mb-12">

      {/* Brand identity */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] shrink-0">
          <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-zinc-900 leading-tight">Kesher</p>
          <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
            The modern communications platform for schools.
          </p>
        </div>
      </div>

      {/* Page title + dates */}
      <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight mb-3">
        {title}
      </h1>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-sm text-zinc-400">Effective {effectiveDate}</p>
        {lastUpdated && (
          <p className="text-sm text-zinc-400">Last Updated {lastUpdated}</p>
        )}
      </div>
    </div>
  );
}
