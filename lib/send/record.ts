import type { Channel, MessageInput } from "./types";

/**
 * The messages-table columns that mirror a MessageInput. `payload` keeps the
 * whole input so a draft, scheduled, recurring or resent message can be rebuilt
 * (and sent) exactly as composed; the audience is resolved at send time, so a
 * scheduled message always goes to the roster as it is then.
 */
export function messageColumns(input: MessageInput, channels: Channel[] = input.channels) {
  return {
    subject: channels.includes("email") ? input.subject || null : null,
    body: input.body,
    channel: channels.length === 1 ? channels[0] : "multi",
    channels,
    channel_mode: input.channelMode,
    audience_slug: input.audienceSlugs.join(","),
    audience_label: input.audienceLabel || "Audience",
    template_id: input.templateId,
    is_fundraising: input.isFundraising,
    is_emergency: input.isEmergency,
    family_prefix: input.familyPrefix,
    payload: { ...input, channels },
  };
}
