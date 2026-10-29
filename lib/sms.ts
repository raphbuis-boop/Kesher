/**
 * SMS length, the way carriers actually count it.
 *
 *   GSM-7  (plain English text)  160 characters in one text, 153 per part after that
 *   UCS-2  (Hebrew, emoji, curly quotes…)  70 characters in one text, 67 per part
 *
 * One Hebrew letter or one emoji anywhere in the message switches the WHOLE
 * message to UCS-2, so a 100-character English message costs 1 text and the
 * same message with a Hebrew word costs 2.
 */

export const SMS_STOP_FOOTER = "\nReply STOP to opt out.";

/** The line(s) every text ends with: the STOP instruction and, unless the school turned it off, the parent's preferences link. */
export function smsFooter(preferencesUrl?: string | null): string {
  return preferencesUrl ? `${SMS_STOP_FOOTER}\nPreferences: ${preferencesUrl}` : SMS_STOP_FOOTER;
}

const GSM7_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€\f";
const BASIC = new Set(GSM7_BASIC);
const EXTENDED = new Set(GSM7_EXTENDED);

export type SmsInfo = {
  encoding: "GSM-7" | "UCS-2";
  /** Characters as the carrier counts them (extended GSM characters and emoji count double) */
  length: number;
  segments: number;
  perSegment: number;
  /** Characters that forced Unicode, for the "why" hint */
  unicodeReasons: string[];
};

export function smsInfo(text: string): SmsInfo {
  let gsmLength = 0;
  const reasons = new Set<string>();
  let unicode = false;
  for (const ch of text) {
    if (BASIC.has(ch)) gsmLength += 1;
    else if (EXTENDED.has(ch)) gsmLength += 2;
    else {
      unicode = true;
      reasons.add(ch);
    }
  }
  if (!unicode) {
    const segments = gsmLength === 0 ? 0 : gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
    return { encoding: "GSM-7", length: gsmLength, segments, perSegment: segments > 1 ? 153 : 160, unicodeReasons: [] };
  }
  const length = text.length; // UTF-16 code units: an emoji is 2
  const segments = length === 0 ? 0 : length <= 70 ? 1 : Math.ceil(length / 67);
  return { encoding: "UCS-2", length, segments, perSegment: segments > 1 ? 67 : 70, unicodeReasons: [...reasons].slice(0, 6) };
}

const PUNCTUATION: [RegExp, string][] = [
  [/[‘’‛′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[–—−]/g, "-"],
  [/…/g, "..."],
  [/[   ]/g, " "],
  [/[‎‏]/g, ""],
];

/**
 * Swaps curly quotes, long dashes and the like for plain ones when that is
 * all that stands between a message and the cheaper GSM-7 encoding. Hebrew and
 * emoji are left alone (those messages are Unicode on purpose).
 */
export function gsmFriendly(text: string): string {
  let out = text;
  for (const [re, to] of PUNCTUATION) out = out.replace(re, to);
  return smsInfo(out).encoding === "GSM-7" ? out : text;
}

/** Estimate for the message people will actually receive: merge fields filled in, plus the STOP line. */
export function smsEstimate(sampleTexts: string[], fallback: string, footer: string = SMS_STOP_FOOTER): SmsInfo {
  const texts = (sampleTexts.length > 0 ? sampleTexts : [fallback]).map((t) => gsmFriendly(t) + footer);
  return texts.map(smsInfo).sort((a, b) => b.segments - a.segments)[0];
}
