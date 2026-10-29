/**
 * Normalize a US-style phone number to E.164 (+1XXXXXXXXXX). Numbers that
 * already carry a country code keep it. Returns null if it can't be a phone number.
 *   "9172468571" / "(917) 246-8571" → "+19172468571"
 *   "19172468571"                  → "+19172468571"
 *   "+972 2 123 4567"              → "+97221234567"
 */
export function toE164(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && s.startsWith("00")) return `+${digits.slice(2)}`;
  return null;
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return toE164(raw) !== null;
}
