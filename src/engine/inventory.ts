import { endOfMonth, getDay, isSameDay, subDays } from 'date-fns';
import type { DayMap, Location, Staff } from './types';

const LOCATIONS: Location[] = ['kona', 'waimea'];

/** True when `date` is the last Mon–Fri weekday of its own calendar month. */
export function isLastWeekdayOfMonth(date: Date): boolean {
  let last = endOfMonth(date);
  while (getDay(last) === 0 || getDay(last) === 6) last = subDays(last, 1);
  return isSameDay(date, last);
}

/**
 * Step — Inventory Day. On the last weekday of the month, randomly assigns
 * one working MA and one working PCC-tier person (Aesthetic Concierge first,
 * then PCC, then Manager) per location to inventory duty.
 *
 * Idempotent / locked-state-aware: if anyone eligible at a location is
 * ALREADY flagged (whether from a real persisted row overlaid by
 * generatePersonMonth, or from an earlier call within the same run), that
 * location is left alone rather than re-picked — same "don't disturb an
 * already-made decision" principle as MOD (see mod.ts / generatePersonMonth).
 * A person already MOD that day is excluded from being picked (they're
 * already committed to a different standalone duty).
 *
 * `random` defaults to `Math.random` but is injectable for deterministic
 * tests.
 */
export function assignInventory(day: DayMap, staff: Staff[], random: () => number = Math.random): void {
  for (const location of LOCATIONS) {
    assignInventoryMa(day, staff, location, random);
    assignInventoryPcc(day, staff, location, random);
  }
}

function isAt(day: DayMap, staffId: string, location: Location): boolean {
  return day.get(staffId)?.location === location;
}

function isFree(day: DayMap, staffId: string): boolean {
  return !day.get(staffId)?.isMod;
}

function markInventory(day: DayMap, staffId: string): void {
  const a = day.get(staffId);
  if (a) a.isInventory = true;
}

function pickRandom<T>(list: T[], random: () => number): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(random() * list.length)];
}

function assignInventoryMa(
  day: DayMap,
  staff: Staff[],
  location: Location,
  random: () => number,
): void {
  const eligible = staff.filter((s) => s.role === 'ma' && isAt(day, s.id, location) && isFree(day, s.id));
  if (eligible.some((s) => day.get(s.id)?.isInventory)) return; // already decided
  const chosen = pickRandom(eligible, random);
  if (chosen) markInventory(day, chosen.id);
}

function assignInventoryPcc(
  day: DayMap,
  staff: Staff[],
  location: Location,
  random: () => number,
): void {
  const concierge = staff.filter(
    (s) => s.role === 'aesthetic_concierge' && isAt(day, s.id, location) && isFree(day, s.id),
  );
  const pccs = staff.filter((s) => s.role === 'pcc' && isAt(day, s.id, location) && isFree(day, s.id));
  const managers = staff.filter(
    (s) => s.role === 'manager' && isAt(day, s.id, location) && isFree(day, s.id),
  );

  const allCandidates = [...concierge, ...pccs, ...managers];
  if (allCandidates.some((s) => day.get(s.id)?.isInventory)) return; // already decided

  const pool = concierge.length > 0 ? concierge : pccs.length > 0 ? pccs : managers;
  const chosen = pickRandom(pool, random);
  if (chosen) markInventory(day, chosen.id);
}
