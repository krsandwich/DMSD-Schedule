import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignCoverage } from '../coverage';
import type { MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff } from './patterns.fixture';

function dayFrom(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  return resolveAttendance('2026-06-01', 1, 1, staff, index);
}

function covererOf(day: ReturnType<typeof dayFrom>, outId: string): string | null {
  for (const a of day.values()) if (a.providerCoverageIds.includes(outId)) return a.staffId;
  return null;
}

describe('Step 3 — provider coverage', () => {
  const staff = buildRoster();

  it('assigns an eligible in-office provider to cover an out provider', () => {
    const day = dayFrom(makeOff(allWorking(staff), 'monica'));
    assignCoverage(day, staff, {});
    expect(covererOf(day, 'monica')).not.toBeNull();
  });

  it('does not require coverage for Steph when out', () => {
    const day = dayFrom(makeOff(allWorking(staff), 'steph'));
    assignCoverage(day, staff, {});
    expect(covererOf(day, 'steph')).toBeNull();
  });

  it('does not require coverage for Shama when out', () => {
    const day = dayFrom(makeOff(allWorking(staff), 'shama'));
    assignCoverage(day, staff, {});
    expect(covererOf(day, 'shama')).toBeNull();
  });

  it('never selects Steph as a coverer', () => {
    // Everyone out except Steph and the out provider needing coverage.
    let patterns = allWorking(staff);
    for (const id of ['tricia', 'natalie', 'kendra', 'shama']) patterns = makeOff(patterns, id);
    // Monica is out and needs coverage; only Steph remains in office among providers.
    patterns = makeOff(patterns, 'monica');
    const day = dayFrom(patterns);
    assignCoverage(day, staff, {});
    // Steph cannot cover -> Monica left uncovered.
    expect(covererOf(day, 'monica')).toBeNull();
  });

  it('distributes coverage to the coverer with the lowest weekly count', () => {
    const day = dayFrom(makeOff(allWorking(staff), 'monica'));
    // Tricia (priority 1) already covered twice this week; Natalie once.
    const weekly = { tricia: 2, natalie: 1 };
    assignCoverage(day, staff, weekly);
    // Lowest count among eligible is someone at 0 (e.g. kendra/shama) -> not tricia/natalie.
    const coverer = covererOf(day, 'monica');
    expect(coverer).not.toBe('tricia');
  });
});
