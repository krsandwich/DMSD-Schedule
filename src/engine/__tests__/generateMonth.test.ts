import { describe, expect, it } from 'vitest';
import { getDay, parseISO } from 'date-fns';
import { generateMonth } from '../generateMonth';
import { buildRoster } from './roster.fixture';
import { allWorking } from './patterns.fixture';

describe('generateMonth — orchestration', () => {
  const staff = buildRoster();
  const month = parseISO('2026-06-01');
  // The view spans whole weeks (Jun 1 → Jul 3), so include July's patterns too.
  const patterns = [...allWorking(staff), ...allWorking(staff, 'kona', '2026-07-01')];

  it('only generates assignments for weekdays (Mon–Fri)', () => {
    const { assignments } = generateMonth({ staff, patterns, month });
    for (const a of assignments) {
      const dow = getDay(parseISO(a.date));
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it('produces one assignment per active staff per weekday across the full weeks', () => {
    const { assignments } = generateMonth({ staff, patterns, month });
    const dates = new Set(assignments.map((a) => a.date));
    // June 2026 full weeks = Jun 1 → Jul 3: 22 June weekdays + Jul 1,2,3 = 25.
    expect(dates.size).toBe(25);
    expect([...dates].sort()[0]).toBe('2026-06-01');
    expect([...dates].sort().at(-1)).toBe('2026-07-03');
    for (const date of dates) {
      const count = assignments.filter((a) => a.date === date).length;
      expect(count).toBe(staff.length);
    }
  });

  it('designates exactly one MOD per generated day', () => {
    const { assignments } = generateMonth({ staff, patterns, month });
    const dates = new Set(assignments.map((a) => a.date));
    for (const date of dates) {
      const mods = assignments.filter((a) => a.date === date && a.isMod);
      expect(mods.length).toBe(1);
    }
  });

  it('generates a clean fully-staffed month with no warnings', () => {
    const { warnings } = generateMonth({ staff, patterns, month });
    expect(warnings).toEqual([]);
  });

  it('skips holidays entirely — no assignments, no warnings', () => {
    const holidays = new Set(['2026-06-01', '2026-07-03']); // a Monday and a spillover Friday
    const { assignments, warnings } = generateMonth({ staff, patterns, month, holidays });
    const dates = new Set(assignments.map((a) => a.date));
    expect(dates.has('2026-06-01')).toBe(false);
    expect(dates.has('2026-07-03')).toBe(false);
    expect(warnings.filter((w) => w.date === '2026-06-01' || w.date === '2026-07-03')).toEqual([]);
  });
});
