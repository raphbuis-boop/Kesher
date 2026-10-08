/**
 * Hero section rendered at the top of every legal page.
 * Shows the page title and effective/updated dates (PublicHeader carries the brand).
 */

interface LegalPageHeaderProps {
  title: string;
  effectiveDate: string;
  lastUpdated?: string;
}

export function LegalPageHeader({ title, effectiveDate, lastUpdated }: LegalPageHeaderProps) {
  return (
    <div className="border-b border-border-subtle pb-10 mb-12">

      {/* Page title + dates */}
      <h1 className="text-3xl font-semibold text-text-primary tracking-tight mb-3">
        {title}
      </h1>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-sm text-text-subtle">Effective {effectiveDate}</p>
        {lastUpdated && (
          <p className="text-sm text-text-subtle">Last Updated {lastUpdated}</p>
        )}
      </div>
    </div>
  );
}
