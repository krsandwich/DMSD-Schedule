import { format, getDay } from 'date-fns';
import { generateDayAssignments, monthWeekInterval, patternsByStaffMap, weekBlockFor } from './generateMonth';
import type { Assignment, MonthlyPattern, Staff } from './types';

/**
 * Generate a single date's staffing, in isolation from the rest of the month.
 * Used when a holiday is un-marked in Monthly Setup: that one day needs
 * filling in without touching (or re-simulating) every other day.
 *
 * `patterns` should be the SAME month's patterns the date is being viewed
 * under (`viewMonth`) — that single set governs `viewMonth`'s entire
 * displayed range, including trailing spillover dates, so `date` doesn't need
 * to fall within `viewMonth`'s own calendar month.
 *
 * Coverage's "even distribution" uses a fresh running count for this call
 * only, since it doesn't have the rest of the month's real coverage
 * assignments to weigh against — a documented, minor limitation for the rare
 * case a provider needs coverage on a day that was, until a moment ago, a
 * holiday.
 */
export function generateSingleDay(
  date: Date,
  viewMonth: Date,
  staff: Staff[],
  patterns: MonthlyPattern[],
): Assignment[] {
  const weekday = getDay(date); // 0 = Sun .. 6 = Sat
  if (weekday === 0 || weekday === 6) return []; // Mon–Fri only

  const interval = monthWeekInterval(viewMonth);
  const weekBlock = weekBlockFor(date, interval.start);
  const patternsByStaff = patternsByStaffMap(patterns);

  const isoDate = format(date, 'yyyy-MM-dd');
  const { assignments } = generateDayAssignments(isoDate, weekday, weekBlock, staff, patternsByStaff, {});
  return assignments;
}
