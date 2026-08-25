import type { Assignment, DayMap, Location, MonthlyPattern, Staff, WeekdayLocation } from './types';

/**
 * The two locations an alternating choice cycles through, in order. The first is
 * used for the first two-week block of the month, the second for the next block,
 * repeating (see `weekBlock`).
 */
const ALTERNATING: Partial<Record<WeekdayLocation, readonly [Location, Location]>> = {
  alternating: ['kona', 'waimea'],
  waimea_kona: ['waimea', 'kona'],
};

/**
 * Step 1 — Attendance & locations.
 *
 * A person works a given weekday if it is one of their `usualWeekdays` and the
 * day-of-month is not in `requestedOffDays`. Working people take their location
 * from `locationByWeekday`; everyone else renders `off`.
 *
 * A weekday set to `'alternating'` / `'waimea_kona'` resolves by the two-week
 * block of the month (`weekBlock`, supplied by the caller): block 0 = the first
 * two weeks, block 1 = the next two, alternating.
 *
 * Returns a fresh assignment row for every active staff member for the day.
 */
export function resolveAttendance(
  isoDate: string,
  dayOfMonth: number,
  weekday: number,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern>,
  weekBlock: 0 | 1 = 0,
): DayMap {
  const day: DayMap = new Map();

  for (const person of staff) {
    if (!person.active) continue;

    const pattern = patternsByStaff.get(person.id);
    let location: Location = 'off';

    if (pattern) {
      const resolve = (choice: WeekdayLocation): Location =>
        ALTERNATING[choice]?.[weekBlock] ?? (choice as Location);

      const worksWeekday = pattern.usualWeekdays.includes(weekday);
      const isOff = pattern.requestedOffDays.includes(dayOfMonth);
      if (worksWeekday && !isOff) {
        location = resolve(pattern.locationByWeekday[String(weekday)] ?? 'off');
      }

      // Additional working days override the usual pattern AND requested-off:
      // the person works this day at additionalDaysLocation.
      const addLoc = pattern.additionalDaysLocation;
      if (pattern.additionalDays.includes(dayOfMonth) && addLoc && addLoc !== 'off') {
        location = resolve(addLoc);
      }
    }

    const assignment: Assignment = {
      date: isoDate,
      staffId: person.id,
      location,
      isMod: false,
      assignedProviderId: null,
      maSlot: null,
      pccCoversIds: [],
      providerCoverageIds: [],
      isShipping: false,
      isSocialMedia: false,
      isInventory: false,
      isMissedShift: false,
      customText: null,
      weeklyTaskNo: null,
    };
    day.set(person.id, assignment);
  }

  return day;
}

/** A staff member is present (working) when their resolved location is not `off`. */
export function isWorking(day: DayMap, staffId: string): boolean {
  const a = day.get(staffId);
  return !!a && a.location !== 'off';
}
