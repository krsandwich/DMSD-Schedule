import type { DayMap, MonthlyPattern, Staff } from './types';

/**
 * Step 6 — Shipping.
 *
 * Shipping is given to the highest-ranked person (lowest `shippingRank`, set in
 * monthly setup) who is working AT KONA. If nobody is ranked/at Kona, the MOD is
 * the backup. Only one is auto-assigned; the Editor may add or change shipping
 * per-day in the assignment editor.
 *
 * @returns the chosen person's staff id, or null if no one is available.
 */
export function assignShipping(
  day: DayMap,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern> = new Map(),
): string | null {
  const eligible = staff
    .map((s) => ({ s, rank: patternsByStaff.get(s.id)?.shippingRank ?? null }))
    .filter((e) => e.rank != null && day.get(e.s.id)?.location === 'kona')
    .sort((a, b) => (a.rank as number) - (b.rank as number));

  let chosenId = eligible[0]?.s.id ?? null;

  // Backup: whoever is MOD that day handles shipping if no one else is ranked.
  if (!chosenId) {
    for (const [id, a] of day) {
      if (a.isMod) {
        chosenId = id;
        break;
      }
    }
  }

  if (!chosenId) return null;
  const assignment = day.get(chosenId);
  if (assignment) assignment.isShipping = true;
  return chosenId;
}
