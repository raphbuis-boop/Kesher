/**
 * Opt-out keywords, in the languages our schools' families text in.
 *
 * A message counts only when the WHOLE message is the keyword (or one of a short
 * list of polite variants): a reply like "cancel Friday pickup" must never
 * unsubscribe a parent. Anything else goes to the inbox for a person to read.
 * Matching ignores case, punctuation, Hebrew vowel points and extra spaces.
 */

export type KeywordType = "stop" | "start" | "help";

const STOP = [
  // The standard carrier keywords and the ones the FCC names for revoking consent
  "stop", "stopall", "stop all", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt out",
  // Polite and plain-English variants
  "please stop", "stop please", "pls stop", "stop it", "stop texting", "stop texting me", "stop messaging", "stop messaging me",
  "stop sending", "stop sending me messages", "stop all messages", "stop all texts", "unsubscribe me", "remove me", "opt me out",
  "take me off", "take me off the list", "do not text", "do not text me", "dont text", "dont text me", "no more texts", "no more messages",
  // Hebrew
  "הפסק", "הפסיקו", "תפסיק", "תפסיקו", "להפסיק", "הסר", "הסירו", "הסר אותי", "הסירו אותי", "הסרה", "בטל", "בטלו", "ביטול", "עצור", "עצרו", "די", "די להודעות", "אל תשלחו", "אל תשלח",
  // Yiddish
  "אפשטעלן", "שטעל אפ", "שטעלט אפ", "האלט איין", "האלט אײַן", "אויפהערן", "אפמעלדן", "נישט מער", "שיק נישט",
  // Hebrew written in English letters
  "hafsek", "tafsik", "hasar", "bitul",
];

const START = ["start", "unstop", "subscribe", "resume", "opt in", "optin", "התחל", "התחילו", "הרשם", "הצטרף"];
const HELP = ["help", "info", "עזרה", "מידע", "עזרא"];

const NIKUD = /[֑-ׇ]/g;

export function normalizeKeywordText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(NIKUD, "")
    .toLowerCase()
    .replace(/['’`"“”.,!?;:()\[\]{}*_~\-–—…]/g, " ")
    .replace(/[\p{Extended_Pictographic}️]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (list: string[]) => new Set(list.map(normalizeKeywordText));
const STOP_SET = norm(STOP);
const START_SET = norm(START);
const HELP_SET = norm(HELP);

export function parseKeyword(text: string | null | undefined): { type: KeywordType; keyword: string } | null {
  if (!text) return null;
  const n = normalizeKeywordText(text);
  if (!n || n.length > 40) return null;
  if (STOP_SET.has(n)) return { type: "stop", keyword: n };
  if (START_SET.has(n)) return { type: "start", keyword: n };
  if (HELP_SET.has(n)) return { type: "help", keyword: n };
  return null;
}

/** Looks like it might be a request to stop but isn't an exact keyword: the inbox flags these for a person. */
export function mentionsStopping(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\b(stop|unsubscribe|opt out|remove me|take me off|no more)\b/i.test(text) || /(הפסק|תפסיק|הסר|אפשטעלן)/.test(text);
}

// ─── The one reply to each keyword ───────────────────────────────────────────

export type ReplyKind = "stopped" | "started" | "help";

export function autoReplyText(kind: ReplyKind, opts: { school: string; contact?: string | null; language?: string | null; channel: "sms" | "whatsapp" }): string {
  const school = opts.school || "Your school";
  const contact = opts.contact ? ` Questions: ${opts.contact}` : "";
  const noun = opts.channel === "sms" ? "texts" : "WhatsApp messages";
  if (opts.language === "he") {
    if (kind === "stopped") return `${school}: הוסרת בהצלחה ולא תקבל/י עוד הודעות. להרשמה מחדש השב/י START.${contact}`;
    if (kind === "started") return `${school}: נרשמת מחדש. להפסקה השב/י STOP בכל עת.`;
    return `${school}: עדכוני בית הספר. להפסקה השב/י STOP, להרשמה מחדש START.${contact}`;
  }
  if (kind === "stopped") return `${school}: You're unsubscribed and won't get any more ${noun} from us. Reply START to resubscribe.${contact}`;
  if (kind === "started") return `${school}: You're resubscribed. Reply STOP at any time to opt out.`;
  return `${school}: school updates by ${opts.channel === "sms" ? "text" : "WhatsApp"}. Reply STOP to opt out, START to resubscribe.${contact} Msg & data rates may apply.`;
}
