import { isWorking } from './attendance';
import type { DayMap, Staff } from './types';

const SOFT_MAX = 2;

/**
 * Step 5 — Assign PCCs / Aesthetic Concierge.
 *
 * Targets needing coverage: working staff with `needsPcc` (6 providers + 2
 * estheticians + RN Abby). Each PCC covers 1-2 targets as a soft goal but may
 * exceed 2 when needed.
 *
 * Gap-fill order: assign the 4 PCCs first; cover any remaining targets with
 * Aesthetic Concierge (`canPcc`) acting as PCC. Location matching is a soft
 * preference and is not enforced here.
 */
export function assignPCCs(day: DayMap, staff: Staff[]): void {
  const targets = staff.filter((s) => s.needsPcc && isWorking(day, s.id));

  const pccs = staff.filter((s) => s.role === 'pcc' && isWorking(day, s.id));
  const concierge = staff.filter(
    (s) => s.role === 'aesthetic_concierge' && s.canPcc && isWorking(day, s.id),
  );

  const load = new Map<string, number>();
  const loadOf = (id: string) => load.get(id) ?? 0;

  const assign = (coverers: Staff[], targetId: string, respectSoftMax: boolean): boolean => {
    let best: Staff | undefined;
    for (const c of coverers) {
      if (respectSoftMax && loadOf(c.id) >= SOFT_MAX) continue;
      if (!best || loadOf(c.id) < loadOf(best.id)) best = c;
    }
    if (!best) return false;
    day.get(best.id)?.pccCoversIds.push(targetId);
    load.set(best.id, loadOf(best.id) + 1);
    return true;
  };

  for (const target of targets) {
    // PCCs first (respecting soft max), then concierge (respecting soft max),
    // then exceed soft max on PCCs, finally exceed on concierge.
    if (assign(pccs, target.id, true)) continue;
    if (assign(concierge, target.id, true)) continue;
    if (assign(pccs, target.id, false)) continue;
    assign(concierge, target.id, false);
    // If nothing assigned, a warning is computed later.
  }
}
