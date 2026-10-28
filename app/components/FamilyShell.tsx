/**
 * Page chrome for the links families open from a message: confirm, preferences,
 * message archive, signup. Branded as the school (Kesher only appears in the
 * small footer), readable on a phone, no login.
 */
export function FamilyShell({
  schoolName,
  logoUrl,
  children,
}: {
  schoolName: string;
  logoUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-md object-contain" />
          ) : null}
          <span dir="auto" className="text-[15px] font-semibold text-ink">{schoolName || "Your school"}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">{children}</main>
      <footer className="px-5 py-6 text-center text-[11px] text-ink-3">Sent with Kesher</footer>
    </div>
  );
}
