/**
 * "Exactly these people" as an audience: `people:<id>.<id>…`. Used when staff
 * select people on the People page (or a family/student) and press Message.
 * Students resolve to their receiving parents like any audience. Pure, so
 * the People page and compose can both use it.
 */
export const PEOPLE_SLUG_PREFIX = "people:";

/** Keeps the compose URL well under hosting URL limits. */
export const MAX_PICKED_PEOPLE = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function peopleSlug(ids: string[]): string {
  return PEOPLE_SLUG_PREFIX + [...new Set(ids)].join(".");
}

/** The person ids in a people slug, or null if `slug` isn't one. */
export function parsePeopleSlug(slug: string): string[] | null {
  if (!slug.startsWith(PEOPLE_SLUG_PREFIX)) return null;
  const ids = slug.slice(PEOPLE_SLUG_PREFIX.length).split(".").filter((s) => UUID.test(s));
  return [...new Set(ids)].slice(0, MAX_PICKED_PEOPLE);
}

export function composeUrlForPeople(ids: string[]): string {
  return `/messages/new?audiences=${encodeURIComponent(peopleSlug(ids.slice(0, MAX_PICKED_PEOPLE)))}`;
}
