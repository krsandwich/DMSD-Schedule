import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import { assignMAs } from '../assignMAs';
import type { DayMap, MonthlyPattern } from '../types';
import { buildRoster, PROVIDER_IDS } from './roster.fixture';
import { allWorking, patch } from './patterns.fixture';

function dayFrom(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  return resolveAttendance('2026-06-01', 1, 1, staff, index);
}

function maCount(day: DayMap, providerId: string): number {
  let n = 0;
  for (const a of day.values()) if (a.assignedProviderId === providerId) n++;
  return n;
}

describe('Step 4 — assign MAs', () => {
  const staff = buildRoster();

  it('gives Tricia 2 MAs first', () => {
    const day = dayFrom(allWorking(staff));
    assignMod(day, staff);
    assignMAs(day, staff);
    expect(maCount(day, 'tricia')).toBe(2);
  });

  it('ensures every working provider has at least one MA (10 MAs, 6 providers)', () => {
    const day = dayFrom(allWorking(staff));
    assignMod(day, staff);
    assignMAs(day, staff);
    for (const id of PROVIDER_IDS) expect(maCount(day, id)).toBeGreaterThanOrEqual(1);
  });

  it('never assigns more than 2 MAs to a provider', () => {
    const day = dayFrom(allWorking(staff));
    assignMod(day, staff);
    assignMAs(day, staff);
    for (const id of PROVIDER_IDS) expect(maCount(day, id)).toBeLessThanOrEqual(2);
  });

  it('excludes the MOD from the MA pool', () => {
    const day = dayFrom(allWorking(staff));
    const modId = assignMod(day, staff); // keahi (in MA pool) becomes MOD
    assignMAs(day, staff);
    expect(day.get(modId!)?.assignedProviderId).toBeNull();
  });

  it('only assigns an MA to a provider at the same location', () => {
    // Tricia at waimea, all MAs at kona -> Tricia should get no MA.
    let patterns = allWorking(staff, 'kona');
    patterns = patch(patterns, 'tricia', {
      locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
    });
    const day = dayFrom(patterns);
    assignMod(day, staff);
    assignMAs(day, staff);
    for (const a of day.values()) {
      if (a.assignedProviderId) {
        const provider = day.get(a.assignedProviderId);
        expect(a.location).toBe(provider?.location);
      }
    }
    expect(maCount(day, 'tricia')).toBe(0);
  });

  it('assigns sequential MA slots (1, 2) under a provider', () => {
    const day = dayFrom(allWorking(staff));
    assignMod(day, staff);
    assignMAs(day, staff);
    const slots = [...day.values()]
      .filter((a) => a.assignedProviderId === 'tricia')
      .map((a) => a.maSlot)
      .sort();
    expect(slots).toEqual([1, 2]);
  });
});
