import { getDate, getDay, parseISO } from 'date-fns';
import type { Assignment, MonthlyPattern, Staff } from '@/engine/types';

export interface ProviderView {
  staff: Staff;
  assignment: Assignment;
  /** MA assignments under this provider, ordered by slot. */
  mas: Assignment[];
  /** Absent providers this provider covers. */
  coverage: Staff[];
}

export interface CovererView {
  staff: Staff;
  assignment: Assignment;
  /** Targets this PCC / concierge coordinates. */
  covers: Staff[];
}

export interface PersonView {
  staff: Staff;
  assignment: Assignment;
}

export interface DayModel {
  date: string;
  providers: ProviderView[];
  /** Standalone MAs not nested under a provider (e.g. the MOD, or unassigned). */
  standaloneMas: PersonView[];
  managers: PersonView[];
  pccs: CovererView[];
  concierge: CovererView[];
  estheticians: PersonView[];
  wellness: PersonView[];
  remote: PersonView[];
  /** Not scheduled to work this weekday. */
  off: PersonView[];
  /** Scheduled but requested off (R/O) this day. */
  requestedOff: PersonView[];
}

function offAssignment(date: string, staffId: string): Assignment {
  return {
    date,
    staffId,
    location: 'off',
    isMod: false,
    assignedProviderId: null,
    maSlot: null,
    pccCoversIds: [],
    providerCoverageIds: [],
    isShipping: false,
    isSocialMedia: false,
    customText: null,
  };
}

/** Group a single day's assignments into the calendar's role-based layout. */
export function buildDayModel(
  date: string,
  dayAssignments: Assignment[],
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern>,
): DayModel {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const byStaff = new Map(dayAssignments.map((a) => [a.staffId, a]));

  const masByProvider = new Map<string, Assignment[]>();
  for (const a of dayAssignments) {
    if (a.assignedProviderId) {
      const list = masByProvider.get(a.assignedProviderId) ?? [];
      list.push(a);
      masByProvider.set(a.assignedProviderId, list);
    }
  }

  const model: DayModel = {
    date,
    providers: [],
    standaloneMas: [],
    managers: [],
    pccs: [],
    concierge: [],
    estheticians: [],
    wellness: [],
    remote: [],
    off: [],
    requestedOff: [],
  };

  const dayOfMonth = getDate(parseISO(date));
  const weekday = getDay(parseISO(date)); // 0..6

  const sortedStaff = [...staff].sort(
    (a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99) || a.displayName.localeCompare(b.displayName),
  );

  for (const person of sortedStaff) {
    if (!person.active) continue;
    const row = byStaff.get(person.id);
    const present = !!row && row.location !== 'off';

    if (!present) {
      // Off vs Requested-off (R/O).
      const pattern = patternsByStaff.get(person.id);
      const isRequestedOff = !!pattern && pattern.requestedOffDays.includes(dayOfMonth);
      const scheduledThisWeekday = !!pattern && pattern.usualWeekdays.includes(weekday);
      const assignment = row ?? offAssignment(date, person.id);
      if (isRequestedOff && scheduledThisWeekday) {
        model.requestedOff.push({ staff: person, assignment });
      } else {
        model.off.push({ staff: person, assignment });
      }
      continue;
    }

    const assignment = row!;

    // MAs assigned to a provider are nested under that provider, not shown at top level.
    if (assignment.assignedProviderId && staffById.get(assignment.assignedProviderId)?.receivesMas) {
      continue;
    }

    if (person.receivesMas) {
      const mas = (masByProvider.get(person.id) ?? []).sort(
        (x, y) => (x.maSlot ?? 9) - (y.maSlot ?? 9),
      );
      model.providers.push({
        staff: person,
        assignment,
        mas,
        coverage: assignment.providerCoverageIds
          .map((id) => staffById.get(id))
          .filter((s): s is Staff => !!s),
      });
      continue;
    }

    switch (person.role) {
      case 'manager':
        model.managers.push({ staff: person, assignment });
        break;
      case 'pcc':
        model.pccs.push(coverer(person, assignment, staffById));
        break;
      case 'aesthetic_concierge':
        model.concierge.push(coverer(person, assignment, staffById));
        break;
      case 'esthetician':
        model.estheticians.push({ staff: person, assignment });
        break;
      case 'wellness':
        model.wellness.push({ staff: person, assignment });
        break;
      case 'remote':
        model.remote.push({ staff: person, assignment });
        break;
      default:
        // Standalone MA (the MOD, or an unassigned MA).
        model.standaloneMas.push({ staff: person, assignment });
    }
  }

  return model;
}

function coverer(staff: Staff, assignment: Assignment, staffById: Map<string, Staff>): CovererView {
  return {
    staff,
    assignment,
    covers: assignment.pccCoversIds
      .map((id) => staffById.get(id))
      .filter((s): s is Staff => !!s),
  };
}
