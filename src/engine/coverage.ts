import { isWorking } from './attendance';
import type { DayMap, Staff } from './types';

/**
 * Step 3 — Provider coverage.
 *
 * For each provider who is OUT and needs coverage (all providers except Steph &
 * Shama), designate an in-office provider to cover their patients. Eligible
 * coverers are any in-office provider that `canCoverProviders` (any provider
 * except Steph; Shama may cover). One coverer may cover multiple absent providers.
 *
 * Even distribution: assign new coverage to the eligible coverer with the lowest
 * weekly coverage count, tie-broken by provider priority. `weeklyCount` is mutated
 * and is expected to be reset every Monday by the caller.
 */
export function assignCoverage(
  day: DayMap,
  staff: Staff[],
  weeklyCount: Record<string, number>,
): void {
  const providers = staff.filter((s) => s.role === 'provider');

  const outNeedingCoverage = providers
    .filter((p) => p.needsCoverageWhenOut && !isWorking(day, p.id))
    // Stable order so assignment is deterministic.
    .sort((a, b) => priority(a) - priority(b));

  const coverers = providers.filter((p) => p.canCoverProviders && isWorking(day, p.id));

  for (const out of outNeedingCoverage) {
    if (coverers.length === 0) continue; // -> warning computed later

    let best = coverers[0];
    for (const c of coverers) {
      const cCount = weeklyCount[c.id] ?? 0;
      const bestCount = weeklyCount[best.id] ?? 0;
      if (cCount < bestCount || (cCount === bestCount && priority(c) < priority(best))) {
        best = c;
      }
    }

    const assignment = day.get(best.id);
    if (assignment) assignment.providerCoverageIds.push(out.id);
    weeklyCount[best.id] = (weeklyCount[best.id] ?? 0) + 1;
  }
}

function priority(p: Staff): number {
  return p.priorityRank ?? Number.MAX_SAFE_INTEGER;
}
