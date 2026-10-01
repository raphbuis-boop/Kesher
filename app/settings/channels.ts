import { validateMetaWhatsAppEnv, validateSmsEnv } from "@/lib/sms-provider";

/** Read-only connection status for each sending channel (never exposes secrets). */
export type ChannelStatus = {
  key: "email" | "sms" | "whatsapp";
  label: string;
  connected: boolean;
  detail: { label: string; value: string }[];
  problem: string | null;
};

async function whatsappProfile(): Promise<{ number: string; name: string } | null> {
  const id = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(id)}?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(2500),
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_phone_number?: string; verified_name?: string };
    return { number: data.display_phone_number ?? "", name: data.verified_name ?? "" };
  } catch {
    return null;
  }
}

export async function getChannelStatuses(senderEmail: string): Promise<ChannelStatus[]> {
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "";
  const emailConnected = !!(process.env.RESEND_API_KEY && fromEmail);
  const domain = fromEmail.includes("@") ? fromEmail.split("@")[1] : "";

  const smsProblem = validateSmsEnv("sms");
  const waProblem = validateMetaWhatsAppEnv();
  const wa = waProblem ? null : await whatsappProfile();

  return [
    {
      key: "email",
      label: "Email",
      connected: emailConnected,
      detail: emailConnected
        ? [
            { label: "Sending domain", value: domain },
            { label: "From address", value: senderEmail && senderEmail.endsWith(`@${domain}`) ? senderEmail : fromEmail },
          ]
        : [],
      problem: emailConnected ? null : "Resend isn't configured (RESEND_API_KEY / RESEND_FROM_EMAIL).",
    },
    {
      key: "sms",
      label: "SMS",
      connected: !smsProblem,
      detail: smsProblem ? [] : [{ label: "Number", value: process.env.SINCH_SMS_SENDER ?? "" }],
      problem: smsProblem ? "Sinch SMS isn't fully configured." : null,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      connected: !waProblem,
      detail: waProblem
        ? []
        : wa
          ? [
              { label: "Number", value: wa.number || "—" },
              { label: "Display name", value: wa.name || "—" },
            ]
          : [{ label: "Phone number ID", value: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "" }],
      problem: waProblem ? "WhatsApp (Meta Cloud API) isn't fully configured." : null,
    },
  ];
}
