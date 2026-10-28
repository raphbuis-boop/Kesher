/**
 * Merge-token template engine for personalized messages.
 *
 * Parents are the recipients, their children the subject: {{student_first_name}}
 * is the child (or children) the message is about, {{grade}} the child's grade,
 * and any custom field key ({{division}}, {{team}}…) is read from the parent,
 * then from the child. With no children linked they fall back to the person.
 *
 * Supported tokens:
 *   {{first_name}}          preferred_name ?? first_name ?? "Friend"
 *   {{last_name}}           last_name
 *   {{full_name}}           first_name + last_name
 *   {{preferred_name}}      same as {{first_name}}
 *   {{salutation}}          salutation (e.g. "Rabbi", "Mrs.")
 *   {{email}}               email address
 *   {{grade}}               computed grade label from graduation_year (e.g. "Grade 8")
 *   {{parent_first_name}}   alias for first_name (person IS the parent)
 *   {{parent_last_name}}    alias for last_name
 *   {{student_first_name}}  alias for first_name (person IS the student)
 *   {{student_last_name}}   alias for last_name
 *
 * Unknown tokens are left as-is so they surface in previews.
 */

import { gradeLabel } from "@/lib/gradYear";

export type ChildContext = {
  first_name: string;
  last_name?: string | null;
  grade?: string | null;
  custom_fields?: Record<string, unknown> | null;
};

export type PersonContext = {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  salutation?: string | null;
  email?: string | null;
  graduation_year?: number | null;
  grade?: string | null;
  custom_fields?: Record<string, unknown> | null;
  /** The students this message is about (a parent's children in the audience). */
  children?: ChildContext[];
};

/** "Moshe", "Moshe and Rivka", "Moshe, Rivka and Yossi" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function gradeText(grade: string): string {
  return /^\d+$/.test(grade.trim()) ? `Grade ${grade.trim()}` : grade.trim();
}

const TOKEN_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(body: string, person: PersonContext): string {
  return body.replace(TOKEN_RE, (match, token: string) => {
    switch (token) {
      case "first_name":
      case "preferred_name":
      case "parent_first_name":
        return person.preferred_name?.trim() || person.first_name?.trim() || "Friend";
      case "student_first_name": {
        const kids = person.children?.filter((c) => c.first_name?.trim()) ?? [];
        if (kids.length > 0) return joinNames(kids.map((c) => c.first_name.trim()));
        return person.preferred_name?.trim() || person.first_name?.trim() || "Friend";
      }
      case "last_name":
      case "parent_last_name":
        return person.last_name?.trim() || "";
      case "student_last_name":
        return person.children?.[0]?.last_name?.trim() || person.last_name?.trim() || "";
      case "full_name": {
        const full = [person.first_name, person.last_name]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(" ");
        return full || "Friend";
      }
      case "salutation":
        return person.salutation?.trim() || "";
      case "email":
        return person.email?.trim() || "";
      case "grade": {
        const kidGrade = person.children?.find((c) => c.grade?.trim())?.grade;
        if (kidGrade) return gradeText(kidGrade);
        if (person.grade?.trim()) return gradeText(person.grade);
        if (!person.graduation_year) return "";
        return gradeLabel(person.graduation_year);
      }
      default: {
        // Custom fields: the parent's own value first, then their child's
        const own = person.custom_fields?.[token];
        if (own !== undefined && own !== null && String(own).trim()) return String(own).trim();
        const kid = person.children?.map((c) => c.custom_fields?.[token]).find((v) => v !== undefined && v !== null && String(v).trim());
        if (kid !== undefined && kid !== null) return String(kid).trim();
        return match; // leave unknown tokens visible
      }
    }
  });
}

/** Available tokens for the composer token picker. */
export const TEMPLATE_TOKENS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{full_name}}", label: "Full name" },
  { token: "{{salutation}}", label: "Salutation" },
  { token: "{{email}}", label: "Email address" },
  { token: "{{grade}}", label: "Grade" },
  { token: "{{parent_first_name}}", label: "Parent first name" },
  { token: "{{parent_last_name}}", label: "Parent last name" },
  { token: "{{student_first_name}}", label: "Student first name" },
  { token: "{{student_last_name}}", label: "Student last name" },
] as const;

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];
