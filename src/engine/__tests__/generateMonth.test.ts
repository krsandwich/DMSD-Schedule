import { describe, expect, it } from 'vitest';
import { getDay, parseISO } from 'date-fns';
import { generateMonth } from '../generateMonth';
import { buildRoster } from './roster.fixture';
import { allWorking } from './patterns.fixture';

describe('generateMonth — orchestration', () => {
  const staff = buildRoster();
  const month = parseISO('2026-06-01');

  it('only generates assignments for weekdays (Mon–Fri)', () => {
    const { assignments } = generateMonth({ staff, patterns: allWorking(staff), month });
    for (const a of assignments) {
      const dow = getDay(parseISO(a.date));
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it('produces one assignment per active staff per weekday', () => {
    const { assignments } = generateMonth({ staff, patterns: allWorking(staff), month });
    const dates = new Set(assignments.map((a) => a.date));
    // June 2026 has 22 weekdays.
    expect(dates.size).toBe(22);
    for (const date of dates) {
      const count = assignments.filter((a) => a.date === date).length;
      expect(count).toBe(staff.length);
    }
  });

  it('designates exactly one MOD per generated day', () => {
    const { assignments } = generateMonth({ staff, patterns: allWorking(staff), month });
    const dates = new Set(assignments.map((a) => a.date));
    for (const date of dates) {
      const mods = assignments.filter((a) => a.date === date && a.isMod);
      expect(mods.length).toBe(1);
    }
  });

  it('generates a clean fully-staffed month with no warnings', () => {
    const { warnings } = generateMonth({ staff, patterns: allWorking(staff), month });
    expect(warnings).toEqual([]);
  });
});
