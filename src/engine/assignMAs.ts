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
 * Fill order:
 *   1. Tricia (priority 1) gets 2 first.
 *   2. Ensure every other working provider has >= 1.
 *   3. Distribute remaining MAs as 2nd assistants in provider priority order.
 */
export function assignMAs(day: DayMap, staff: Staff[]): void {
  const providers = staff
    .filter((s) => s.receivesMas && isWorking(day, s.id))
    .sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));

  // Available MAs grouped by location.
  const pool: Staff[] = staff.filter((s) => {
    if (!(s.role === 'ma' || s.inMaPool)) return false;
    if (!isWorking(day, s.id)) return false;
    const a = day.get(s.id);
    return !!a && !a.isMod && a.assignedProviderId === null;
  });

  const counts = new Map<string, number>(); // providerId -> MAs assigned

  const place = (providerId: string, providerLocation: string): boolean => {
    const current = counts.get(providerId) ?? 0;
    if (current >= MAX_MAS) return false;
    const idx = pool.findIndex((m) => day.get(m.id)?.location === providerLocation);
    if (idx === -1) return false;
    const [ma] = pool.splice(idx, 1);
    const a = day.get(ma.id);
    if (a) {
      a.assignedProviderId = providerId;
      a.maSlot = current + 1;
    }
    counts.set(providerId, current + 1);
    return true;
  };

  // 1. Tricia (priority 1) gets 2 first.
  const tricia = providers.find((p) => p.priorityRank === 1);
  if (tricia) {
    const loc = day.get(tricia.id)?.location ?? 'off';
    place(tricia.id, loc);
    place(tricia.id, loc);
  }

  // 2. Ensure every other working provider has >= 1.
  for (const p of providers) {
    if ((counts.get(p.id) ?? 0) >= 1) continue;
    const loc = day.get(p.id)?.location ?? 'off';
    place(p.id, loc);
  }

  // 3. Distribute remaining MAs as 2nd assistants, provider priority order.
  let progress = true;
  while (pool.length > 0 && progress) {
    progress = false;
    for (const p of providers) {
      if ((counts.get(p.id) ?? 0) >= MAX_MAS) continue;
      const loc = day.get(p.id)?.location ?? 'off';
      if (place(p.id, loc)) progress = true;
    }
  }
}
