import type { Location } from '@/engine/types';

// Default usual weekday + location per person (from Downloads/defaults.txt).
// Keyed by staff display_name. Weekday: 1 = Mon .. 5 = Fri.
// Used to pre-fill Monthly Setup when no pattern is saved yet (e.g. after a DB
// reset), so the standard schedule doesn't have to be re-entered each time.
// Requested time off is NOT part of defaults — it is always per-month.

type WeekdayLocations = Partial<Record<number, Location>>;

const K: Location = 'kona';
const W: Location = 'waimea';
const R: Location = 'remote';

export const DEFAULT_WEEKDAY_LOCATIONS: Record<string, WeekdayLocations> = {
  // Providers
  'Dr. Monica': { 1: K, 2: W },
  'PA Tricia': { 2: K, 3: K, 4: W, 5: K },
  'PA Natalie': { 1: W, 2: K, 3: K, 4: K },
  'RN Steph': { 1: K, 2: K, 3: W, 4: K },
  'PA Kendra': { 1: K, 2: W, 3: K, 4: K, 5: K },
  'Dr. Shama Brown': { 4: K, 5: W },

  // Estheticians
  Shania: { 1: K, 3: K, 4: W, 5: K },
  Mia: { 1: W, 2: K, 3: K, 5: W },

  // Wellness
  'RN Abby': { 1: K },

  // Medical Assistants
  Reina: { 1: K, 2: K, 4: K, 5: K },
  Sandra: { 1: K, 2: W, 5: K },
  Huaka: { 1: K, 2: W, 3: K, 4: K, 5: K },
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
