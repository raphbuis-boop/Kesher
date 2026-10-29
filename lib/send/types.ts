import type { ContactPreferences } from "@/lib/preferences";

export type Channel = "email" | "sms" | "whatsapp";
export const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];
export type ChannelMode = "all" | "best";

/** Everything the compose screen decides; stored on messages.payload so a draft, scheduled or recurring send can be rebuilt exactly. */
export type MessageInput = {
  audienceSlugs: string[];
  audienceLabel: string;
  channels: Channel[];
  channelMode: ChannelMode;
  subject: string;
  body: string;
  /** e.g. "Hi {{first_name}}," — email only */
  greeting: string | null;
  attachmentUrls: string[];
  templateId: string | null;
  isFundraising: boolean;
  isEmergency: boolean;
  /** Start each parent's message with "For Moshe (3rd) and Rivka (6th)" */
  familyPrefix: boolean;
  /** Add an "I've read this" button / link (Phase 2.5) */
  confirmButton: boolean;
  /** Also message students directly when they have contact info of their own */
  studentsDirect: boolean;
  excludePersonIds: string[];
  /** Restricts the send to these people (used by "resend to people who haven't read") */
  onlyPersonIds: string[] | null;
};

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  salutation: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  grade: string | null;
  graduation_year: number | null;
  categories: string[] | null;
  custom_fields: Record<string, unknown> | null;
};

export type Child = { id: string; first_name: string; last_name: string; grade: string | null; custom_fields: Record<string, unknown> | null };

export type ResolvedRecipient = {
  person: Person;
  channel: Channel;
  /** email address, or E.164 phone number */
  address: string;
  children: Child[];
  /** Channels to try next if this one fails (best-channel mode) */
  fallbackChannels: Channel[];
};

export type ExcludedReason = "opted_out" | "preference" | "no_address" | "duplicate_address" | "emergency_only" | "whatsapp_unavailable" | "not_receiving";

export type Resolution = {
  recipients: ResolvedRecipient[];
  /** Distinct people (parents/adults) who will receive at least one message */
  people: number;
  perChannel: Record<Channel, number>;
  excluded: Record<ExcludedReason, number>;
  /** People in the audience who end up with no way to be reached (and why) */
  unreachable: { person: Person; reason: string }[];
  /** Matched students that no parent is linked to */
  studentsWithoutParent: number;
};

export type { ContactPreferences };
