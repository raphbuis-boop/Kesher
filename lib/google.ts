/**
 * Google Sheets connection (read-only).
 *
 * OAuth scopes: spreadsheets.readonly (+ openid email to show which account
 * is connected). The refresh token is stored encrypted in oauth_connections,
 * which only the service role can read; every access is filtered by org_id.
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_SITE_URL,
 * KESHER_ENCRYPTION_KEY. Redirect URI: <site>/api/google/oauth/callback
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { decryptSecret, encryptSecret, hasEncryptionKey } from "@/lib/crypto";
import { getAbsoluteBaseUrl } from "@/lib/site-url";
import { toTable } from "@/lib/sync/table";
import type { TableData } from "@/lib/sync/mapping";

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/spreadsheets.readonly"];

export function googleConfigError(): string | null {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return "Google isn't set up on this server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).";
  }
  if (!hasEncryptionKey()) return "KESHER_ENCRYPTION_KEY isn't set, so Kesher can't store the Google connection securely.";
  if (!getAbsoluteBaseUrl()) return "NEXT_PUBLIC_SITE_URL isn't set.";
  return null;
}

export function googleRedirectUri(): string {
  return `${getAbsoluteBaseUrl()}/api/google/oauth/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; scope?: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
    cache: "no-store",
  });
  return (await res.json()) as TokenResponse;
}

/** Email from the id_token we just received directly from Google over TLS. */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

/** OAuth callback: exchanges the code and stores the (encrypted) refresh token for the org. */
export async function saveGoogleConnection(orgId: string, userId: string, code: string): Promise<{ email: string | null }> {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
  if (!tokens.refresh_token) {
    throw new Error(tokens.error_description ?? tokens.error ?? "Google didn't return a refresh token. Try connecting again.");
  }
  if (!tokens.scope?.includes("spreadsheets.readonly")) {
    throw new Error("Kesher needs permission to read your Google Sheets. Please allow it when connecting.");
  }
  const email = emailFromIdToken(tokens.id_token);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("oauth_connections").upsert(
    {
      org_id: orgId,
      provider: "google",
      account_email: email,
      refresh_token_enc: encryptSecret(tokens.refresh_token),
      scopes: tokens.scope ?? null,
      connected_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,provider" }
  );
  if (error) throw new Error(error.message);
  return { email };
}

export type GoogleConnection = { email: string | null; connectedAt: string };

export async function getGoogleConnection(orgId: string): Promise<GoogleConnection | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("oauth_connections")
    .select("account_email, updated_at")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .maybeSingle();
  return data ? { email: (data.account_email as string | null) ?? null, connectedAt: data.updated_at as string } : null;
}

export async function deleteGoogleConnection(orgId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("oauth_connections")
    .select("refresh_token_enc")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .maybeSingle();
  if (data?.refresh_token_enc) {
    try {
      const token = decryptSecret(data.refresh_token_enc as string);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" });
    } catch {
      // Revoking is best-effort; the row is deleted either way
    }
  }
  await admin.from("oauth_connections").delete().eq("org_id", orgId).eq("provider", "google");
}

async function accessToken(orgId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("oauth_connections")
    .select("refresh_token_enc")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .maybeSingle();
  if (!data) throw new Error("Google isn't connected. Connect it in Settings → Data.");
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(data.refresh_token_enc as string) });
  if (!tokens.access_token) {
    if (tokens.error === "invalid_grant") throw new Error("Google access was revoked or expired. Reconnect Google in Settings → Data.");
    throw new Error(tokens.error_description ?? tokens.error ?? "Couldn't refresh Google access.");
  }
  return tokens.access_token;
}

async function sheetsGet<T>(orgId: string, path: string): Promise<T> {
  const token = await accessToken(orgId);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string; status?: string } };
  if (!res.ok) {
    if (res.status === 404) throw new Error("Spreadsheet not found. Check the link.");
    if (res.status === 403) throw new Error("The connected Google account can't open this spreadsheet. Share it with that account or reconnect.");
    throw new Error(json.error?.message ?? `Google Sheets error (HTTP ${res.status})`);
  }
  return json;
}

/** Pulls the spreadsheet ID (and tab gid) out of a pasted link, or accepts a bare ID. */
export function parseSheetUrl(input: string): { spreadsheetId: string; gid: number | null } | null {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  const id = m?.[1] ?? (/^[a-zA-Z0-9-_]{20,}$/.test(s) ? s : null);
  if (!id) return null;
  const g = s.match(/[#&?]gid=(\d+)/);
  return { spreadsheetId: id, gid: g ? Number(g[1]) : null };
}

export type SpreadsheetInfo = { title: string; tabs: { id: number; title: string; rows: number }[] };

export async function getSpreadsheetInfo(orgId: string, spreadsheetId: string): Promise<SpreadsheetInfo> {
  const json = await sheetsGet<{
    properties?: { title?: string };
    sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number } } }[];
  }>(orgId, `${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties(sheetId,title,gridProperties.rowCount)`);
  return {
    title: json.properties?.title ?? "Spreadsheet",
    tabs: (json.sheets ?? []).map((s) => ({
      id: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? "Sheet",
      rows: s.properties?.gridProperties?.rowCount ?? 0,
    })),
  };
}

/** Reads a whole tab as a { headers, rows } table (formatted values, as shown in the sheet). */
export async function fetchSheetTable(orgId: string, spreadsheetId: string, tabTitle: string): Promise<TableData> {
  const range = encodeURIComponent(`'${tabTitle.replace(/'/g, "''")}'`);
  const json = await sheetsGet<{ values?: unknown[][] }>(orgId, `${encodeURIComponent(spreadsheetId)}/values/${range}?majorDimension=ROWS`);
  return toTable((json.values ?? []).map((r) => r.map((c) => String(c ?? ""))));
}
