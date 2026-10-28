/**
 * The three delivery channels behind one interface, so the engine can be run
 * (and tested) without real providers.
 */

import { Resend } from "resend";
import type { ChannelConfig } from "@/lib/channels";
import { getSmsProvider, getWhatsAppProvider } from "@/lib/sms-provider";

export type EmailItem = { to: string; subject: string; html: string; text: string; headers: Record<string, string> };

export type Senders = {
  /** One batch (≤100). Returns a provider id per item (null = that item was refused) or a batch-level error. */
  email(args: { from: string; replyTo?: string; items: EmailItem[]; idempotencyKey: string }): Promise<{ error?: string; ids: (string | null)[] }>;
  sms(args: { to: string; from: string; body: string }): Promise<{ providerId: string | null; error?: string }>;
  whatsapp(args: { to: string; body: string; label: string; mediaUrl?: string }): Promise<{ providerId: string | null; error?: string }>;
};

export function realSenders(cfg: ChannelConfig): Senders {
  return {
    async email({ from, replyTo, items, idempotencyKey }) {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const payload = items.map((i) => ({ from, to: i.to, subject: i.subject, html: i.html, text: i.text, headers: i.headers, ...(replyTo ? { replyTo } : {}) }));
      const result = await resend.batch.send(payload as Parameters<typeof resend.batch.send>[0], { idempotencyKey });
      if (result.error || !result.data) {
        return { error: result.error ? `${result.error.name}: ${result.error.message}` : "No data returned from Resend", ids: items.map(() => null) };
      }
      const ids = result.data.data;
      return { ids: items.map((_, i) => ids[i]?.id ?? null) };
    },
    async sms({ to, from, body }) {
      const provider = cfg.sms ? getSmsProvider() : null;
      if (!provider) return { providerId: null, error: cfg.smsProblem ?? "SMS isn't configured" };
      const r = await provider.send("sms", { to, from, body });
      return { providerId: r.providerId, error: r.success ? undefined : (r.error ?? "Unknown send error") };
    },
    async whatsapp({ to, body, label, mediaUrl }) {
      if (!cfg.whatsapp) return { providerId: null, error: cfg.whatsappProblem ?? "WhatsApp isn't configured" };
      const r = await getWhatsAppProvider(cfg.whatsapp).send("whatsapp", { to, from: "", body, label, mediaUrl });
      return { providerId: r.providerId, error: r.success ? undefined : (r.error ?? "Unknown send error") };
    },
  };
}

/** Simulated-send tenants (demo workspaces): every send "succeeds" with a synthetic id and nothing leaves the building. */
export function simulatedSenders(): Senders {
  const id = () => `demo-${crypto.randomUUID()}`;
  return {
    email: async ({ items }) => ({ ids: items.map(() => id()) }),
    sms: async () => ({ providerId: id() }),
    whatsapp: async () => ({ providerId: id() }),
  };
}
