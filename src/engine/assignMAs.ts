import { isWorking } from './attendance';
import type { DayMap, MonthlyPattern, Staff } from './types';

const MAX_MAS = 2;

/**
 * Step 4 — Assign MAs.
 *
 * Recipients: the 6 providers (`receivesMas`) that are working. Each gets min 1,
 * max 2 MAs.
 *
 * MA pool = the MAs (`role === 'ma'`), minus the MOD and anyone off. Managers may
 * be assigned as an MA manually in the editor, but are never auto-pooled here.
 * Hard constraint: an MA may only be assigned to a provider at the SAME location.
 *
 * Distribution:
 *   1. Every working provider gets one MA, in provider-priority order.
 *   2. Providers flagged "2 MAs" in monthly setup get a second MA, in
 *      provider-priority order.
 * MA selection prefers an MA whose default provider (set in monthly setup) is the
 * one being filled, then an MA not reserved for some other working provider. Any
 * MAs left over after step 2 stay unassigned.
 */
export function assignMAs(
  day: DayMap,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern> = new Map(),
): void {
  // Provider fill order comes from the per-month rank set in monthly setup.
  const rankOf = (p: Staff) => patternsByStaff.get(p.id)?.providerRank ?? 99;
  const providers = staff
    .filter((s) => s.receivesMas && isWorking(day, s.id))
    .sort((a, b) => rankOf(a) - rankOf(b));
  const providerById = new Map(providers.map((p) => [p.id, p]));

  // Available MAs (working, not the MOD, not already assigned). Managers are NOT
  // auto-pooled — they can be assigned as an MA manually in the editor.
  let pool: Staff[] = staff.filter((s) => {
    if (s.role !== 'ma') return false;
    if (!isWorking(day, s.id)) return false;
    const a = day.get(s.id);
    return !!a && !a.isMod && a.assignedProviderId === null;
  });

  const counts = new Map<string, number>(); // providerId -> MAs assigned
  const locationOf = (p: Staff) => day.get(p.id)?.location ?? 'off';

  const assignTo = (ma: Staff, provider: Staff) => {
    const current = counts.get(provider.id) ?? 0;
    const a = day.get(ma.id);
    if (a) {
      a.assignedProviderId = provider.id;
      a.maSlot = current + 1;
    }
    counts.set(provider.id, current + 1);
    pool = pool.filter((m) => m.id !== ma.id);
  };

  const place = (provider: Staff): boolean => {
    if ((counts.get(provider.id) ?? 0) >= MAX_MAS) return false;
    const sameLoc = pool.filter((m) => day.get(m.id)?.location === locationOf(provider));
    if (sameLoc.length === 0) return false;
    const ma =
      // an MA whose default provider is this one
      sameLoc.find((m) => patternsByStaff.get(m.id)?.defaultTargetId === provider.id) ??
      // otherwise an MA not reserved for some other working provider
      sameLoc.find((m) => {
        const t = patternsByStaff.get(m.id)?.defaultTargetId;
        return !t || !providerById.has(t);
      }) ??
      sameLoc[0];
    assignTo(ma, provider);
    return true;
  };

  // 1. Every working provider gets one MA, in priority order.
  for (const provider of providers) place(provider);

  // 2. Providers flagged "2 MAs" get a second MA, in priority order.
  for (const provider of providers) {
    if (patternsByStaff.get(provider.id)?.wantsTwoMas) place(provider);
  }
}
