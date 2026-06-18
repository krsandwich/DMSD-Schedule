import { useMemo } from 'react';
import { computeWarnings } from '@/engine';
import type { Assignment, MonthlyPattern, Staff, Warning } from '@/engine/types';
import { warningKey } from './useDismissedWarnings';

/**
 * Live warnings for a month, recomputed from current assignments + roster and
 * filtered by persisted dismissals. Grouped by ISO date for the calendar.
 */
export function useMonthWarnings(
  assignments: Assignment[],
  staff: Staff[],
  dismissed: Set<string>,
  patternsByStaff: Map<string, MonthlyPattern>,
): Map<string, Warning[]> {
  return useMemo(() => {
    const byDate = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = byDate.get(a.date) ?? [];
      list.push(a);
      byDate.set(a.date, list);
    }

    const result = new Map<string, Warning[]>();
    for (const [date, dayAssignments] of byDate) {
      const active = computeWarnings(date, dayAssignments, staff, patternsByStaff).filter(
        (w) => !dismissed.has(warningKey(w)),
      );
      if (active.length) result.set(date, active);
    }
    return result;
  }, [assignments, staff, dismissed, patternsByStaff]);
}
