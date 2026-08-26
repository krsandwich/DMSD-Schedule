import { describe, expect, it } from 'vitest';
import { getDay, parseISO } from 'date-fns';
import { generateMonth } from '../generateMonth';
import { buildRoster } from './roster.fixture';
import { allWorking, patch } from './patterns.fixture';

describe('generateMonth — orchestration', () => {
  const staff = buildRoster();
  const month = parseISO('2026-06-01');
  // The view spans whole weeks (Jun 1 → Jul 3), but spillover days (Jul 1-3)
  // are governed by this SAME set of June patterns — no separate July row.
  const patterns = allWorking(staff);

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

  it('switches an alternating location every two weeks within the month', () => {
    // June 2026 view weeks (by Monday): Jun 1, 8, 15, 22, 29 → blocks 0,0,1,1,0.
    const june = patch(allWorking(staff, 'kona'), 'tricia', {
      locationByWeekday: { '1': 'alternating', '2': 'alternating', '3': 'alternating', '4': 'alternating', '5': 'alternating' },
    });
    const { assignments } = generateMonth({ staff, patterns: june, month });
    const loc = (date: string) =>
      assignments.find((a) => a.staffId === 'tricia' && a.date === date)?.location;
    expect(loc('2026-06-01')).toBe('kona'); // week 0 (block 0)
    expect(loc('2026-06-08')).toBe('kona'); // week 1 (block 0)
    expect(loc('2026-06-15')).toBe('waimea'); // week 2 (block 1)
    expect(loc('2026-06-22')).toBe('waimea'); // week 3 (block 1)
    expect(loc('2026-06-29')).toBe('kona'); // week 4 (block 0 again)
  });

  it('staffs spillover days from the current month\'s own patterns, with no next-month row at all', () => {
    // Regression: previously, trailing spillover days (Jul 1-3 here) needed a
    // SEPARATE next-month monthly_patterns row or they'd render everyone off.
    const { assignments } = generateMonth({ staff, patterns, month });
    const july1 = assignments.filter((a) => a.date === '2026-07-01');
    expect(july1.length).toBe(staff.length);
    expect(july1.some((a) => a.location !== 'off')).toBe(true);
    const tricia = july1.find((a) => a.staffId === 'tricia');
    expect(tricia?.location).toBe('kona');
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
