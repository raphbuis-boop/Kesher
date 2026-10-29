import { hebrewDateString, type HebrewDateStyle } from "@/lib/hebrewDate";

/** "· 26 Cheshvan 5787" next to a regular date. Renders nothing when the school turned Hebrew dates off. */
export function HebrewDate({ at, tz, style, className = "" }: { at: Date | string | null | undefined; tz: string; style: HebrewDateStyle; className?: string }) {
  if (!at || style === "off") return null;
  const text = hebrewDateString(at, tz, style);
  if (!text) return null;
  return (
    <span dir="auto" className={className} title="Hebrew date">
      {text}
    </span>
  );
}
