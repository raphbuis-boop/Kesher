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
