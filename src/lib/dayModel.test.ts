import { describe, expect, it } from 'vitest';
import { buildDayModel } from './dayModel';
import type { Assignment, Staff } from '@/engine/types';

const DATE = '2026-10-06'; // Tuesday

const monica: Staff = {
  id: 'monica',
  name: 'Dr. Monica',
  displayName: 'Dr. Monica',
  role: 'provider',
  canPcc: false,
  receivesMas: true,
  needsPcc: true,
  active: true,
};

function ma(id: string, displayName: string): Staff {
  return { id, name: displayName, displayName, role: 'ma', canPcc: false, receivesMas: false, needsPcc: false, active: true };
}

const sandra = ma('sandra', 'Sandra');
const jordyn = ma('jordyn', 'Jordyn');
const braelynn = ma('braelynn', 'Braelynn');

function assignment(overrides: Partial<Assignment> & { staffId: string }): Assignment {
  return {
    date: DATE,
    location: 'kona',
    isMod: false,
    assignedProviderId: null,
    maSlot: null,
    pccCoversIds: [],
    providerCoverageIds: [],
    isShipping: false,
    isSocialMedia: false,
    customText: null,
    weeklyTaskNo: null,
    ...overrides,
  };
}

describe('buildDayModel — MA orphaned when their provider is set to Off', () => {
  const staff = [monica, sandra, jordyn, braelynn];

  it('renders MAs standalone (not vanished) when their assigned provider is off', () => {
    const dayAssignments: Assignment[] = [
      assignment({ staffId: 'monica', location: 'off' }),
      assignment({ staffId: 'sandra', assignedProviderId: 'monica', maSlot: 1 }),
      assignment({ staffId: 'jordyn', assignedProviderId: 'monica', maSlot: 2 }),
      assignment({ staffId: 'braelynn', assignedProviderId: 'monica' }),
    ];

    const model = buildDayModel(DATE, dayAssignments, staff, new Map());

    // Monica herself renders in the off row, not as a ProviderView.
    expect(model.providers).toHaveLength(0);
    expect(model.off.map((p) => p.staff.id)).toContain('monica');

    // Every MA that pointed at her is rendered SOMEWHERE — standalone, since
    // there's no provider tile to nest under — not silently dropped.
    const renderedIds = new Set(model.standaloneMas.map((p) => p.staff.id));
    expect(renderedIds).toEqual(new Set(['sandra', 'jordyn', 'braelynn']));

    // None of them are lost: total accounted-for staff equals the roster.
    const allRendered = [
      ...model.providers.map((p) => p.staff.id),
      ...model.standaloneMas.map((p) => p.staff.id),
      ...model.off.map((p) => p.staff.id),
      ...model.requestedOff.map((p) => p.staff.id),
    ];
    expect(new Set(allRendered)).toEqual(new Set(staff.map((s) => s.id)));
  });

  it('still nests MAs under their provider normally when the provider IS working', () => {
    const dayAssignments: Assignment[] = [
      assignment({ staffId: 'monica' }),
      assignment({ staffId: 'sandra', assignedProviderId: 'monica', maSlot: 1 }),
    ];

    const model = buildDayModel(DATE, dayAssignments, staff, new Map());

    expect(model.providers).toHaveLength(1);
    expect(model.providers[0].mas.map((a) => a.staffId)).toEqual(['sandra']);
    expect(model.standaloneMas.map((p) => p.staff.id)).not.toContain('sandra');
  });
});
