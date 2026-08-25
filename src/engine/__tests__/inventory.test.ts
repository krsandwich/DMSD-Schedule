import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { isLastWeekdayOfMonth, assignInventory } from '../inventory';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import { computeWarnings } from '../warnings';
import { generateMonth } from '../generateMonth';
import { buildRoster } from './roster.fixture';
import { allWorking, patch } from './patterns.fixture';
import type { DayMap, MonthlyPattern, Staff } from '../types';

describe('isLastWeekdayOfMonth', () => {
  it('is true for June 30, 2026 — a Tuesday that is also the actual last day of June', () => {
    expect(isLastWeekdayOfMonth(parseISO('2026-06-30'))).toBe(true);
  });

  it('is false for other June dates, including the day before', () => {
    expect(isLastWeekdayOfMonth(parseISO('2026-06-01'))).toBe(false);
    expect(isLastWeekdayOfMonth(parseISO('2026-06-29'))).toBe(false);
  });

  it('walks back over a weekend when the month ends on a Saturday', () => {
    // October 31, 2026 is a Saturday; the last weekday is Friday the 30th.
    expect(isLastWeekdayOfMonth(parseISO('2026-10-30'))).toBe(true);
    expect(isLastWeekdayOfMonth(parseISO('2026-10-31'))).toBe(false);
  });
});

const staff = buildRoster();
const INV_DAY = '2026-06-30'; // Tuesday, June's actual last day

function buildDay(overrides: Record<string, Partial<MonthlyPattern>> = {}): { day: DayMap; staff: Staff[] } {
  let patterns = allWorking(staff); // everyone at kona by default
  for (const [id, changes] of Object.entries(overrides)) patterns = patch(patterns, id, changes);
  const patternsByStaff = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance(INV_DAY, 30, 2, staff, patternsByStaff);
  assignMod(day, staff, patternsByStaff);
  return { day, staff };
}

function roleOf(staffList: Staff[], id: string): string | undefined {
  return staffList.find((s) => s.id === id)?.role;
}

