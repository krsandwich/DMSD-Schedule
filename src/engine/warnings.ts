import { parseISO } from 'date-fns';
import { isLastWeekdayOfMonth } from './inventory';
import type { Assignment, DayMap, Location, MonthlyPattern, Staff, Warning } from './types';

/**
 * Step 9 — Warnings.
 *
 * Computed purely from a single day's assignments plus the roster, so the same
 * function validates both generated days and hand-edited ones (drag-and-drop).
 * All warnings are dismissible; dismissals are persisted elsewhere by `refKey`.
 *
 * `expectedDay`, when supplied, is a fresh `resolveAttendance` result for this
 * same date computed from the CURRENT patterns — used to detect a persisted
 * schedule that's gone stale relative to a pattern edit (e.g. someone's
 * requested-off days changed after the month was already generated). Omit it
 * for freshly-generated days, where `dayAssignments` IS that fresh result and
 * the comparison would never fire.
 */
export function computeWarnings(
  isoDate: string,
  dayAssignments: Assignment[],
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern> = new Map(),
  expectedDay?: DayMap,
): Warning[] {
  const warnings: Warning[] = [];
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const byStaff = new Map(dayAssignments.map((a) => [a.staffId, a]));
  const working = (id: string) => {
    const a = byStaff.get(id);
    return !!a && a.location !== 'off';
  };
  const name = (id: string) => staffById.get(id)?.displayName ?? id;

  // Exactly one MOD designated. Two people can both end up flagged MOD when a
  // person is regenerated independently (see useReplacePersonMonth) — their own
  // row picks a fresh MOD without clearing whoever already held it.
  const mods = dayAssignments.filter((a) => a.isMod);
  if (mods.length === 0) {
    warnings.push({
      date: isoDate,
      type: 'no_mod',
      refKey: 'mod',
      message: 'No MOD designated for this day.',
    });
  } else if (mods.length > 1) {
    warnings.push({
      date: isoDate,
      type: 'multiple_mod',
      refKey: 'mod',
      message: `Multiple MODs designated: ${mods.map((m) => name(m.staffId)).join(', ')}.`,
    });
  }

  // MA counts per provider receiving MAs.
  for (const provider of staff) {
    if (!provider.receivesMas || !working(provider.id)) continue;
    const maCount = dayAssignments.filter((a) => a.assignedProviderId === provider.id).length;
    if (maCount === 0) {
      warnings.push({
        date: isoDate,
        type: 'provider_no_ma',
        refKey: provider.id,
        message: `${name(provider.id)} has no MA assigned.`,
      });
    } else if (maCount > 2) {
      warnings.push({
        date: isoDate,
        type: 'provider_too_many_ma',
        refKey: provider.id,
        message: `${name(provider.id)} has ${maCount} MAs (max 2).`,
      });
    }
  }

  // Out provider flagged for coverage has no coverage assigned.
  const coveredIds = new Set<string>();
  for (const a of dayAssignments) for (const id of a.providerCoverageIds) coveredIds.add(id);
  for (const provider of staff) {
    if (provider.role !== 'provider') continue;
    if (!patternsByStaff.get(provider.id)?.coverage) continue;
    if (working(provider.id)) continue;
    if (!coveredIds.has(provider.id)) {
      warnings.push({
        date: isoDate,
        type: 'out_provider_no_coverage',
        refKey: provider.id,
        message: `${name(provider.id)} is out with no coverage.`,
      });
    }
  }

  // MA location must match assigned provider's location.
  for (const a of dayAssignments) {
    if (!a.assignedProviderId) continue;
    const provider = byStaff.get(a.assignedProviderId);
    if (provider && provider.location !== a.location) {
      warnings.push({
        date: isoDate,
        type: 'ma_location_mismatch',
        refKey: a.staffId,
        message: `${name(a.staffId)} (${a.location}) is assigned to ${name(
          a.assignedProviderId,
        )} (${provider.location}).`,
      });
    }
  }

  // PCC / concierge location must match the target they're covering. Same hard
  // constraint as MA-to-provider; can go stale when a target is regenerated
  // independently and its location changes (see useReplacePersonMonth).
  for (const a of dayAssignments) {
    for (const targetId of a.pccCoversIds) {
      const target = byStaff.get(targetId);
      if (target && target.location !== a.location) {
        warnings.push({
          date: isoDate,
          type: 'pcc_location_mismatch',
          refKey: `${a.staffId}:${targetId}`,
          message: `${name(a.staffId)} (${a.location}) covers ${name(targetId)} (${
            target.location
          }).`,
        });
      }
    }
  }

  // Coverage target has no PCC / concierge.
  const pccCoveredIds = new Set<string>();
  for (const a of dayAssignments) for (const id of a.pccCoversIds) pccCoveredIds.add(id);
  for (const target of staff) {
    if (!target.needsPcc || !working(target.id)) continue;
    // A target who is themselves standing in as an MA (assigned to a provider) or as
    // a PCC (covering others) is occupied and doesn't need their own PCC that day.
    const own = byStaff.get(target.id);
    if (own && (own.assignedProviderId || own.pccCoversIds.length > 0)) continue;
    if (!pccCoveredIds.has(target.id)) {
      warnings.push({
        date: isoDate,
        type: 'target_no_pcc',
        refKey: target.id,
        message: `${name(target.id)} has no PCC coverage.`,
      });
    }
  }

  // Inventory Day (last weekday of the month): each location with eligible
  // MA / PCC-tier staff working should have someone flagged for inventory.
  if (isLastWeekdayOfMonth(parseISO(isoDate))) {
    const atLocation = (role: Staff['role'], location: Location) =>
      staff.filter((s) => s.role === role && byStaff.get(s.id)?.location === location);
    const locationLabel: Record<Location, string> = { kona: 'Kona', waimea: 'Waimea', remote: 'Remote', off: 'Off' };

    for (const location of ['kona', 'waimea'] as Location[]) {
      const eligibleMas = atLocation('ma', location);
      if (eligibleMas.length > 0 && !eligibleMas.some((s) => byStaff.get(s.id)?.isInventory)) {
        warnings.push({
          date: isoDate,
          type: 'inventory_ma_missing',
          refKey: location,
          message: `No inventory MA assigned at ${locationLabel[location]}.`,
        });
      }

      const eligiblePccTier = [
        ...atLocation('aesthetic_concierge', location),
        ...atLocation('pcc', location),
        ...atLocation('manager', location),
      ];
      if (eligiblePccTier.length > 0 && !eligiblePccTier.some((s) => byStaff.get(s.id)?.isInventory)) {
        warnings.push({
          date: isoDate,
          type: 'inventory_pcc_missing',
          refKey: location,
          message: `No inventory PCC assigned at ${locationLabel[location]}.`,
        });
      }
    }
  }

  // Stale schedule: current setup implies a different off/working status than
  // what's actually persisted for this day (a pattern edit — requested-off,
  // additional days, usual weekdays — landed after this day was generated).
  // Only compares working-vs-off, not location, so an intentional manual
  // location change (e.g. a coverage swap) never trips this.
  if (expectedDay) {
    for (const id of patternsByStaff.keys()) {
      if (!staffById.get(id)?.active) continue;
      const expectedWorking = (expectedDay.get(id)?.location ?? 'off') !== 'off';
      const actualWorking = working(id);
      if (expectedWorking === actualWorking) continue;
      warnings.push({
        date: isoDate,
        type: 'pattern_out_of_sync',
        refKey: id,
        message: expectedWorking
          ? `${name(id)} should be working today per current setup, but the schedule still shows them off — regenerate to apply.`
          : `${name(id)} is marked off/requested-off in current setup, but the schedule still shows them working — regenerate to apply.`,
      });
    }
  }

  return warnings;
}
