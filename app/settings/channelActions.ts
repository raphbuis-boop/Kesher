"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { clearWhatsAppToken, getChannelConfig, saveSmsSender, saveWhatsAppConfig } from "@/lib/channels";
import { getWhatsAppLive, type WhatsAppLive } from "./channels";

export type ChannelResult = { ok: true; message?: string } | { ok: false; error: string };

async function admin(): Promise<{ orgId: string } | ChannelResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    return { orgId };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

const refresh = () => revalidatePath("/settings");

export async function saveWhatsApp(input: {
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  templateName: string;
  templateLang: string;
  templateVars: 1 | 2;
  accessToken: string;
}): Promise<ChannelResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const phoneNumberId = input.phoneNumberId.trim();
  const wabaId = input.wabaId.trim();
  const templateName = input.templateName.trim();
  const templateLang = input.templateLang.trim() || "en_US";
  if (phoneNumberId && !/^\d{5,25}$/.test(phoneNumberId)) return { ok: false, error: "Phone number ID should be digits only (find it in Meta → WhatsApp → API setup)." };
  if (wabaId && !/^\d{5,25}$/.test(wabaId)) return { ok: false, error: "WhatsApp Business Account ID should be digits only." };
  if (templateName && !/^[a-z0-9_]{1,512}$/.test(templateName)) return { ok: false, error: "Template names use lowercase letters, numbers and underscores only." };
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(templateLang)) return { ok: false, error: "Language should look like en_US or he." };
  if (input.templateVars !== 1 && input.templateVars !== 2) return { ok: false, error: "Choose 1 or 2 template variables." };
  try {
    await saveWhatsAppConfig(g.orgId, {
      phoneNumberId,
      wabaId,
      displayName: input.displayName.trim().slice(0, 100),
      templateName,
      templateLang,
      templateVars: input.templateVars,
      accessToken: input.accessToken,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save." };
  }
  refresh();
  return { ok: true, message: "WhatsApp settings saved" };
}

export async function removeWhatsAppToken(): Promise<ChannelResult> {
  const g = await admin();
  if ("ok" in g) return g;
  await clearWhatsAppToken(g.orgId);
  refresh();
  return { ok: true, message: "Access token removed" };
}

export async function saveSms(sender: string): Promise<ChannelResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const cleaned = sender.trim().replace(/[\s().-]/g, "");
  if (cleaned && !/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return { ok: false, error: "Use the full number with country code, like +12125551234." };
  }
  try {
    await saveSmsSender(g.orgId, cleaned);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save." };
  }
  refresh();
  return { ok: true, message: "SMS sender saved" };
}

/** Re-checks the number and template with Meta right now (skips the 5-minute cache). */
export async function checkWhatsAppNow(): Promise<{ ok: true; live: WhatsAppLive } | { ok: false; error: string }> {
  const g = await admin();
  if ("ok" in g) return g.ok ? { ok: false, error: "Not allowed." } : g;
  const cfg = await getChannelConfig(g.orgId);
  if (!cfg.whatsapp) return { ok: false, error: cfg.whatsappProblem ?? "WhatsApp isn't set up yet." };
  const live = await getWhatsAppLive(cfg.whatsapp, true);
  refresh();
  return { ok: true, live };
}
