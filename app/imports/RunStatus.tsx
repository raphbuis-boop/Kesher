/** Status pill for an import / sync run. */
export function RunStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied: "bg-emerald-500/10 text-emerald-700",
    preview: "bg-brand-tint text-brand",
    applying: "bg-amber-500/10 text-amber-700",
    failed: "bg-red-500/10 text-red-600",
    discarded: "bg-muted text-ink-3",
  };
  const label: Record<string, string> = { applied: "Applied", preview: "Not confirmed", applying: "Running", failed: "Failed", discarded: "Cancelled" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-muted text-ink-2"}`}>{label[status] ?? status}</span>;
}
