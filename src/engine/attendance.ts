import type { Assignment, DayMap, Location, MonthlyPattern, Staff } from './types';

/**
 * Step 1 — Attendance & locations.
 *
 * A person works a given weekday if it is one of their `usualWeekdays` and the
 * day-of-month is not in `requestedOffDays`. Working people take their location
 * from `locationByWeekday`; everyone else renders `off`.
 *
 * Returns a fresh assignment row for every active staff member for the day.
 */
export function resolveAttendance(
  isoDate: string,
  dayOfMonth: number,
  weekday: number,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern>,
): DayMap {
  const day: DayMap = new Map();

  for (const person of staff) {
    if (!person.active) continue;

    const pattern = patternsByStaff.get(person.id);
    let location: Location = 'off';

    if (pattern) {
      const worksWeekday = pattern.usualWeekdays.includes(weekday);
      const isOff = pattern.requestedOffDays.includes(dayOfMonth);
      if (worksWeekday && !isOff) {
        location = pattern.locationByWeekday[String(weekday)] ?? 'off';
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
      customText: null,
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
