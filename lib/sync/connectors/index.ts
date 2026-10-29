/**
 * School-information-system connectors.
 *
 * Adding FACTS, Veracross or Blackbaud later is ONE file each:
 *   1. Create lib/sync/connectors/facts.ts exporting a `SisConnector`
 *      (see lib/sync/types.ts): fetchHouseholds / fetchGuardians /
 *      fetchStudents, each returning normalized records with the vendor's
 *      own IDs as `sourceId`.
 *   2. Register it in CONNECTORS below and flip its `available` flag in
 *      PROVIDERS.
 * Everything else — diffing, the New contacts review queue, 3-strike
 * archiving, sync history, the nightly cron, Sync now — is the shared sync
 * engine and needs no changes.
 */

import { batchFromConnector, type SisConnector, type SyncBatch, type SyncKind } from "../types";
import type { SyncSourceRow } from "../engine";

export type ProviderKind = "facts" | "veracross" | "blackbaud";

export type ProviderInfo = {
  kind: ProviderKind;
  label: string;
  blurb: string;
  /** True once its connector file exists and is registered. */
  available: boolean;
};

export const PROVIDERS: ProviderInfo[] = [
  { kind: "facts", label: "FACTS", blurb: "Sync families, students and parents from FACTS SIS.", available: false },
  { kind: "veracross", label: "Veracross", blurb: "Sync families, students and parents from Veracross.", available: false },
  { kind: "blackbaud", label: "Blackbaud", blurb: "Sync families, students and parents from Blackbaud (Education Edge / SIS).", available: false },
];

/** Registered connectors. Empty until a vendor connector ships. */
const CONNECTORS: Partial<Record<SyncKind, SisConnector>> = {};

export function getConnector(kind: SyncKind): SisConnector | null {
  return CONNECTORS[kind] ?? null;
}

/** Fetches a source's current records, whichever kind of source it is. */
export async function fetchBatchForSource(orgId: string, source: SyncSourceRow): Promise<SyncBatch> {
  if (source.kind === "google_sheets") {
    const { fetchSheetBatch } = await import("../sheets");
    return fetchSheetBatch(orgId, source);
  }
  const connector = getConnector(source.kind);
  if (!connector) throw new Error(`${source.kind} sync isn't available yet.`);
  const ctx = { orgId, sourceId: source.id, config: source.config };
  const [households, guardians, students] = await Promise.all([
    connector.fetchHouseholds(ctx),
    connector.fetchGuardians(ctx),
    connector.fetchStudents(ctx),
  ]);
  return batchFromConnector(households, guardians, students);
}

/** Source kinds the nightly job can run today. */
export function isRunnableKind(kind: SyncKind): boolean {
  return kind === "google_sheets" || getConnector(kind) !== null;
}
