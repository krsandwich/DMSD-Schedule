import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
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

/** ISO date range [first, last] of the month, inclusive. */
export function monthRange(d: Date): { start: string; end: string } {
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
  };
}

/** Weekday dates (Mon–Fri) of the month, grouped into week rows. */
export function weekdayRows(d: Date): Date[][] {
  const days = eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) }).filter((day) => {
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
