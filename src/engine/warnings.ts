import type { Assignment, Staff, Warning } from './types';

/**
 * Step 9 — Warnings.
 *
 * Computed purely from a single day's assignments plus the roster, so the same
 * function validates both generated days and hand-edited ones (drag-and-drop).
 * All warnings are dismissible; dismissals are persisted elsewhere by `refKey`.
 */
export function computeWarnings(
  isoDate: string,
  dayAssignments: Assignment[],
  staff: Staff[],
): Warning[] {
  const warnings: Warning[] = [];
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const byStaff = new Map(dayAssignments.map((a) => [a.staffId, a]));
  const working = (id: string) => {
    const a = byStaff.get(id);
    return !!a && a.location !== 'off';
  };
  const name = (id: string) => staffById.get(id)?.displayName ?? id;

  // No MOD designated.
  if (!dayAssignments.some((a) => a.isMod)) {
    warnings.push({
      date: isoDate,
      type: 'no_mod',
      refKey: 'mod',
      message: 'No MOD designated for this day.',
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

  // Out provider (other than Steph/Shama) has no coverage.
  const coveredIds = new Set<string>();
  for (const a of dayAssignments) for (const id of a.providerCoverageIds) coveredIds.add(id);
  for (const provider of staff) {
    if (provider.role !== 'provider') continue;
    if (!provider.needsCoverageWhenOut) continue;
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

  // Coverage target has no PCC / concierge.
  const pccCoveredIds = new Set<string>();
  for (const a of dayAssignments) for (const id of a.pccCoversIds) pccCoveredIds.add(id);
  for (const target of staff) {
    if (!target.needsPcc || !working(target.id)) continue;
    if (!pccCoveredIds.has(target.id)) {
      warnings.push({
        date: isoDate,
        type: 'target_no_pcc',
        refKey: target.id,
        message: `${name(target.id)} has no PCC coverage.`,
      });
    }
  }

  return warnings;
}
