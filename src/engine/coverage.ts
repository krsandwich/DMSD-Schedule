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
 * A coverer covers only ONE absent provider per day unless there are more
 * absentees than available coverers — so each working coverer takes a first
 * absentee before anyone is stacked with a second. Selection order:
 *   1. fewest providers covered TODAY (spread it out — "one at a time"),
 *   2. then lowest running MONTHLY count (even distribution across the month),
 *   3. then provider rank.
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

  // How many absent providers each coverer is already covering on THIS day.
  const todayCount: Record<string, number> = {};

  for (const out of outNeedingCoverage) {
    if (coverers.length === 0) continue; // -> warning computed later

    let best = coverers[0];
    for (const c of coverers) {
      const cToday = todayCount[c.id] ?? 0;
      const bestToday = todayCount[best.id] ?? 0;
      if (cToday !== bestToday) {
        if (cToday < bestToday) best = c;
        continue;
      }
      const cMonth = monthlyCount[c.id] ?? 0;
      const bestMonth = monthlyCount[best.id] ?? 0;
      if (cMonth < bestMonth || (cMonth === bestMonth && rank(c.id) < rank(best.id))) {
        best = c;
      }
    }

    const assignment = day.get(best.id);
    if (assignment) assignment.providerCoverageIds.push(out.id);
    todayCount[best.id] = (todayCount[best.id] ?? 0) + 1;
    monthlyCount[best.id] = (monthlyCount[best.id] ?? 0) + 1;
  }
}
