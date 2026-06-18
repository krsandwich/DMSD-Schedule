import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { daysToIso, monthRange, weekdayRows } from './dates';

describe('monthRange — whole Mon–Fri weeks', () => {
  it('June 2026 spans Jun 1 → Jul 3', () => {
    expect(monthRange(parseISO('2026-06-01'))).toEqual({ start: '2026-06-01', end: '2026-07-03' });
  });

  it('July 2026 spans Jul 6 → Jul 31 (no overlap with June, no gap)', () => {
    expect(monthRange(parseISO('2026-07-15'))).toEqual({ start: '2026-07-06', end: '2026-07-31' });
  });
});

describe('weekdayRows', () => {
  it('groups June 2026 into full 5-day weeks', () => {
    const rows = weekdayRows(parseISO('2026-06-01'));
    expect(rows.every((r) => r.length === 5)).toBe(true);
    expect(rows[0][0].getDate()).toBe(1); // first Monday
    expect(rows.at(-1)!.at(-1)!.getMonth()).toBe(6); // last day is in July (month index 6)
  });
});

describe('daysToIso', () => {
  it('maps day-of-month numbers to ISO dates', () => {
    expect(daysToIso(parseISO('2026-06-10'), [1, 4, 5])).toEqual([
      '2026-06-01',
      '2026-06-04',
      '2026-06-05',
    ]);
  });
});
