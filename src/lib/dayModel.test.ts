import { describe, expect, it } from 'vitest';
import { buildDayModel } from './dayModel';
import type { Assignment, MonthlyPattern, Staff } from '@/engine/types';

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
    isInventory: false,
    isMissedShift: false,
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

function intern(id: string, displayName: string): Staff {
  return { id, name: displayName, displayName, role: 'intern', canPcc: false, receivesMas: false, needsPcc: false, active: true };
}

function pattern(staffId: string, overrides: Partial<MonthlyPattern> = {}): MonthlyPattern {
  return {
    staffId,
    month: '2026-10-01',
    usualWeekdays: [1, 2, 3, 4, 5],
    locationByWeekday: {},
    requestedOffDays: [],
    additionalDays: [],
    additionalDaysLocation: null,
    defaultTargetId: null,
    wantsTwoMas: false,
    coverage: false,
    providerRank: null,
    modRank: null,
    shippingRank: null,
    ...overrides,
  };
}

describe('buildDayModel — interns', () => {
  const taylor = intern('taylor', 'Taylor');
  const staff = [sandra, jordyn, taylor];

  it('renders an intern in the interns row with their shadowed MA resolved', () => {
    const dayAssignments: Assignment[] = [
      assignment({ staffId: 'sandra' }),
      assignment({ staffId: 'jordyn' }),
      assignment({ staffId: 'taylor' }),
    ];
    const patternsByStaff = new Map([['taylor', pattern('taylor', { defaultTargetId: 'sandra' })]]);

    const model = buildDayModel(DATE, dayAssignments, staff, patternsByStaff);

    expect(model.interns).toHaveLength(1);
    expect(model.interns[0].staff.id).toBe('taylor');
    expect(model.interns[0].shadows?.id).toBe('sandra');
    // Not double-rendered anywhere else.
    expect(model.standaloneMas.map((p) => p.staff.id)).not.toContain('taylor');
  });

  it('leaves shadows undefined when no MA is picked, without erroring', () => {
    const dayAssignments: Assignment[] = [assignment({ staffId: 'taylor' })];
    const model = buildDayModel(DATE, dayAssignments, [taylor], new Map());
    expect(model.interns).toHaveLength(1);
    expect(model.interns[0].shadows).toBeUndefined();
  });

  it('the interns row is naturally empty (not present) when nobody is an intern', () => {
    const dayAssignments: Assignment[] = [assignment({ staffId: 'sandra' })];
    const model = buildDayModel(DATE, dayAssignments, [sandra], new Map());
    expect(model.interns).toEqual([]);
  });
});
