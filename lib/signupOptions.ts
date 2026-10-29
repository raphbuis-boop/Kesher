import { GRADE_ORDER } from "@/lib/grades";

/** Choices on the public signup form (kept separate so the browser bundle doesn't pull in server code). */
export const SIGNUP_GRADES = [...GRADE_ORDER] as string[];
export const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other", label: "Other" },
];
