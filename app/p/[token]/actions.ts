"use server";

import { headers } from "next/headers";
import { verifyId } from "@/lib/crypto";
import { savePreferenceUpdate, type PreferenceUpdate } from "@/lib/preferenceCenter";

/** Public action behind the preference center. The signed link identifies exactly one person. */
export async function savePreferences(token: string, update: PreferenceUpdate): Promise<{ ok: true } | { ok: false; error: string }> {
  const personId = verifyId("prefs", token, 7);
  if (!personId) return { ok: false, error: "This link isn't valid." };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return savePreferenceUpdate(personId, update, ip);
}
