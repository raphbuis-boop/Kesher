/**
 * Merge-token template engine for personalized messages.
 *
 * Supported tokens:
 *   {{first_name}}    preferred_name ?? first_name ?? "Friend"
 *   {{last_name}}     last_name
 *   {{full_name}}     first_name + last_name
 *   {{preferred_name}} preferred_name ?? first_name ?? "Friend"
 *   {{salutation}}    salutation (e.g. "Rabbi", "Mrs.")
 *
 * Unknown tokens are left as-is so they surface in previews.
 */

export type PersonContext = {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  salutation?: string | null;
};

const TOKEN_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(body: string, person: PersonContext): string {
  return body.replace(TOKEN_RE, (match, token: string) => {
    switch (token) {
      case "first_name":
      case "preferred_name":
        return person.preferred_name?.trim() || person.first_name?.trim() || "Friend";
      case "last_name":
        return person.last_name?.trim() || "";
      case "full_name": {
        const full = [person.first_name, person.last_name]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(" ");
        return full || "Friend";
      }
      case "salutation":
        return person.salutation?.trim() || "";
      default:
        return match; // leave unknown tokens visible
    }
  });
}

/** Available tokens for the composer token picker. */
export const TEMPLATE_TOKENS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{full_name}}", label: "Full name" },
  { token: "{{salutation}}", label: "Salutation" },
] as const;

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];
