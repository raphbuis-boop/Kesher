/**
 * WhatsApp (Meta) blocks marketing-style templates to US numbers, so
 * fundraising / donation messages never go out on WhatsApp — only email and
 * SMS. A message is fundraising when the sender marks it so, or when its
 * wording clearly is (we'd rather ask than have Meta flag the number).
 */

const FUNDRAISING_RE =
  /\b(donat\w*|fundrais\w*|pledg\w*|raffle\w*|auction\w*|sponsor(?:ship|ing)?\w*|annual (?:campaign|appeal|dinner|fund)|matching (?:gift|grant|fund)s?|tax[- ]deductible|give (?:now|today|generously)|make a gift)\b/i;

// \b doesn't work for Hebrew letters, so these match anywhere in a word (תרומה, לתרום, צדקה, מגבית)
const FUNDRAISING_HEBREW_RE = /(תרומ|תרום|צדקה|מגבית)/;

export function looksLikeFundraising(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && (FUNDRAISING_RE.test(t) || FUNDRAISING_HEBREW_RE.test(t)));
}

export const FUNDRAISING_WHATSAPP_NOTE =
  "Fundraising messages can only go by email and text. WhatsApp doesn't allow them (Meta blocks them to US numbers), so WhatsApp is turned off for this message.";