describe('assignInventory', () => {
  it('assigns exactly one MA and one PCC-tier person per location that has eligible candidates', () => {
    // Move a few people to Waimea so both locations have candidates.
    const { day, staff: roster } = buildDay({
      huaka: { locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' } },
      wendy: { locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' } },
    });
    assignInventory(day, roster);

    for (const location of ['kona', 'waimea'] as const) {
      const invAtLoc = [...day.values()].filter((a) => a.isInventory && a.location === location);
      const mas = invAtLoc.filter((a) => roleOf(roster, a.staffId) === 'ma');
      const pccTier = invAtLoc.filter((a) =>
        ['pcc', 'aesthetic_concierge', 'manager'].includes(roleOf(roster, a.staffId) ?? ''),
      );
      expect(mas, `${location} MA count`).toHaveLength(1);
      expect(pccTier, `${location} PCC-tier count`).toHaveLength(1);
    }
  });

  it('prefers Aesthetic Concierge over PCC over Manager for the PCC-tier slot', () => {
    const { day, staff: roster } = buildDay(); // raella/maile (concierge) + wendy etc (pcc) all at kona
    assignInventory(day, roster, () => 0);
    const chosen = [...day.values()].find(
      (a) => a.isInventory && roleOf(roster, a.staffId) !== 'ma',
    );
    expect(roleOf(roster, chosen!.staffId)).toBe('aesthetic_concierge');
  });

  it('falls back to PCC when no Aesthetic Concierge is working that location', () => {
    const { day, staff: roster } = buildDay({
      raella: { usualWeekdays: [] },
      maile: { usualWeekdays: [] },
    });
    assignInventory(day, roster, () => 0);
    const chosen = [...day.values()].find(
      (a) => a.isInventory && roleOf(roster, a.staffId) !== 'ma',
    );
    expect(roleOf(roster, chosen!.staffId)).toBe('pcc');
  });

  it('falls back to Manager when no Aesthetic Concierge or PCC is available', () => {
    const { day, staff: roster } = buildDay({
      raella: { usualWeekdays: [] },
      maile: { usualWeekdays: [] },
      wendy: { usualWeekdays: [] },
      kalea: { usualWeekdays: [] },
      ellis: { usualWeekdays: [] },
      christie: { usualWeekdays: [] },
    });
    assignInventory(day, roster, () => 0);
    const chosen = [...day.values()].find(
      (a) => a.isInventory && roleOf(roster, a.staffId) !== 'ma',
    );
    expect(roleOf(roster, chosen!.staffId)).toBe('manager');
  });

  it('never picks the person who is MOD that day', () => {
    // Keahi (mod_rank 1) wins MOD in this fixture; a manager-tier pick must not be him.
    const { day, staff: roster } = buildDay({
      raella: { usualWeekdays: [] },
      maile: { usualWeekdays: [] },
      wendy: { usualWeekdays: [] },
      kalea: { usualWeekdays: [] },
      ellis: { usualWeekdays: [] },
      christie: { usualWeekdays: [] },
    });
    expect(day.get('keahi')?.isMod).toBe(true);
    assignInventory(day, roster, () => 0);
    expect(day.get('keahi')?.isInventory).toBe(false);
    // Sara (the only other working manager) gets it instead.
    expect(day.get('sara')?.isInventory).toBe(true);
  });

  it('does not re-pick (or double-assign) when someone at a location is already flagged', () => {
    const { day, staff: roster } = buildDay();
    day.get('sandra')!.isInventory = true; // pretend already locked/decided
    assignInventory(day, roster, () => 0);
    const invMAs = [...day.values()].filter(
      (a) => a.isInventory && roleOf(roster, a.staffId) === 'ma' && a.location === 'kona',
    );
    expect(invMAs).toHaveLength(1);
    expect(invMAs[0].staffId).toBe('sandra');
  });

  it('assigns nobody (without erroring) when no eligible candidates work a location', () => {
    const { day, staff: roster } = buildDay(); // nobody at Waimea in this fixture
    assignInventory(day, roster);
    const invAtWaimea = [...day.values()].filter((a) => a.isInventory && a.location === 'waimea');
    expect(invAtWaimea).toEqual([]);
  });
});

describe('computeWarnings — Inventory Day', () => {
  it('warns when a location has working MAs/PCC-tier staff but nobody flagged inventory', () => {
    const { day, staff: roster } = buildDay(); // everyone at kona, nobody assigned inventory
    const patterns = new Map(allWorking(roster).map((p) => [p.staffId, p]));
    const warnings = computeWarnings(INV_DAY, [...day.values()], roster, patterns);
    expect(warnings.some((w) => w.type === 'inventory_ma_missing' && w.refKey === 'kona')).toBe(true);
    expect(warnings.some((w) => w.type === 'inventory_pcc_missing' && w.refKey === 'kona')).toBe(true);
    // Nobody works Waimea in this fixture — nothing to warn about there.
    expect(warnings.some((w) => w.refKey === 'waimea')).toBe(false);
  });

  it('does not warn once inventory is assigned', () => {
    const { day, staff: roster } = buildDay();
    assignInventory(day, roster);
    const patterns = new Map(allWorking(roster).map((p) => [p.staffId, p]));
    const warnings = computeWarnings(INV_DAY, [...day.values()], roster, patterns);
    expect(warnings.some((w) => w.type.startsWith('inventory_'))).toBe(false);
  });

  it('does not warn on a day that is not the last weekday of the month', () => {
    const { day, staff: roster } = buildDay();
    const patterns = new Map(allWorking(roster).map((p) => [p.staffId, p]));
    const warnings = computeWarnings('2026-06-01', [...day.values()], roster, patterns);
    expect(warnings.some((w) => w.type.startsWith('inventory_'))).toBe(false);
  });
});

describe('generateMonth — Inventory Day integration', () => {
  it('assigns inventory only on the last weekday of the month, nowhere else', () => {
    const patterns = [...allWorking(staff), ...allWorking(staff, 'kona', '2026-07-01')];
    const { assignments, warnings } = generateMonth({ staff, patterns, month: parseISO('2026-06-01') });

    const invByDate = new Map<string, number>();
    for (const a of assignments.filter((x) => x.isInventory)) {
      invByDate.set(a.date, (invByDate.get(a.date) ?? 0) + 1);
    }
    expect([...invByDate.keys()]).toEqual([INV_DAY]);
    // One MA + one PCC-tier at Kona (everyone's at Kona in this fixture; nobody at Waimea).
    expect(invByDate.get(INV_DAY)).toBe(2);
    expect(warnings.filter((w) => w.type.startsWith('inventory_'))).toEqual([]);
  });
});
