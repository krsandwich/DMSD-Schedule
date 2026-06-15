import { isWorking } from './attendance';
import type { DayMap, Staff } from './types';

const MAX_MAS = 2;

/**
 * Step 4 — Assign MAs.
 *
 * Recipients: the 6 providers (`receivesMas`) that are working. Each gets min 1,
 * max 2 MAs.
 *
 * MA pool = the 10 MAs + Keahi (`role === 'ma' || inMaPool`), minus the MOD and
 * anyone off. Hard constraint: an MA may only be assigned to a provider at the
 * SAME location that day.
 *
 * Distribution:
 *   1. Tricia (priority 1) is guaranteed 2 first.
 *   2. Everyone else is balanced evenly: each remaining MA goes to the working
 *      provider with the FEWEST MAs so far (tie-break by provider priority) that
 *      has an available same-location MA. This prevents a lower-priority provider
 *      sitting at 0 while a higher-priority one reaches 2 at the same location.
 */
export function assignMAs(day: DayMap, staff: Staff[]): void {
  const providers = staff
    .filter((s) => s.receivesMas && isWorking(day, s.id))
    .sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));

  // Available MAs (working, in pool, not the MOD, not already assigned).
  const pool: Staff[] = staff.filter((s) => {
    if (!(s.role === 'ma' || s.inMaPool)) return false;
    if (!isWorking(day, s.id)) return false;
    const a = day.get(s.id);
    return !!a && !a.isMod && a.assignedProviderId === null;
  });

  const counts = new Map<string, number>(); // providerId -> MAs assigned
  const locationOf = (p: Staff) => day.get(p.id)?.location ?? 'off';

  const place = (provider: Staff): boolean => {
    const current = counts.get(provider.id) ?? 0;
    if (current >= MAX_MAS) return false;
    const idx = pool.findIndex((m) => day.get(m.id)?.location === locationOf(provider));
    if (idx === -1) return false;
    const [ma] = pool.splice(idx, 1);
    const a = day.get(ma.id);
    if (a) {
      a.assignedProviderId = provider.id;
      a.maSlot = current + 1;
    }
    counts.set(provider.id, current + 1);
    return true;
  };

  // 1. Tricia is guaranteed up to 2 first.
  const tricia = providers.find((p) => p.priorityRank === 1);
  if (tricia) {
    place(tricia);
    place(tricia);
  }

  // 2. Distribute the rest evenly by lowest current count.
  while (pool.length > 0) {
    const candidates = providers.filter(
      (p) =>
        (counts.get(p.id) ?? 0) < MAX_MAS &&
        pool.some((m) => day.get(m.id)?.location === locationOf(p)),
    );
    if (candidates.length === 0) break; // remaining MAs have no same-location provider

    candidates.sort((a, b) => {
      const byCount = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
      if (byCount !== 0) return byCount;
      return (a.priorityRank ?? 99) - (b.priorityRank ?? 99);
    });

    place(candidates[0]);
  }
}
