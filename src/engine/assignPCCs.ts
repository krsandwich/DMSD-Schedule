import { isWorking } from './attendance';
import type { DayMap, Location, MonthlyPattern, Staff } from './types';

const SOFT_MAX = 2;

/**
 * Step 5 — Assign PCCs / Aesthetic Concierge.
 *
 * Targets needing coverage: working staff with `needsPcc` (6 providers + 2
 * estheticians + RN Abby). Each PCC covers 1-2 targets as a soft goal but may
 * exceed 2 when needed.
 *
 * Location is a HARD constraint: a PCC / concierge may only cover a target at
 * the SAME location that day. A target with no same-location coverer is left
 * uncovered (and raises a warning).
 *
 * Defaults: a PCC with a default target (set in monthly setup) covers that target
 * first when both are working at the same location. Remaining targets gap-fill in
 * order: the 4 PCCs first, then Aesthetic Concierge (`canPcc`) acting as PCC.
 */
export function assignPCCs(
  day: DayMap,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern> = new Map(),
): void {
  const targets = staff.filter((s) => s.needsPcc && isWorking(day, s.id));
  const targetIds = new Set(targets.map((t) => t.id));

  const pccs = staff.filter((s) => s.role === 'pcc' && isWorking(day, s.id));
  const concierge = staff.filter(
    (s) => s.role === 'aesthetic_concierge' && s.canPcc && isWorking(day, s.id),
  );

  const load = new Map<string, number>();
  const loadOf = (id: string) => load.get(id) ?? 0;
  const locationOf = (id: string): Location | undefined => day.get(id)?.location;
  const covered = new Set<string>();

  const cover = (covererId: string, targetId: string) => {
    day.get(covererId)?.pccCoversIds.push(targetId);
    load.set(covererId, loadOf(covererId) + 1);
    covered.add(targetId);
  };

  const assign = (coverers: Staff[], targetId: string, respectSoftMax: boolean): boolean => {
    const targetLoc = locationOf(targetId);
    let best: Staff | undefined;
    for (const c of coverers) {
      if (locationOf(c.id) !== targetLoc) continue; // hard same-location constraint
      if (respectSoftMax && loadOf(c.id) >= SOFT_MAX) continue;
      if (!best || loadOf(c.id) < loadOf(best.id)) best = c;
    }
    if (!best) return false;
    cover(best.id, targetId);
    return true;
  };

  // Honor default targets first (same location, target working & not yet covered).
  for (const coverer of [...pccs, ...concierge]) {
    const targetId = patternsByStaff.get(coverer.id)?.defaultTargetId;
    if (!targetId || covered.has(targetId) || !targetIds.has(targetId)) continue;
    if (locationOf(coverer.id) !== locationOf(targetId)) continue;
    cover(coverer.id, targetId);
  }

  for (const target of targets) {
    if (covered.has(target.id)) continue;
    // Same-location PCCs first (respecting soft max), then same-location concierge,
    // then exceed soft max on PCCs, finally exceed on concierge.
    if (assign(pccs, target.id, true)) continue;
    if (assign(concierge, target.id, true)) continue;
    if (assign(pccs, target.id, false)) continue;
    assign(concierge, target.id, false);
    // If still unassigned (no same-location coverer), a warning is computed later.
  }
}
