import type { Location, MonthlyPattern, Staff } from '../types';

const MONTH = '2026-06-01';

// Per-month ranks seeded for tests (engine reads these, not staff flags).
const MOD_RANK: Record<string, number> = { keahi: 1, sara: 2, reina: 3 };
const SHIPPING_RANK: Record<string, number> = {
  wendy: 1,
  kalea: 2,
  ellis: 3,
  christie: 4,
  raella: 5,
  maile: 6,
};
// Providers that both need and provide coverage (everyone except Steph & Shama).
const COVERAGE = new Set(['tricia', 'natalie', 'monica', 'kendra']);
// Provider fill order (1 = highest).
const PROVIDER_RANK: Record<string, number> = {
  tricia: 1,
  natalie: 2,
  monica: 3,
  steph: 4,
  kendra: 5,
  shama: 6,
};

/** Everyone works Mon–Fri at the given location, no time off, with sensible ranks. */
export function allWorking(
  staff: Staff[],
  location: Location = 'kona',
  month: string = MONTH,
): MonthlyPattern[] {
  return staff.map((s) => ({
    staffId: s.id,
    month,
    usualWeekdays: [1, 2, 3, 4, 5],
    locationByWeekday: { '1': location, '2': location, '3': location, '4': location, '5': location },
    requestedOffDays: [],
    defaultTargetId: null,
    wantsTwoMas: PROVIDER_RANK[s.id] === 1, // Tricia, preserving the original "2 MAs first"
    coverage: COVERAGE.has(s.id),
    providerRank: PROVIDER_RANK[s.id] ?? null,
    modRank: MOD_RANK[s.id] ?? null,
    shippingRank: SHIPPING_RANK[s.id] ?? null,
  }));
}

/** Mutate one person's pattern in a list. */
export function patch(
  patterns: MonthlyPattern[],
  staffId: string,
  changes: Partial<MonthlyPattern>,
): MonthlyPattern[] {
  return patterns.map((p) => (p.staffId === staffId ? { ...p, ...changes } : p));
}

/** Make a person off entirely (no usual weekdays). */
export function makeOff(patterns: MonthlyPattern[], staffId: string): MonthlyPattern[] {
  return patch(patterns, staffId, { usualWeekdays: [] });
}
