// Single source of truth for audience-category badge colours. Values are
// semantic theme utilities (see app/globals.css) so they adapt to dark mode.
export const CATEGORY_BADGE: Record<string, string> = {
  student: "bg-cat-blue-tint text-cat-blue",
  parent: "bg-cat-violet-tint text-cat-violet",
  grandparent: "bg-cat-purple-tint text-cat-purple",
  alumni: "bg-cat-indigo-tint text-cat-indigo",
  faculty: "bg-cat-amber-tint text-cat-amber",
  staff: "bg-cat-orange-tint text-cat-orange",
  board: "bg-cat-rose-tint text-cat-rose",
  donor: "bg-cat-emerald-tint text-cat-emerald",
  prospect: "bg-cat-teal-tint text-cat-teal",
};

export const CATEGORY_BADGE_FALLBACK = "bg-surface-2 text-text-muted";
