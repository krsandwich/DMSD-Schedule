import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { generateSingleDay } from '../generateSingleDay';
import { generateMonth } from '../generateMonth';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff } from './patterns.fixture';

const staff = buildRoster();
const patterns = allWorking(staff);

describe('generateSingleDay', () => {
  it('matches the corresponding day from a full generateMonth call', () => {
    const day = parseISO('2026-06-03'); // Wednesday
    const solo = generateSingleDay(day, day, staff, patterns)
      .map((a) => ({ staffId: a.staffId, location: a.location, assignedProviderId: a.assignedProviderId }))
      .sort((a, b) => a.staffId.localeCompare(b.staffId));

    const { assignments: full } = generateMonth({ staff, patterns, month: day });
    const fromFull = full
      .filter((a) => a.date === '2026-06-03')
      .map((a) => ({ staffId: a.staffId, location: a.location, assignedProviderId: a.assignedProviderId }))
      .sort((a, b) => a.staffId.localeCompare(b.staffId));

    expect(solo).toEqual(fromFull);
  });

  it('returns an empty array for a weekend date', () => {
    const saturday = parseISO('2026-06-06');
    expect(generateSingleDay(saturday, saturday, staff, patterns)).toEqual([]);
  });

  it('returns off/no rows for staff with no working pattern that day', () => {
    const day = parseISO('2026-06-03');
    const patternsWithOff = makeOff(patterns, 'tricia');
    const result = generateSingleDay(day, day, staff, patternsWithOff);
    const tricia = result.find((a) => a.staffId === 'tricia');
    expect(tricia?.location).toBe('off');
  });

  it('resolves a spillover date (outside viewMonth\'s own calendar month) against the SAME patterns', () => {
    // July 1 2026 (Wed) spills into June's view. patternsFor June should still
    // govern it — the whole point of the "one row governs its own spillover
    // days" redesign.
    const viewMonth = parseISO('2026-06-01');
    const july1 = parseISO('2026-07-01');
    const result = generateSingleDay(july1, viewMonth, staff, patterns);
    const tricia = result.find((a) => a.staffId === 'tricia');
    expect(tricia?.location).toBe('kona');
  });
});
