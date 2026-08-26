import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  getMonth,
  getYear,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

/** First-of-month ISO key, e.g. "2026-06-01". */
export function monthKey(d: Date): string {
  return format(startOfMonth(d), 'yyyy-MM-dd');
}

export function monthLabel(d: Date): string {
  return format(d, 'MMMM yyyy');
}

export function previousMonth(d: Date): Date {
  return subMonths(d, 1);
}

export function nextMonth(d: Date): Date {
  return addMonths(d, 1);
}

/**
 * The month rendered as whole Mon–Fri weeks. A week belongs to the month that
 * contains its Monday, so a month spans from its first Monday through the Friday
 * of the week containing its last Monday — e.g. June 2026 = Jun 1 → Jul 3, and
 * July 2026 = Jul 6 → Jul 31. Adjacent months never overlap and leave no gap.
 */
export function monthWeekRange(d: Date): { start: Date; end: Date } {
  let start = startOfMonth(d);
  while (getDay(start) !== 1) start = addDays(start, 1); // first Monday in the month
  let lastMonday = endOfMonth(d);
  while (getDay(lastMonday) !== 1) lastMonday = subDays(lastMonday, 1); // last Monday in the month
  return { start, end: addDays(lastMonday, 4) }; // through that week's Friday
}

/** ISO date range [first, last] of the month's full weeks, inclusive. */
export function monthRange(d: Date): { start: string; end: string } {
  const { start, end } = monthWeekRange(d);
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
}

/** First-of-month ISO key for the calendar month that a date falls in. */
export function monthKeyOf(d: Date): string {
  return format(startOfMonth(d), 'yyyy-MM-dd');
}

/** True when two dates are in the same calendar month + year. */
export function sameCalendarMonth(a: Date, b: Date): boolean {
  return getMonth(a) === getMonth(b) && getYear(a) === getYear(b);
}

/** Map day-of-month numbers to ISO dates within a calendar month, e.g. [1,4] → ["2026-06-01","2026-06-04"]. */
export function daysToIso(month: Date, days: number[]): string[] {
  return days.map((d) => format(new Date(getYear(month), getMonth(month), d), 'yyyy-MM-dd'));
}

/** Weekday dates (Mon–Fri) of the month's full weeks, grouped into week rows. */
export function weekdayRows(d: Date): Date[][] {
  const { start, end } = monthWeekRange(d);
  const days = eachDayOfInterval({ start, end }).filter((day) => {
    const dow = getDay(day);
    return dow >= 1 && dow <= 5;
  });

  const rows: Date[][] = [];
  let current: Date[] = [];
  let lastDow = 0;
  for (const day of days) {
    const dow = getDay(day);
    if (current.length && dow <= lastDow) {
      rows.push(current);
      current = [];
    }
    current.push(day);
    lastDow = dow;
  }
  if (current.length) rows.push(current);
  return rows;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function isoOf(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseIso(s: string): Date {
  return parseISO(s);
}

/**
 * Parse a `?month=` URL param into a Date, or null if it's missing or not a
 * real calendar date. Guards against a malformed/out-of-range URL crashing
 * the app — e.g. "banana" (unparseable) or "2026-13-01", which JS Date's
 * default overflow behavior would otherwise silently roll into Feb 2027
 * instead of being rejected.
 */
export function parseMonthParam(param: string | null | undefined): Date | null {
  if (!param) return null;
  const m = param.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(year, month - 1, day);
  if (getMonth(candidate) !== month - 1 || getDate(candidate) !== day) return null;
  return candidate;
}
