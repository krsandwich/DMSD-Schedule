import { describe, expect, it } from 'vitest';
import { resolveAttendance, isWorking } from '../attendance';
import type { MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, patch } from './patterns.fixture';

function index(patterns: MonthlyPattern[]) {
  return new Map(patterns.map((p) => [p.staffId, p]));
}

describe('Step 1 — attendance & locations', () => {
  const staff = buildRoster();

  it('places a working person at their weekday location', () => {
    const patterns = allWorking(staff, 'waimea');
    const day = resolveAttendance('2026-06-01', 1, 1, staff, index(patterns));
    expect(day.get('tricia')?.location).toBe('waimea');
    expect(isWorking(day, 'tricia')).toBe(true);
  });

  it('marks a person off when the day-of-month is requested off', () => {
    const patterns = patch(allWorking(staff), 'tricia', { requestedOffDays: [1] });
    const day = resolveAttendance('2026-06-01', 1, 1, staff, index(patterns));
    expect(day.get('tricia')?.location).toBe('off');
    expect(isWorking(day, 'tricia')).toBe(false);
  });

  it('marks a person off when the weekday is not a usual weekday', () => {
    const patterns = patch(allWorking(staff), 'tricia', { usualWeekdays: [2, 3, 4, 5] });
    const day = resolveAttendance('2026-06-01', 1, 1, staff, index(patterns)); // Monday
    expect(isWorking(day, 'tricia')).toBe(false);
  });

  it('renders off (not absent) when a person has no pattern', () => {
    const patterns = allWorking(staff).filter((p) => p.staffId !== 'tricia');
    const day = resolveAttendance('2026-06-01', 1, 1, staff, index(patterns));
    expect(day.get('tricia')?.location).toBe('off');
  });

  it("resolves an 'alternating' weekday to Kona or Waimea by week parity", () => {
    const patterns = patch(allWorking(staff), 'tricia', {
      usualWeekdays: [1],
      locationByWeekday: { '1': 'alternating' },
    });
    const even = resolveAttendance('2026-06-01', 1, 1, staff, index(patterns), 0);
    expect(even.get('tricia')?.location).toBe('kona');
    const odd = resolveAttendance('2026-06-01', 1, 1, staff, index(patterns), 1);
    expect(odd.get('tricia')?.location).toBe('waimea');
  });

  it('excludes inactive staff entirely', () => {
    const roster = buildRoster().map((s) => (s.id === 'tricia' ? { ...s, active: false } : s));
    const day = resolveAttendance('2026-06-01', 1, 1, roster, index(allWorking(roster)));
    expect(day.has('tricia')).toBe(false);
  });
});
