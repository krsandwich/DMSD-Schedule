import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import type { MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff, patch } from './patterns.fixture';

function setup(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
  return { day, index };
}

describe('Step 2 — MOD', () => {
  const staff = buildRoster();

  it('picks the highest-ranked working MOD person (Keahi, rank 1)', () => {
    const { day, index } = setup(allWorking(staff));
    const modId = assignMod(day, staff, index);
    expect(modId).toBe('keahi');
    expect(day.get('keahi')?.isMod).toBe(true);
  });

  it('falls back to Sara when Keahi is off', () => {
    const { day, index } = setup(makeOff(allWorking(staff), 'keahi'));
    expect(assignMod(day, staff, index)).toBe('sara');
  });

  it('falls back to Reina when Keahi and Sara are off', () => {
    let patterns = makeOff(allWorking(staff), 'keahi');
    patterns = makeOff(patterns, 'sara');
    const { day, index } = setup(patterns);
    expect(assignMod(day, staff, index)).toBe('reina');
  });

  it('returns null when no MOD-ranked person is working', () => {
    let patterns = makeOff(allWorking(staff), 'keahi');
    patterns = makeOff(patterns, 'sara');
    patterns = makeOff(patterns, 'reina');
    const { day, index } = setup(patterns);
    expect(assignMod(day, staff, index)).toBeNull();
  });

  it('honors the rank from the monthly pattern over roster order', () => {
    // Give Reina the top rank; she should win even with Keahi working.
    let patterns = patch(allWorking(staff), 'reina', { modRank: 1 });
    patterns = patch(patterns, 'keahi', { modRank: 2 });
    const { day, index } = setup(patterns);
    expect(assignMod(day, staff, index)).toBe('reina');
  });

  it('only considers people working at Kona', () => {
    // Keahi (rank 1) is at Waimea; the next-ranked Kona person (Sara) becomes MOD.
    const waimea = {
      locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
    } as const;
    const patterns = patch(allWorking(staff), 'keahi', waimea);
    const { day, index } = setup(patterns);
    expect(assignMod(day, staff, index)).toBe('sara');
  });

  it('returns null when no MOD-ranked person is at Kona', () => {
    const waimea = {
      locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
    } as const;
    let patterns = patch(allWorking(staff), 'keahi', waimea);
    patterns = patch(patterns, 'sara', waimea);
    patterns = patch(patterns, 'reina', waimea);
    const { day, index } = setup(patterns);
    expect(assignMod(day, staff, index)).toBeNull();
  });

  it('keeps MOD standalone — not placed under a provider', () => {
    const { day, index } = setup(allWorking(staff));
    assignMod(day, staff, index);
    const keahi = day.get('keahi');
    expect(keahi?.assignedProviderId).toBeNull();
    expect(keahi?.maSlot).toBeNull();
  });
});
