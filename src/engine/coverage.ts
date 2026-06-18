import { isWorking } from './attendance';
import type { DayMap, MonthlyPattern, Staff } from './types';

/**
 * Step 3 — Provider coverage.
 *
 * The per-month Coverage flag (monthly setup) means a provider both NEEDS coverage
 * when out and CAN provide it when in. For each out provider flagged for coverage,
 * designate an in-office coverage provider for their patients (one coverer may
 * cover several absent providers; coverers keep their own patients too).
 *
 * Even distribution ACROSS THE MONTH: assign each new coverage to the eligible
 * coverer with the lowest running monthly count, tie-broken by provider rank.
 * `monthlyCount` is mutated and is NOT reset between days.
 */
export function assignCoverage(
  day: DayMap,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern>,
  monthlyCount: Record<string, number>,
): void {
  const hasCoverage = (id: string) => patternsByStaff.get(id)?.coverage ?? false;
  const rank = (id: string) => patternsByStaff.get(id)?.providerRank ?? Number.MAX_SAFE_INTEGER;

  const providers = staff.filter((s) => s.role === 'provider');

  const outNeedingCoverage = providers
    .filter((p) => hasCoverage(p.id) && !isWorking(day, p.id))
    .sort((a, b) => rank(a.id) - rank(b.id));

  const coverers = providers.filter((p) => hasCoverage(p.id) && isWorking(day, p.id));

  for (const out of outNeedingCoverage) {
    if (coverers.length === 0) continue; // -> warning computed later

    let best = coverers[0];
    for (const c of coverers) {
      const cCount = monthlyCount[c.id] ?? 0;
      const bestCount = monthlyCount[best.id] ?? 0;
      if (cCount < bestCount || (cCount === bestCount && rank(c.id) < rank(best.id))) {
        best = c;
      }
    }

    const assignment = day.get(best.id);
    if (assignment) assignment.providerCoverageIds.push(out.id);
    monthlyCount[best.id] = (monthlyCount[best.id] ?? 0) + 1;
  }
}
