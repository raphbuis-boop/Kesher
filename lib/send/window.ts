/**
 * Is it OK to send right now? (Shabbos / Yom Tov blocking is added in Phase 3.1;
 * this is the single place every manual and scheduled send asks.)
 */
export type SendWindowStatus = { blocked: false } | { blocked: true; message: string; until: string | null };

export async function sendWindowStatus(): Promise<SendWindowStatus> {
  return { blocked: false };
}
