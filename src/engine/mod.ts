import type { DayMap, MonthlyPattern, Staff } from './types';

/**
 * Step 2 — MOD (exactly one per day).
 *
 * No special-case people: MOD goes to the highest-ranked person (lowest `modRank`,
 * set in monthly setup) who is working AT KONA that day. MOD is standalone — they
 * are removed from the MA pool and not placed under any provider.
 *
 * @returns the chosen MOD's staff id, or null if none is eligible at Kona.
 */
export function assignMod(
  day: DayMap,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern> = new Map(),
): string | null {
  const eligible = staff
    .map((s) => ({ s, rank: patternsByStaff.get(s.id)?.modRank ?? null }))
    .filter((e) => e.rank != null && day.get(e.s.id)?.location === 'kona')
    .sort((a, b) => (a.rank as number) - (b.rank as number));

  const mod = eligible[0]?.s;
  if (!mod) return null;

  const assignment = day.get(mod.id);
  if (assignment) {
    assignment.isMod = true;
    // Standalone: ensure not also placed under a provider.
    assignment.assignedProviderId = null;
    assignment.maSlot = null;
  }
  return mod.id;
}
