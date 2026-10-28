/**
 * Normalized records every source produces — a CSV/Excel file, a Google
 * Sheet, and later FACTS / Veracross / Blackbaud. The sync engine
 * (lib/sync/engine.ts) only ever sees these, so a new connector is one file
 * that implements SisConnector.
 */

export type SyncKind = "csv" | "google_sheets" | "facts" | "veracross" | "blackbaud";

export type SyncHousehold = {
  sourceId: string;
  name: string;
  address: string | null;
};

/** Which built-in category a record gets (people.categories). */
export type PersonKind = "guardian" | "student" | "staff" | "faculty" | "other";

export type SyncPerson = {
  sourceId: string;
  kind: PersonKind;
  householdSourceId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  grade: string | null;
  graduationYear: number | null;
  /** Only keys present here are written; other custom fields are left alone. */
  customFields: Record<string, string>;
  /** Which optional fields this source actually provides (unmapped fields are never overwritten). */
  provided: ProvidedField[];
};

export type ProvidedField = "email" | "phone" | "whatsapp" | "grade" | "graduation_year";

export type SyncLink = {
  guardianSourceId: string;
  studentSourceId: string;
  relationship: string;
  custodial: boolean;
  receivesMessages: boolean;
};

export type RowProblem = { row: number; message: string };

/** Everything one run of a source produced, ready to diff against the database. */
export type SyncBatch = {
  households: SyncHousehold[];
  people: SyncPerson[];
  links: SyncLink[];
  /** Admin-facing warnings (e.g. "no ID column — matching by email/phone"). */
  warnings: string[];
  problems: RowProblem[];
  /** "source_ids" when the source has stable IDs; "fallback" when matching on email/phone/name. */
  idStrategy: "source_ids" | "fallback";
};

/**
 * A school-information-system connector. Each fetch returns normalized
 * records; guardians carry their student links. Credentials/config come from
 * sync_sources.config (non-secret) and the encrypted secret store.
 */
export type ConnectorContext = {
  orgId: string;
  sourceId: string;
  config: Record<string, unknown>;
};

export type SyncGuardian = SyncPerson & {
  studentLinks: Omit<SyncLink, "guardianSourceId">[];
};

export interface SisConnector {
  kind: SyncKind;
  label: string;
  fetchHouseholds(ctx: ConnectorContext): Promise<SyncHousehold[]>;
  fetchGuardians(ctx: ConnectorContext): Promise<SyncGuardian[]>;
  fetchStudents(ctx: ConnectorContext): Promise<SyncPerson[]>;
}

/** Turns a connector's three lists into one batch for the engine. */
export function batchFromConnector(
  households: SyncHousehold[],
  guardians: SyncGuardian[],
  students: SyncPerson[],
  warnings: string[] = []
): SyncBatch {
  const links: SyncLink[] = guardians.flatMap((g) =>
    g.studentLinks.map((l) => ({ ...l, guardianSourceId: g.sourceId }))
  );
  const people: SyncPerson[] = [
    ...guardians.map((g) => {
      const person: SyncPerson & { studentLinks?: unknown } = { ...g };
      delete person.studentLinks;
      return person;
    }),
    ...students,
  ];
  return { households, people, links, warnings, problems: [], idStrategy: "source_ids" };
}
