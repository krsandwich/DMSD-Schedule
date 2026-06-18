import type { WeekdayLocation } from '@/engine/types';

// Default usual weekday + location per person (from Downloads/defaults.txt).
// Keyed by staff display_name. Weekday: 1 = Mon .. 5 = Fri.
// Used to pre-fill Monthly Setup when no pattern is saved yet (e.g. after a DB
// reset), so the standard schedule doesn't have to be re-entered each time.
// Requested time off is NOT part of defaults — it is always per-month.

type WeekdayLocations = Partial<Record<number, WeekdayLocation>>;

const K: WeekdayLocation = 'kona';
const W: WeekdayLocation = 'waimea';
const R: WeekdayLocation = 'remote';
const A: WeekdayLocation = 'alternating'; // alternates Kona / Waimea week to week

export const DEFAULT_WEEKDAY_LOCATIONS: Record<string, WeekdayLocations> = {
  // Providers
  'Dr. Monica': { 1: K, 2: A },
  'PA Tricia': { 2: K, 3: K, 4: W, 5: K },
  'PA Natalie': { 1: W, 2: K, 3: K, 4: K },
  'RN Steph': { 1: K, 2: K, 3: W, 4: K },
  'PA Kendra': { 1: K, 2: A, 3: K, 4: K, 5: W },
  'Dr. Shama': { 4: K, 5: W },

  // Estheticians
  Shania: { 1: K, 3: K, 4: W, 5: K },
  Mia: { 1: W, 2: K, 3: K, 5: W },

  // Wellness
  'RN Abby': { 1: K },

  // Medical Assistants
  Reina: { 1: K, 2: K, 4: K, 5: K },
  Sandra: { 1: K, 2: A, 5: K },
  Huaka: { 3: K, 4: K, 5: K },
  'Sara I.': { 1: W, 2: K, 3: K, 4: K },
  Mya: { 1: W, 2: K, 3: K, 4: K },
  "Pu'uwai": { 1: K, 2: K, 3: W, 4: K },
  Sena: { 2: K, 3: K, 4: W, 5: W },
  Alana: { 2: K, 3: K, 4: W, 5: K },
  Braelynn: { 1: K, 2: K, 3: K, 4: K, 5: W },
  Jordyn: { 1: W, 2: K, 3: K, 4: K, 5: K },

  // Patient Care Coordinators
  Wendy: { 1: K, 2: K, 3: W, 4: K },
  Kalea: { 1: K, 2: K, 3: K, 4: W, 5: K },
  Ellis: { 1: K, 2: W, 3: K, 4: K, 5: K },
  Christie: { 1: K, 3: K, 4: K, 5: W },

  // Aesthetic Concierge
  Raella: { 2: W, 3: K, 4: K, 5: R },
  Maile: { 1: W, 2: K, 3: K, 5: W },

  // Remote
  Catalina: { 1: R, 2: R, 3: R, 4: R },
  Jade: { 1: R, 2: R, 3: R, 4: R, 5: R },
  Michelle: { 1: R, 2: R, 3: R, 4: R, 5: R },
  Jo: { 1: R, 2: R, 3: R, 4: R, 5: R },

  // Managers (Sara K = the manager "Sara")
  Sara: { 1: K, 2: K, 3: K, 4: K, 5: K },
  Keahi: { 2: K, 3: K, 4: K, 5: K },
};

/** Default weekday locations for a staff member by display name (empty if none). */
export function defaultWeekdayLocations(displayName: string): WeekdayLocations {
  return DEFAULT_WEEKDAY_LOCATIONS[displayName] ?? {};
}

// Default MOD rank (1 = highest). Highest-ranked working person at Kona becomes MOD.
// Editable in Monthly Setup; these are just sensible starting defaults.
const DEFAULT_MOD_RANK: Record<string, number> = {
  Reina: 1,
  Keahi: 2,
  Sara: 3,
};

// Default shipping rank (1 = highest). The MOD is the backup when no one is ranked.
const DEFAULT_SHIPPING_RANK: Record<string, number> = {
  Raella: 1,
  Maile: 2,
};

// Default provider fill-order rank (1 = highest). Editable per month in setup.
const DEFAULT_PROVIDER_RANK: Record<string, number> = {
  'PA Tricia': 1,
  'PA Natalie': 2,
  'Dr. Monica': 3,
  'RN Steph': 4,
  'PA Kendra': 5,
  'Dr. Shama': 6,
};

export function defaultProviderRank(displayName: string): number | null {
  return DEFAULT_PROVIDER_RANK[displayName] ?? null;
}

// Providers that default to two MAs.
const DEFAULT_TWO_MAS = new Set(['PA Tricia', 'Dr. Monica', 'PA Natalie']);

// Providers that default to the Coverage flag (need + provide coverage).
const DEFAULT_COVERAGE = new Set(['PA Tricia', 'PA Natalie', 'Dr. Monica', 'PA Kendra', 'Dr. Shama']);

// Default assignment target by display name (resolved to a staff id in setup):
//  - MA  → default provider; PCC / concierge → default coverage target.
const DEFAULT_TARGET: Record<string, string> = {
  Sandra: 'Dr. Monica',
  Huaka: 'Dr. Monica',
  Ellis: 'Dr. Monica',
  Alana: 'PA Tricia',
  Sena: 'PA Tricia',
  Kalea: 'PA Tricia',
  'Sara I.': 'PA Natalie',
  Mya: 'PA Natalie',
  Maile: 'PA Natalie',
  Braelynn: 'PA Kendra',
  Christie: 'PA Kendra',
  "Pu'uwai": 'RN Steph',
  Wendy: 'RN Steph',
  Reina: 'Dr. Shama',
};

/** Default target's display name for a staff member (null if none). */
export function defaultTargetName(displayName: string): string | null {
  return DEFAULT_TARGET[displayName] ?? null;
}

export function defaultWantsTwoMas(displayName: string): boolean {
  return DEFAULT_TWO_MAS.has(displayName);
}

export function defaultCoverage(displayName: string): boolean {
  return DEFAULT_COVERAGE.has(displayName);
}

export function defaultModRank(displayName: string): number | null {
  return DEFAULT_MOD_RANK[displayName] ?? null;
}

export function defaultShippingRank(displayName: string): number | null {
  return DEFAULT_SHIPPING_RANK[displayName] ?? null;
}
