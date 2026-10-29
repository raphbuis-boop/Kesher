"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership } from "@/lib/org";
import { fetchAllRows } from "@/lib/supabase-paging";
import { CHANNELS, type Channel, type MessageInput } from "@/lib/send/types";
import { previewSend, submitMessage, type SubmitResult } from "./actions";

/**
 * "Remind people who haven't read it." A person has seen a message only if they
 * confirmed it ("I've read this") or read it on WhatsApp. Email opens are never
 * used: they can be automatic, and a missing open proves nothing.
 */

const PREFIX = "Reminder: ";

type Original = { input: MessageInput; unseenIds: string[]; people: number };

async function loadOriginal(messageId: string): Promise<Original | { error: string }> {
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const { data: msg } = await supabase.from("messages").select("id, status, payload").eq("org_id", orgId).eq("id", messageId).maybeSingle();
  const original = msg as { id: string; status: string; payload: MessageInput | null } | null;
  if (!original) return { error: "That message no longer exists." };
  if (!original.payload) return { error: "This message has no send settings saved, so it can't be repeated." };
  if (!["sent", "failed"].includes(original.status)) return { error: "Reminders can be sent once the message has gone out." };

  const rows = await fetchAllRows<{ person_id: string; confirmed_at: string | null; read_at: string | null }>((from, to) =>
    supabase.from("message_recipients").select("person_id, confirmed_at, read_at").eq("message_id", messageId).order("id").range(from, to)
  );
  const seen = new Set(rows.filter((r) => r.confirmed_at || r.read_at).map((r) => r.person_id));
  const everyone = [...new Set(rows.map((r) => r.person_id))];
  const unseenIds = everyone.filter((id) => !seen.has(id));
  return { input: original.payload, unseenIds, people: everyone.length };
}

function reminderInput(base: MessageInput, channels: Channel[], unseenIds: string[]): MessageInput {
  const hasEmail = channels.includes("email");
  return {
    ...base,
    channels,
    channelMode: "all",
    subject: base.subject ? (base.subject.startsWith(PREFIX) ? base.subject : PREFIX + base.subject) : "Reminder",
    body: !hasEmail && !base.body.startsWith(PREFIX) ? PREFIX + base.body : base.body,
    confirmButton: true,
    excludePersonIds: [],
    onlyPersonIds: unseenIds,
  };
}

export type ResendPreview =
  | { ok: true; unseen: number; people: number; reachable: number; perChannel: Record<Channel, number>; problems: string[]; notes: string[] }
  | { ok: false; error: string };

export async function previewResend(messageId: string, channels: Channel[]): Promise<ResendPreview> {
  const chosen = channels.filter((c) => CHANNELS.includes(c));
  if (chosen.length === 0) return { ok: false, error: "Choose at least one channel." };
  const loaded = await loadOriginal(messageId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  if (loaded.unseenIds.length === 0) return { ok: true, unseen: 0, people: loaded.people, reachable: 0, perChannel: { email: 0, sms: 0, whatsapp: 0 }, problems: [], notes: [] };
  const preview = await previewSend(reminderInput(loaded.input, chosen, loaded.unseenIds));
  return {
    ok: true,
    unseen: loaded.unseenIds.length,
    people: loaded.people,
    reachable: preview.people,
    perChannel: preview.perChannel,
    problems: preview.problems.map((p) => p.problem),
    notes: preview.notes,
  };
}

export async function sendResend(messageId: string, channels: Channel[]): Promise<SubmitResult> {
  const chosen = channels.filter((c) => CHANNELS.includes(c));
  if (chosen.length === 0) return { success: false, error: "Choose at least one channel." };
  const loaded = await loadOriginal(messageId);
  if ("error" in loaded) return { success: false, error: loaded.error };
  if (loaded.unseenIds.length === 0) return { success: false, error: "Everyone has already confirmed or read this message." };
  return submitMessage(reminderInput(loaded.input, chosen, loaded.unseenIds), { action: "send_now", resendOf: messageId });
}
