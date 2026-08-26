import { useMemo } from 'react';
import { getDay, parseISO } from 'date-fns';
import { computeWarnings, monthWeekInterval, resolveAttendance, weekBlockFor } from '@/engine';
import type { Assignment, MonthlyPattern, Staff, Warning } from '@/engine/types';
import { warningKey } from './useDismissedWarnings';

/**
 * Live warnings for a month, recomputed from current assignments + roster and
 * filtered by persisted dismissals. Grouped by ISO date for the calendar.
 *
 * `month` is the viewed month, used to freshly resolve each date's expected
 * attendance from CURRENT patterns (see `pattern_out_of_sync` in warnings.ts)
 * — this is what detects a persisted schedule that's gone stale relative to a
 * pattern edit made after the month was generated.
 */
export function useMonthWarnings(
  assignments: Assignment[],
  staff: Staff[],
  dismissed: Set<string>,
  patternsByStaff: Map<string, MonthlyPattern>,
  month: Date,
): Map<string, Warning[]> {
  return useMemo(() => {
    const byDate = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = byDate.get(a.date) ?? [];
      list.push(a);
      byDate.set(a.date, list);
    }

    const viewStart = monthWeekInterval(month).start;
    const result = new Map<string, Warning[]>();
    for (const [date, dayAssignments] of byDate) {
      const d = parseISO(date);
      const weekBlock = weekBlockFor(d, viewStart);
      const expectedDay = resolveAttendance(date, getDay(d), staff, patternsByStaff, weekBlock);
      const active = computeWarnings(date, dayAssignments, staff, patternsByStaff, expectedDay).filter(
        (w) => !dismissed.has(warningKey(w)),
      );
      if (active.length) result.set(date, active);
    }
    return result;
  }, [assignments, staff, dismissed, patternsByStaff, month]);
}
