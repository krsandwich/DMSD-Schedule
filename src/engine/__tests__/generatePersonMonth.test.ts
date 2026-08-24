import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { generatePersonMonth } from '../generatePersonMonth';
import { generateMonth } from '../generateMonth';
import { assignMod } from '../mod';
import { buildRoster } from './roster.fixture';
import { allWorking } from './patterns.fixture';
import type { Assignment } from '../types';

const staff = buildRoster();
const patterns = allWorking(staff);
const month = parseISO('2026-06-01');
const DAY1 = '2026-06-01'; // Monday

const MA_IDS = staff.filter((s) => s.role === 'ma').map((s) => s.id);

/** Simulate persisting: replace this staff member's rows, leave everyone else's alone. */
function merge(existing: Assignment[], staffId: string, mine: Assignment[]): Assignment[] {
  return [...existing.filter((a) => a.staffId !== staffId), ...mine];
}

function maCountsByProvider(assignments: Assignment[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of assignments) {
    if (a.assignedProviderId) counts[a.assignedProviderId] = (counts[a.assignedProviderId] ?? 0) + 1;
  }
  return counts;
}

describe('generatePersonMonth — regenerating one person without disturbing others', () => {
  it('regression: independently generating every MA one at a time never over-fills a provider, in ANY processing order', () => {
    // Reverse of roster order — the adversarial case: nothing here relies on
    // processing happening to match the algorithm's natural pool order.
    const order = [...MA_IDS].reverse();
    let existing: Assignment[] = [];
    for (const maId of order) {
      const mine = generatePersonMonth({ staffId: maId, staff, patterns, month, existingAssignments: existing });
      existing = merge(existing, maId, mine);
    }

    const day1 = existing.filter((a) => a.date === DAY1);
    const counts = maCountsByProvider(day1);
    for (const [providerId, count] of Object.entries(counts)) {
      expect(count, `provider ${providerId} ended up with ${count} MAs`).toBeLessThanOrEqual(2);
    }

    // No two MAs claim the same (provider, slot) pair.
    const seenSlots = new Set<string>();
    for (const a of day1) {
      if (!a.assignedProviderId) continue;
      const key = `${a.assignedProviderId}:${a.maSlot}`;
      expect(seenSlots.has(key), `duplicate slot ${key}`).toBe(false);
      seenSlots.add(key);
    }
  });

  it('a provider who already has their real MA is skipped, not given a second (unless wantsTwoMas)', () => {
    // Natalie (not wantsTwoMas) already has a real MA locked in from a prior
    // per-person generate.
    const first = generatePersonMonth({ staffId: 'sandra', staff, patterns, month, existingAssignments: [] });
    const sandraDay1 = first.find((a) => a.date === DAY1)!;
    // Force this scenario deterministically: pretend Sandra landed on Natalie.
    const locked: Assignment = { ...sandraDay1, assignedProviderId: 'natalie', maSlot: 1 };

    const second = generatePersonMonth({
      staffId: 'huaka',
      staff,
      patterns,
      month,
      existingAssignments: [locked],
    });
    const huakaDay1 = second.find((a) => a.date === DAY1)!;
    expect(huakaDay1.assignedProviderId).not.toBe('natalie');
  });

  it('processing every MA in the algorithm\'s natural order reproduces a single full generateMonth call', () => {
    let existing: Assignment[] = [];
    for (const maId of MA_IDS) {
      const mine = generatePersonMonth({ staffId: maId, staff, patterns, month, existingAssignments: existing });
      existing = merge(existing, maId, mine);
    }
    const perPerson = existing
      .filter((a) => a.date === DAY1 && MA_IDS.includes(a.staffId))
      .map((a) => ({ staffId: a.staffId, assignedProviderId: a.assignedProviderId, maSlot: a.maSlot }))
      .sort((a, b) => a.staffId.localeCompare(b.staffId));

    const { assignments: full } = generateMonth({ staff, patterns, month });
    const fromFull = full
      .filter((a) => a.date === DAY1 && MA_IDS.includes(a.staffId))
      .map((a) => ({ staffId: a.staffId, assignedProviderId: a.assignedProviderId, maSlot: a.maSlot }))
      .sort((a, b) => a.staffId.localeCompare(b.staffId));

    expect(perPerson).toEqual(fromFull);
  });

  it('does not create a duplicate MOD when regenerating a different MOD-eligible person', () => {
    // Establish the real MOD for the day (Keahi, per MOD_RANK in the fixture).
    const { assignments: full } = generateMonth({ staff, patterns, month });
    const day1Full = full.filter((a) => a.date === DAY1);
    const realMod = day1Full.find((a) => a.isMod);
    expect(realMod?.staffId).toBe('keahi');

    // Regenerate Reina (also MOD-eligible, modRank 3 — lower priority than Keahi)
    // into a month where Keahi's real MOD assignment is already locked in.
    const mine = generatePersonMonth({
      staffId: 'reina',
      staff,
      patterns,
      month,
      existingAssignments: day1Full,
    });
    const reinaDay1 = mine.find((a) => a.date === DAY1)!;
    expect(reinaDay1.isMod).toBe(false);

    // Sanity: assignMod itself would have picked Keahi again anyway (same
    // ranking), so this isn't just "nobody can ever become MOD".
    const fresh = new Map(day1Full.map((a) => [a.staffId, { ...a, isMod: false }]));
    assignMod(fresh, staff, new Map(patterns.map((p) => [p.staffId, p])));
    expect(fresh.get('keahi')?.isMod).toBe(true);
  });

  it('never returns a row for anyone other than the target', () => {
    const mine = generatePersonMonth({ staffId: 'jordyn', staff, patterns, month, existingAssignments: [] });
    expect(mine.every((a) => a.staffId === 'jordyn')).toBe(true);
  });
});
