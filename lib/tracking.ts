/**
 * Honest engagement signals.
 *
 * What each signal actually proves (and the wording we use for it):
 *   Sent / Delivered   the provider accepted it / the inbox or phone received it
 *   Opened             "may be automatic": Apple Mail Privacy Protection and some
 *                      security scanners load images for everyone, and image
 *                      blocking hides real opens, so it proves neither reading nor
 *                      not reading. Never used to decide who to remind.
 *   Clicked            a link was followed, but not in the first seconds after
 *                      delivery: mail security scanners click every link at once
 *   Read (WhatsApp)    a read receipt, unless the person turned receipts off
 *   Confirmed          the person tapped "I've read this": certain
 */

/** Clicks this soon after delivery are link scanners, not people. */
export const SCANNER_CLICK_MS = 2000;

export function isLikelyScannerClick(clickedAt: Date | string, deliveredAt: Date | string | null | undefined, sentAt?: Date | string | null): boolean {
  const reference = deliveredAt ?? sentAt;
  if (!reference) return false;
  const delta = new Date(clickedAt).getTime() - new Date(reference).getTime();
  return delta >= 0 ? delta < SCANNER_CLICK_MS : delta > -SCANNER_CLICK_MS;
}

export const OPENED_LABEL = "Opened (may be automatic)";
export const OPENED_EXPLAINER =
  "Email opens are unreliable. Apple Mail and some security tools load the tracking image automatically, and people who block images look like they never opened it. Use Confirmed or WhatsApp Read to know someone saw a message.";
export const READ_EXPLAINER = "WhatsApp read receipts. People can turn them off, so a missing receipt doesn't mean unread.";
export const CONFIRMED_EXPLAINER = "The person tapped \"I've read this\" in their message. The only signal that's certain.";

/** A person has seen a message only if they confirmed it or read it on WhatsApp (never by email opens). */
export function personHasSeen(rows: { confirmed_at: string | null; read_at: string | null }[]): boolean {
  return rows.some((r) => !!r.confirmed_at || !!r.read_at);
}
