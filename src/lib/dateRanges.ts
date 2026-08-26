import { eachDayOfInterval, format, getDate, getMonth, getYear, parseISO } from 'date-fns';
import { sameCalendarMonth } from './dates';

/**
 * Resolve a 1-based month + day against a context month into a real Date, or
 * null if that calendar date doesn't exist (e.g. Feb 30, Apr 31). The year is
 * the context month's year, unless `month` precedes the context month's own
 * number — a month view only ever spills into the NEXT calendar month, so
 * that case means the date rolled into January of the following year.
 */
function resolveDate(month1to12: number, day: number, contextMonth: Date): Date | null {
  if (month1to12 < 1 || month1to12 > 12 || day < 1 || day > 31) return null;
  const contextMonth1to12 = getMonth(contextMonth) + 1;
  const year = month1to12 >= contextMonth1to12 ? getYear(contextMonth) : getYear(contextMonth) + 1;
  const candidate = new Date(year, month1to12 - 1, day);
  // JS Date silently rolls invalid day/month combos into the next month
  // (e.g. Feb 30 -> Mar 2) — reject anything that doesn't round-trip exactly,
  // so a nonexistent date is ignored rather than landing on the wrong day.
  if (getMonth(candidate) !== month1to12 - 1 || getDate(candidate) !== day) return null;
  return candidate;
}

/**
 * Parse one date token: "12/5" (explicit month/day) or "5" (bare — defaults
 * to `contextMonth`). Shared by the range parser below and by `parseReminders`
 * (Special Reminders' "day: text" lines use the same token grammar).
 */
export function resolveDateToken(token: string, contextMonth: Date): Date | null {
  const t = token.trim();
  const md = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) return resolveDate(Number(md[1]), Number(md[2]), contextMonth);
  const bare = t.match(/^(\d{1,2})$/);
  if (bare) return resolveDate(getMonth(contextMonth) + 1, Number(bare[1]), contextMonth);
  return null;
}

/**
 * Parse a human date-range string like "1-3, 8-11, 12/1-12/5" into a sorted,
 * de-duplicated array of ISO dates (yyyy-MM-dd). Bare numbers (no "/") default
 * to `contextMonth`; "M/D" reaches an explicit month, most commonly used to
 * target a trailing spillover date without leaving the current setup page.
 * Invalid tokens and nonexistent calendar dates (e.g. "2/30") are ignored.
 */
export function parseDateRanges(input: string, contextMonth: Date): string[] {
  const dates = new Set<string>();
  for (const rawToken of input.split(',')) {
    const token = rawToken.trim().replace(/–|—/g, '-');
    if (!token) continue;

    if (token.includes('-')) {
      const idx = token.indexOf('-');
      const start = resolveDateToken(token.slice(0, idx), contextMonth);
      const end = resolveDateToken(token.slice(idx + 1), contextMonth);
      if (!start || !end) continue;
      const [lo, hi] = start <= end ? [start, end] : [end, start];
      for (const d of eachDayOfInterval({ start: lo, end: hi })) dates.add(format(d, 'yyyy-MM-dd'));
      continue;
    }

    const single = resolveDateToken(token, contextMonth);
    if (single) dates.add(format(single, 'yyyy-MM-dd'));
  }
  return [...dates].sort();
}

function isNextDay(a: string, b: string): boolean {
  const d = parseISO(a);
  d.setDate(d.getDate() + 1);
  return format(d, 'yyyy-MM-dd') === b;
}

/**
 * Render ISO dates back into a compact range string, relative to `contextMonth`:
 * a run entirely inside `contextMonth` renders as bare day numbers ("1-3"); a
 * run that touches a different month renders both ends as "M/D" ("9/29-10/2")
 * to stay unambiguous.
 */
export function formatDateRanges(dates: string[], contextMonth: Date): string {
  const sorted = [...new Set(dates)].sort();
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && isNextDay(sorted[j], sorted[j + 1])) j++;
    const startIso = sorted[i];
    const endIso = sorted[j];
    const spansOtherMonth =
      !sameCalendarMonth(parseISO(startIso), contextMonth) || !sameCalendarMonth(parseISO(endIso), contextMonth);
    const label = (iso: string) => {
      const d = parseISO(iso);
      return spansOtherMonth ? `${getMonth(d) + 1}/${getDate(d)}` : `${getDate(d)}`;
    };
    parts.push(i === j ? label(startIso) : `${label(startIso)}-${label(endIso)}`);
    i = j + 1;
  }
  return parts.join(', ');
}
