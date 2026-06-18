import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignPCCs } from '../assignPCCs';
import type { DayMap, MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff, patch } from './patterns.fixture';

const ALL_WAIMEA = {
  locationByWeekday: { '1': 'waimea', '2': 'waimea', '3': 'waimea', '4': 'waimea', '5': 'waimea' },
} as const;

function dayFrom(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  return resolveAttendance('2026-06-01', 1, 1, staff, index);
}

function coversCount(day: DayMap, covererId: string): number {
  return day.get(covererId)?.pccCoversIds.length ?? 0;
}

const TARGETS = ['tricia', 'natalie', 'monica', 'steph', 'kendra', 'shama', 'shania', 'mia', 'abby'];

describe('Step 5 — assign PCCs / aesthetic concierge', () => {
  const staff = buildRoster();

  it('covers every working target (9 boxes) across PCCs and concierge', () => {
    const day = dayFrom(allWorking(staff));
    assignPCCs(day, staff);
    const covered = new Set<string>();
    for (const a of day.values()) for (const id of a.pccCoversIds) covered.add(id);
    for (const t of TARGETS) expect(covered.has(t)).toBe(true);
  });

  it('fills the 4 PCCs before using aesthetic concierge', () => {
    const day = dayFrom(allWorking(staff));
    assignPCCs(day, staff);
    // 9 targets, soft max 2 -> 4 PCCs hold 8, concierge picks up the 9th.
    const pccTotal =
      coversCount(day, 'wendy') +
      coversCount(day, 'kalea') +
      coversCount(day, 'ellis') +
      coversCount(day, 'christie');
    expect(pccTotal).toBe(8);
    expect(coversCount(day, 'raella') + coversCount(day, 'maile')).toBe(1);
  });

  it('only assigns a coverer at the same location as the target', () => {
    const day = dayFrom(allWorking(staff, 'kona'));
    assignPCCs(day, staff);
    // Every covered target shares its coverer's location.
    for (const c of day.values()) {
      for (const targetId of c.pccCoversIds) {
        expect(day.get(targetId)?.location).toBe(c.location);
      }
    }
  });

  it('leaves a target uncovered when no same-location coverer is working', () => {
    // Monica at waimea; all PCCs and concierge at kona -> Monica uncovered.
    const patterns = patch(allWorking(staff, 'kona'), 'monica', ALL_WAIMEA);
    const day = dayFrom(patterns);
    assignPCCs(day, staff);
    const covered = new Set<string>();
    for (const c of day.values()) for (const id of c.pccCoversIds) covered.add(id);
    expect(covered.has('monica')).toBe(false);
  });

  it('covers a target when a same-location coverer exists', () => {
    // Monica AND Wendy both at waimea; rest at kona -> Wendy covers Monica.
    let patterns = patch(allWorking(staff, 'kona'), 'monica', ALL_WAIMEA);
    patterns = patch(patterns, 'wendy', ALL_WAIMEA);
    const day = dayFrom(patterns);
    assignPCCs(day, staff);
    expect(coversCount(day, 'wendy')).toBeGreaterThan(0);
    const covered = new Set<string>();
    for (const c of day.values()) for (const id of c.pccCoversIds) covered.add(id);
    expect(covered.has('monica')).toBe(true);
  });

  it('covers a coverer’s default target first when same-location', () => {
    // Christie defaults to Abby; both working at kona -> Christie should cover Abby.
    const patterns = patch(allWorking(staff), 'christie', { defaultTargetId: 'abby' });
    const index = new Map(patterns.map((p) => [p.staffId, p]));
    const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
    assignPCCs(day, staff, index);
    expect(day.get('christie')?.pccCoversIds).toContain('abby');
  });

  it('exceeds the soft max only when no coverer has spare capacity', () => {
    // Only one PCC working; concierge off too -> that PCC must take all 9.
    let patterns = allWorking(staff);
    for (const id of ['kalea', 'ellis', 'christie', 'raella', 'maile']) {
      patterns = makeOff(patterns, id);
    }
    const day = dayFrom(patterns);
    assignPCCs(day, staff);
    expect(coversCount(day, 'wendy')).toBe(9);
  });
});
