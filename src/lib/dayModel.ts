import type { Assignment, Staff } from '@/engine/types';

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
  mod: PersonView | null;
  providers: ProviderView[];
  coverers: CovererView[];
  others: PersonView[];
  offStaff: Staff[];
}

/** Group a single day's assignments into the calendar's role-based layout. */
export function buildDayModel(date: string, dayAssignments: Assignment[], staff: Staff[]): DayModel {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const byStaff = new Map(dayAssignments.map((a) => [a.staffId, a]));
  const present = (id: string) => byStaff.has(id);

  const masByProvider = new Map<string, Assignment[]>();
  for (const a of dayAssignments) {
    if (a.assignedProviderId) {
      const list = masByProvider.get(a.assignedProviderId) ?? [];
      list.push(a);
      masByProvider.set(a.assignedProviderId, list);
    }
  }

  let mod: PersonView | null = null;
  const providers: ProviderView[] = [];
  const coverers: CovererView[] = [];
  const others: PersonView[] = [];

  const sortedStaff = [...staff].sort(
    (a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99),
  );

  for (const person of sortedStaff) {
    const assignment = byStaff.get(person.id);
    if (!assignment) continue;

    if (assignment.isMod) {
      mod = { staff: person, assignment };
      continue;
    }

    if (person.receivesMas) {
      const mas = (masByProvider.get(person.id) ?? []).sort(
        (x, y) => (x.maSlot ?? 9) - (y.maSlot ?? 9),
      );
      providers.push({
        staff: person,
        assignment,
        mas,
        coverage: assignment.providerCoverageIds
          .map((id) => staffById.get(id))
          .filter((s): s is Staff => !!s),
      });
      continue;
    }

    // MAs are nested under their provider; skip them at the top level.
    if (assignment.assignedProviderId) continue;

    if (person.role === 'pcc' || person.role === 'aesthetic_concierge') {
      coverers.push({
        staff: person,
        assignment,
        covers: assignment.pccCoversIds
          .map((id) => staffById.get(id))
          .filter((s): s is Staff => !!s),
      });
      continue;
    }

    others.push({ staff: person, assignment });
  }

  const offStaff = staff.filter((s) => s.active && !present(s.id));

  return { date, mod, providers, coverers, others, offStaff };
}
