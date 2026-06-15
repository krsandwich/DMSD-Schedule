/**
 * Parse a human range string like "1-3, 8-11, 15" into a sorted, de-duplicated
 * array of day-of-month integers. Tolerates extra whitespace and en-dashes.
 * Invalid tokens are ignored.
 */
export function parseDayRanges(input: string): number[] {
  const days = new Set<number>();
  for (const rawToken of input.split(',')) {
    const token = rawToken.trim().replace(/–|—/g, '-');
    if (!token) continue;

    const rangeMatch = token.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let d = lo; d <= hi; d++) addDay(days, d);
      continue;
    }

    const single = token.match(/^\d{1,2}$/);
    if (single) addDay(days, Number(token));
  }
  return [...days].sort((a, b) => a - b);
}

/** Render an int[] of days back into a compact range string like "1-3, 8". */
export function formatDayRanges(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

function addDay(set: Set<number>, d: number) {
  if (d >= 1 && d <= 31) set.add(d);
}
