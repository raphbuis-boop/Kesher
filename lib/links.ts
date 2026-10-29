import { signId, hasLinkKey } from "@/lib/crypto";
import { getAbsoluteBaseUrl } from "@/lib/site-url";

/**
 * Public, signed links that work without a login. Each token is bound to one
 * purpose and one row, so a link for one family can't be edited into another's.
 */

export function linksConfigured(): boolean {
  return hasLinkKey() && !!getAbsoluteBaseUrl();
}

/** "I've read this" — one per message_recipients row (confirm page: /r/<token>). */
export function buildConfirmUrl(recipientRowId: string): string | null {
  if (!linksConfigured()) return null;
  return `${getAbsoluteBaseUrl()}/r/${signId("confirm", recipientRowId)}`;
}

/**
 * A guardian's own preference-center link (/p/<token>). One per person, so it
 * works from any message they were sent; 7 MAC bytes keeps it short enough for a
 * text while still being unguessable.
 */
export function buildPreferencesUrl(personId: string): string | null {
  if (!linksConfigured()) return null;
  return `${getAbsoluteBaseUrl()}/p/${signId("prefs", personId, 7)}`;
}

/** Past messages for this guardian's family (/archive/<token>). */
export function buildArchiveUrl(personId: string): string | null {
  if (!linksConfigured()) return null;
  return `${getAbsoluteBaseUrl()}/archive/${signId("archive", personId, 7)}`;
}
