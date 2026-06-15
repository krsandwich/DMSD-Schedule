import type { Location, MonthlyPattern, Staff } from '../types';

const MONTH = '2026-06-01';

/** Everyone works Mon–Fri at the given location, no time off. */
export function allWorking(staff: Staff[], location: Location = 'kona'): MonthlyPattern[] {
  return staff.map((s) => ({
    staffId: s.id,
    month: MONTH,
    usualWeekdays: [1, 2, 3, 4, 5],
    locationByWeekday: { '1': location, '2': location, '3': location, '4': location, '5': location },
    requestedOffDays: [],
  }));
}

/** Mutate one person's pattern in a list. */
export function patch(
  patterns: MonthlyPattern[],
  staffId: string,
  changes: Partial<MonthlyPattern>,
): MonthlyPattern[] {
  return patterns.map((p) => (p.staffId === staffId ? { ...p, ...changes } : p));
}

/** Make a person off entirely (no usual weekdays). */
export function makeOff(patterns: MonthlyPattern[], staffId: string): MonthlyPattern[] {
  return patch(patterns, staffId, { usualWeekdays: [] });
}
