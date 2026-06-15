import { isWorking } from './attendance';
import type { DayMap, Staff } from './types';

/**
 * Step 2 — MOD (exactly one per day).
 *
 * Choose the highest-priority working MOD-eligible person (lowest `modPriority`:
 * Keahi 1 → Sara 2 → Reina 3). MOD is standalone — they are removed from the MA
 * pool and not placed under any provider.
 *
 * @returns the chosen MOD's staff id, or null if none is working.
 */
export function assignMod(day: DayMap, staff: Staff[]): string | null {
  const eligible = staff
    .filter((s) => s.modPriority != null && isWorking(day, s.id))
    .sort((a, b) => (a.modPriority as number) - (b.modPriority as number));

  const mod = eligible[0];
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
