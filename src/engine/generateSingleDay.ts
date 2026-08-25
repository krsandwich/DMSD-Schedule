import { differenceInCalendarDays, format, getDate, getDay, startOfMonth } from 'date-fns';
import { generateDayAssignments, indexPatternsByMonth, monthWeekInterval } from './generateMonth';
import type { Assignment, MonthlyPattern, Staff } from './types';

/**
 * Generate a single date's staffing, in isolation from the rest of the month.
 * Used when a holiday is un-marked in Monthly Setup: that one day needs
 * filling in without touching (or re-simulating) every other day.
 *
 * The date must fall within `month`'s own calendar month (holidays are
 * month-bound, never spillover) — patterns are looked up accordingly.
 *
 * Coverage's "even distribution" uses a fresh running count for this call
 * only, since it doesn't have the rest of the month's real coverage
 * assignments to weigh against — a documented, minor limitation for the rare
 * case a provider needs coverage on a day that was, until a moment ago, a
 * holiday.
 */
export function generateSingleDay(date: Date, staff: Staff[], patterns: MonthlyPattern[]): Assignment[] {
  const weekday = getDay(date); // 0 = Sun .. 6 = Sat
  if (weekday === 0 || weekday === 6) return []; // Mon–Fri only

  const interval = monthWeekInterval(date);
  const weekIndex = Math.floor(differenceInCalendarDays(date, interval.start) / 7);
  const weekBlock = (Math.floor(weekIndex / 2) % 2) as 0 | 1;

  const patternsByMonth = indexPatternsByMonth(patterns);
  const monthKey = format(startOfMonth(date), 'yyyy-MM-dd');
  const patternsByStaff = patternsByMonth.get(monthKey) ?? new Map<string, MonthlyPattern>();

  const isoDate = format(date, 'yyyy-MM-dd');
  const { assignments } = generateDayAssignments(
    isoDate,
    getDate(date),
    weekday,
    weekBlock,
    staff,
    patternsByStaff,
    {},
  );
  return assignments;
}
