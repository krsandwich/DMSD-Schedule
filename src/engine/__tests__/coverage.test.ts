import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignCoverage } from '../coverage';
import type { DayMap, MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff } from './patterns.fixture';

function setup(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
  return { day, index };
}

function covers(day: DayMap, covererId: string): string[] {
  return day.get(covererId)?.providerCoverageIds ?? [];
}

describe('Step 3 — provider coverage', () => {
  const staff = buildRoster();

  it('assigns an out coverage-flagged provider to an in-office coverer', () => {
    const { day, index } = setup(makeOff(allWorking(staff), 'monica')); // Monica (coverage) out
    assignCoverage(day, staff, index, {});
    const coveredBy = staff.find((s) => covers(day, s.id).includes('monica'));
    expect(coveredBy).toBeDefined();
    expect(index.get(coveredBy!.id)?.coverage).toBe(true);
    expect(coveredBy!.id).not.toBe('monica');
  });

  it('does not cover an out provider whose Coverage box is unchecked', () => {
    // Steph has no coverage flag in the fixture.
    const { day, index } = setup(makeOff(allWorking(staff), 'steph'));
    assignCoverage(day, staff, index, {});
    const anyCovers = staff.some((s) => covers(day, s.id).includes('steph'));
    expect(anyCovers).toBe(false);
  });

  it('leaves an out provider uncovered when no flagged coverer is in', () => {
    // Monica out and every other coverage-flagged provider out too.
    let patterns = allWorking(staff);
    for (const id of ['monica', 'tricia', 'natalie', 'kendra']) patterns = makeOff(patterns, id);
    const { day, index } = setup(patterns);
    assignCoverage(day, staff, index, {});
    const anyCovers = staff.some((s) => covers(day, s.id).includes('monica'));
    expect(anyCovers).toBe(false); // -> warning elsewhere
  });

  it('distributes coverage evenly via the running monthly count', () => {
    // Two out providers, both covered the same in-office coverer would be unbalanced;
    // with a shared count the second assignment goes to a different coverer.
    let patterns = allWorking(staff);
    patterns = makeOff(patterns, 'monica');
    patterns = makeOff(patterns, 'natalie');
    const { day, index } = setup(patterns);
    const count: Record<string, number> = {};
    assignCoverage(day, staff, index, count);
    // Tricia (rank 1) and Kendra (rank 5) are the in-office coverage providers.
    expect((count['tricia'] ?? 0) + (count['kendra'] ?? 0)).toBe(2);
    expect(count['tricia']).toBe(1);
    expect(count['kendra']).toBe(1);
  });

  it('carries the count across days so coverage balances over the month', () => {
    const { day: day1, index } = setup(makeOff(allWorking(staff), 'monica'));
    const count: Record<string, number> = {};
    assignCoverage(day1, staff, index, count);
    const first = staff.find((s) => covers(day1, s.id).includes('monica'))!.id;

    const day2 = resolveAttendance('2026-06-02', 2, 2, staff, index);
    // Re-mark Monica out on day 2 (same patterns, she's off all month here).
    assignCoverage(day2, staff, index, count);
    const second = staff.find((s) => covers(day2, s.id).includes('monica'))!.id;

    expect(first).not.toBe(second); // the day-1 coverer is now higher-count, so day 2 picks another
  });
});
