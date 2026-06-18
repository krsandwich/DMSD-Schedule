// Convert between snake_case DB rows and the camelCase engine domain types.

import type { Assignment, MonthlyPattern, Staff } from '@/engine/types';
import type { DailyAssignmentRow, MonthlyPatternRow, StaffRow } from './database.types';

export function staffFromRow(r: StaffRow): Staff {
  return {
    id: r.id,
    name: r.name,
    displayName: r.display_name,
    role: r.role,
    canPcc: r.can_pcc,
    receivesMas: r.receives_mas,
    needsPcc: r.needs_pcc,
    active: r.active,
  };
}

export function patternFromRow(r: MonthlyPatternRow): MonthlyPattern {
  return {
    staffId: r.staff_id,
    month: r.month,
    usualWeekdays: r.usual_weekdays,
    locationByWeekday: r.location_by_weekday,
    requestedOffDays: r.requested_off_days,
    defaultTargetId: r.default_target_id,
    wantsTwoMas: r.wants_two_mas,
    coverage: r.coverage,
    providerRank: r.provider_rank,
    modRank: r.mod_rank,
    shippingRank: r.shipping_rank,
  };
}

export function assignmentFromRow(r: DailyAssignmentRow): Assignment {
  return {
    date: r.date,
    staffId: r.staff_id,
    location: r.location,
    isMod: r.is_mod,
    assignedProviderId: r.assigned_provider_id,
    maSlot: r.ma_slot,
    pccCoversIds: r.pcc_covers_ids,
    providerCoverageIds: r.provider_coverage_ids,
    isShipping: r.is_shipping,
    isSocialMedia: r.is_social_media,
    customText: r.custom_text,
  };
}

export function assignmentToRow(a: Assignment): Omit<DailyAssignmentRow, 'id'> {
  return {
    date: a.date,
    staff_id: a.staffId,
    location: a.location,
    is_mod: a.isMod,
    assigned_provider_id: a.assignedProviderId,
    ma_slot: a.maSlot,
    pcc_covers_ids: a.pccCoversIds,
    provider_coverage_ids: a.providerCoverageIds,
    is_shipping: a.isShipping,
    is_social_media: a.isSocialMedia,
    custom_text: a.customText,
  };
}
