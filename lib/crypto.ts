import crypto from "crypto";

/**
 * Server-only secrets helpers.
 *
 * encryptSecret / decryptSecret — AES-256-GCM for credentials stored in the
 *   database (Google refresh tokens, per-school WhatsApp tokens). The key is
 *   KESHER_ENCRYPTION_KEY (any long random string; it is hashed to 32 bytes).
 *   Rotating that key makes stored secrets unreadable — reconnect afterwards.
 *
 * signToken / verifyToken — compact HMAC-signed tokens for links that work
 *   without login (confirm-read, preference center, family archive, OAuth
 *   state). Keyed by KESHER_LINK_SECRET, falling back to
 *   SUPABASE_SERVICE_ROLE_KEY (same key the unsubscribe links already use).
 */

function encryptionKey(): Buffer {
  const raw = process.env.KESHER_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error("KESHER_ENCRYPTION_KEY is not set (needed to store connection credentials securely).");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function hasEncryptionKey(): boolean {
  return !!process.env.KESHER_ENCRYPTION_KEY && process.env.KESHER_ENCRYPTION_KEY.length >= 16;
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized secret format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

function linkKey(): string {
  const key = process.env.KESHER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("KESHER_LINK_SECRET / SUPABASE_SERVICE_ROLE_KEY is not set.");
  return key;
}

export function hasLinkKey(): boolean {
  return !!(process.env.KESHER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function mac(purpose: string, payload: string, bytes: number): string {
  return crypto.createHmac("sha256", linkKey()).update(`${purpose}:${payload}`).digest().subarray(0, bytes).toString("base64url");
}

/**
 * Signs `payload` for one purpose ("confirm", "prefs", …) — a token signed for
 * one purpose never verifies for another. `macBytes` trades length for
 * strength (12 bytes = 96 bits, plenty for links that only reveal one family's
 * own data).
 */
export function signToken(purpose: string, payload: string, macBytes = 12): string {
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac(purpose, payload, macBytes)}`;
}

export function verifyToken(purpose: string, token: string | null | undefined, macBytes = 12): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  let payload: string;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = Buffer.from(mac(purpose, payload, macBytes));
  const given = Buffer.from(token.slice(dot + 1));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return payload;
}

/** UUID ↔ 22-char base64url, to keep SMS links short. */
export function uuidToShort(uuid: string): string {
  return Buffer.from(uuid.replace(/-/g, ""), "hex").toString("base64url");
}

export function shortToUuid(short: string): string | null {
  try {
    const hex = Buffer.from(short, "base64url").toString("hex");
    if (hex.length !== 32) return null;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

/** Short signed token for a single row id: "<22-char id><mac>". */
export function signId(purpose: string, uuid: string, macBytes = 9): string {
  const short = uuidToShort(uuid);
  return `${short}${mac(purpose, short, macBytes)}`;
}

export function verifyId(purpose: string, token: string | null | undefined, macBytes = 9): string | null {
  if (!token || token.length < 23) return null;
  const short = token.slice(0, 22);
  const expected = Buffer.from(mac(purpose, short, macBytes));
  const given = Buffer.from(token.slice(22));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return shortToUuid(short);
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
