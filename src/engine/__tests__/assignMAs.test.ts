import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import { assignMAs } from '../assignMAs';
import type { DayMap, MonthlyPattern } from '../types';
import { buildRoster, PROVIDER_IDS } from './roster.fixture';
import { allWorking, patch } from './patterns.fixture';

function setup(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
  return { day, index, staff };
}

function maCount(day: DayMap, providerId: string): number {
  let n = 0;
  for (const a of day.values()) if (a.assignedProviderId === providerId) n++;
  return n;
}

describe('Step 4 — assign MAs', () => {
  const staff = buildRoster();

  it('gives Tricia 2 MAs first', () => {
    const { day, index } = setup(allWorking(staff));
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    expect(maCount(day, 'tricia')).toBe(2);
  });

  it('fills any provider flagged "2 MAs" to two first', () => {
    // Flag Monica (priority 3) for 2 MAs; default fixture only flags Tricia.
    const patterns = patch(allWorking(staff), 'monica', { wantsTwoMas: true });
    const { day, index } = setup(patterns);
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    expect(maCount(day, 'monica')).toBe(2);
  });

  it('ensures every working provider has at least one MA (10 MAs, 6 providers)', () => {
    const { day, index } = setup(allWorking(staff));
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    for (const id of PROVIDER_IDS) expect(maCount(day, id)).toBeGreaterThanOrEqual(1);
  });

  it('never assigns more than 2 MAs to a provider', () => {
    const { day, index } = setup(allWorking(staff));
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    for (const id of PROVIDER_IDS) expect(maCount(day, id)).toBeLessThanOrEqual(2);
  });

  it('excludes the MOD from the MA pool', () => {
    // Force an MA (Reina) to be MOD so she is pulled out of the pool.
    const patterns = patch(allWorking(staff), 'reina', { modRank: 0 });
    const { day, index } = setup(patterns);
    const modId = assignMod(day, staff, index);
    expect(modId).toBe('reina');
    assignMAs(day, staff, index);
    expect(day.get('reina')?.assignedProviderId).toBeNull();
  });

  it('only assigns an MA to a provider at the same location', () => {
    // Tricia at waimea, all MAs at kona -> Tricia should get no MA.
    let patterns = allWorking(staff, 'kona');
    patterns = patch(patterns, 'tricia', {
      locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
    });
    const { day, index } = setup(patterns);
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    for (const a of day.values()) {
      if (a.assignedProviderId) {
        const provider = day.get(a.assignedProviderId);
        expect(a.location).toBe(provider?.location);
      }
    }
    expect(maCount(day, 'tricia')).toBe(0);
  });

  it('gives exactly one MA to providers not flagged "2 MAs"', () => {
    // All same location; only Tricia is flagged for 2 in the fixture.
    const { day, index } = setup(allWorking(staff, 'kona'));
    assignMod(day, staff, index); // keahi -> MOD
    assignMAs(day, staff, index);
    expect(maCount(day, 'tricia')).toBe(2); // flagged -> 2
    for (const id of PROVIDER_IDS.filter((p) => p !== 'tricia')) {
      expect(maCount(day, id)).toBe(1); // not flagged -> exactly 1
    }
  });

  it('leaves surplus MAs unassigned once everyone is filled', () => {
    // 10 MAs, 6 providers, only Tricia flagged -> 6 + 1 = 7 assigned, 3 idle.
    const { day, index } = setup(allWorking(staff, 'kona'));
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    const assigned = [...day.values()].filter((a) => a.assignedProviderId !== null).length;
    expect(assigned).toBe(7);
  });

  it('assigns sequential MA slots (1, 2) under a provider', () => {
    const { day, index } = setup(allWorking(staff));
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    const slots = [...day.values()]
      .filter((a) => a.assignedProviderId === 'tricia')
      .map((a) => a.maSlot)
      .sort();
    expect(slots).toEqual([1, 2]);
  });

  it('places an MA with their default provider (same location)', () => {
    // Sandra defaults to Natalie; both at kona -> Sandra should land under Natalie.
    const patterns = patch(allWorking(staff), 'sandra', { defaultTargetId: 'natalie' });
    const { day, index } = setup(patterns);
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    expect(day.get('sandra')?.assignedProviderId).toBe('natalie');
  });

  it('distributes MAs without a default provider to whoever needs them', () => {
    // No defaults set (fixture); every working provider should still end up with an MA.
    const { day, index } = setup(allWorking(staff));
    assignMod(day, staff, index);
    assignMAs(day, staff, index);
    for (const id of PROVIDER_IDS) expect(maCount(day, id)).toBeGreaterThanOrEqual(1);
  });
});
