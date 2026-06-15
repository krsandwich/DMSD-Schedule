import type { Role, Staff } from '../types';

let seq = 0;
function make(overrides: Partial<Staff> & { displayName: string; role: Role }): Staff {
  seq += 1;
  return {
    id: overrides.id ?? `s${seq}`,
    name: overrides.name ?? overrides.displayName,
    displayName: overrides.displayName,
    role: overrides.role,
    priorityRank: overrides.priorityRank ?? null,
    modPriority: overrides.modPriority ?? null,
    inMaPool: overrides.inMaPool ?? false,
    canSocialMedia: overrides.canSocialMedia ?? false,
    canPcc: overrides.canPcc ?? false,
    canShipping: overrides.canShipping ?? false,
    receivesMas: overrides.receivesMas ?? false,
    needsPcc: overrides.needsPcc ?? false,
    needsCoverageWhenOut: overrides.needsCoverageWhenOut ?? false,
    canCoverProviders: overrides.canCoverProviders ?? false,
    active: overrides.active ?? true,
  };
}

const provider = (displayName: string, id: string, rank: number, extra: Partial<Staff> = {}) =>
  make({
    id,
    displayName,
    role: 'provider',
    priorityRank: rank,
    receivesMas: true,
    needsPcc: true,
    needsCoverageWhenOut: true,
    canCoverProviders: true,
    ...extra,
  });

/** Full roster from CLAUDE.md §4, with the flags each rule depends on. */
export function buildRoster(): Staff[] {
  return [
    // Providers (priority: Tricia -> Natalie -> Monica -> Steph -> Kendra -> Shama)
    provider('PA Tricia', 'tricia', 1),
    provider('PA Natalie', 'natalie', 2),
    provider('Dr. Monica', 'monica', 3),
    // Steph never needs coverage when out and may NOT cover others.
    provider('RN Steph', 'steph', 4, { needsCoverageWhenOut: false, canCoverProviders: false }),
    provider('PA Kendra', 'kendra', 5),
    // Shama never needs coverage when out but MAY cover others.
    provider('Dr. Shama Brown', 'shama', 6, { needsCoverageWhenOut: false }),

    // Medical Assistants (10)
    make({ id: 'reina', displayName: 'Reina', role: 'ma', modPriority: 3 }),
    make({ id: 'sandra', displayName: 'Sandra', role: 'ma' }),
    make({ id: 'huaka', displayName: 'Huaka', role: 'ma', canSocialMedia: true }),
    make({ id: 'sarai', displayName: 'Sara I.', role: 'ma' }),
    make({ id: 'mya', displayName: 'Mya', role: 'ma' }),
    make({ id: 'puuwai', displayName: "Pu'uwai", role: 'ma' }),
    make({ id: 'sena', displayName: 'Sena', role: 'ma' }),
    make({ id: 'alana', displayName: 'Alana', role: 'ma' }),
    make({ id: 'braelynn', displayName: 'Braelynn', role: 'ma' }),
    make({ id: 'jordyn', displayName: 'Jordyn', role: 'ma' }),

    // Patient Care Coordinators (4)
    make({ id: 'wendy', displayName: 'Wendy', role: 'pcc', canShipping: true }),
    make({ id: 'kalea', displayName: 'Kalea', role: 'pcc', canShipping: true }),
    make({ id: 'ellis', displayName: 'Ellis', role: 'pcc', canShipping: true }),
    make({ id: 'christie', displayName: 'Christie', role: 'pcc', canShipping: true }),

    // Estheticians (2) — need PCC, receive no MAs
    make({ id: 'shania', displayName: 'Shania', role: 'esthetician', needsPcc: true }),
    make({ id: 'mia', displayName: 'Mia', role: 'esthetician', needsPcc: true }),

    // Wellness (1) — needs PCC, receives no MAs
    make({ id: 'abby', displayName: 'RN Abby', role: 'wellness', needsPcc: true }),

    // Remote (4)
    make({ id: 'catalina', displayName: 'Catalina', role: 'remote' }),
    make({ id: 'jade', displayName: 'Jade', role: 'remote', canPcc: true }),
    make({ id: 'michelle', displayName: 'Michelle', role: 'remote' }),
    make({ id: 'jo', displayName: 'Jo', role: 'remote' }),

    // Managers (2) — both MOD-eligible; Keahi also in MA pool
    make({ id: 'keahi', displayName: 'Keahi', role: 'manager', modPriority: 1, inMaPool: true }),
    make({ id: 'sara', displayName: 'Sara', role: 'manager', modPriority: 2 }),

    // Aesthetic Concierge (2) — can act as PCC and handle shipping
    make({ id: 'raella', displayName: 'Raella', role: 'aesthetic_concierge', canPcc: true, canShipping: true }),
    make({ id: 'maile', displayName: 'Maile', role: 'aesthetic_concierge', canPcc: true, canShipping: true }),
  ];
}

export const PROVIDER_IDS = ['tricia', 'natalie', 'monica', 'steph', 'kendra', 'shama'];
