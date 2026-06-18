import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import { assignShipping } from '../shipping';
import type { MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff, patch } from './patterns.fixture';

function setup(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
  return { day, index, staff };
}

describe('Step 6 — shipping', () => {
  const staff = buildRoster();

  it('gives shipping to the highest-ranked working person (Wendy, rank 1)', () => {
    const { day, index } = setup(allWorking(staff));
    const id = assignShipping(day, staff, index);
    expect(id).toBe('wendy');
    expect(day.get('wendy')?.isShipping).toBe(true);
  });

  it('falls to the next rank when the top-ranked person is off', () => {
    const { day, index } = setup(makeOff(allWorking(staff), 'wendy'));
    expect(assignShipping(day, staff, index)).toBe('kalea');
  });

  it('assigns shipping to exactly one person', () => {
    const { day, index } = setup(allWorking(staff));
    assignShipping(day, staff, index);
    const shipping = [...day.values()].filter((a) => a.isShipping);
    expect(shipping).toHaveLength(1);
  });

  it('honors the rank from the monthly pattern', () => {
    // Promote Maile above Wendy; she should win.
    let patterns = patch(allWorking(staff), 'maile', { shippingRank: 1 });
    patterns = patch(patterns, 'wendy', { shippingRank: 9 });
    const { day, index } = setup(patterns);
    expect(assignShipping(day, staff, index)).toBe('maile');
  });

  it('only considers people working at Kona', () => {
    // Wendy (rank 1) is at Waimea; the next-ranked Kona person (Kalea) ships.
    const waimea = {
      locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
    } as const;
    const patterns = patch(allWorking(staff), 'wendy', waimea);
    const { day, index } = setup(patterns);
    expect(assignShipping(day, staff, index)).toBe('kalea');
  });

  it('returns null when no shipping-ranked person is at Kona', () => {
    const waimea = {
      locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
    } as const;
    let patterns = allWorking(staff);
    for (const id of ['wendy', 'kalea', 'ellis', 'christie', 'raella', 'maile']) {
      patterns = patch(patterns, id, waimea);
    }
    const { day, index } = setup(patterns);
    expect(assignShipping(day, staff, index)).toBeNull();
  });

  it('falls back to the MOD when no one is ranked for shipping', () => {
    const patterns = allWorking(staff).map((p) => ({ ...p, shippingRank: null }));
    const { day, index } = setup(patterns);
    const modId = assignMod(day, staff, index);
    expect(modId).toBeTruthy();
    expect(assignShipping(day, staff, index)).toBe(modId);
    expect(day.get(modId!)?.isShipping).toBe(true);
  });

  it('returns null when no shipping-ranked person is working', () => {
    let patterns = allWorking(staff);
    for (const id of ['wendy', 'kalea', 'ellis', 'christie', 'raella', 'maile']) {
      patterns = makeOff(patterns, id);
    }
    const { day, index } = setup(patterns);
    expect(assignShipping(day, staff, index)).toBeNull();
  });
});
