import type { Role, Staff } from '../types';

let seq = 0;
function make(overrides: Partial<Staff> & { displayName: string; role: Role }): Staff {
  seq += 1;
  return {
    id: overrides.id ?? `s${seq}`,
    name: overrides.name ?? overrides.displayName,
    displayName: overrides.displayName,
    role: overrides.role,
    canPcc: overrides.canPcc ?? false,
    receivesMas: overrides.receivesMas ?? false,
    needsPcc: overrides.needsPcc ?? false,
    active: overrides.active ?? true,
  };
}

const provider = (displayName: string, id: string) =>
  make({ id, displayName, role: 'provider', receivesMas: true, needsPcc: true });

/** Full roster from CLAUDE.md §4, with the role-based flags each rule depends on. */
export function buildRoster(): Staff[] {
  return [
    // Providers
    provider('PA Tricia', 'tricia'),
    provider('PA Natalie', 'natalie'),
    provider('Dr. Monica', 'monica'),
    provider('RN Steph', 'steph'),
    provider('PA Kendra', 'kendra'),
    provider('Dr. Shama', 'shama'),

    // Medical Assistants (10)
    make({ id: 'reina', displayName: 'Reina', role: 'ma' }),
    make({ id: 'sandra', displayName: 'Sandra', role: 'ma' }),
    make({ id: 'huaka', displayName: 'Huaka', role: 'ma' }),
    make({ id: 'sarai', displayName: 'Sara I.', role: 'ma' }),
    make({ id: 'mya', displayName: 'Mya', role: 'ma' }),
    make({ id: 'puuwai', displayName: "Pu'uwai", role: 'ma' }),
    make({ id: 'sena', displayName: 'Sena', role: 'ma' }),
    make({ id: 'alana', displayName: 'Alana', role: 'ma' }),
    make({ id: 'braelynn', displayName: 'Braelynn', role: 'ma' }),
    make({ id: 'jordyn', displayName: 'Jordyn', role: 'ma' }),

    // Patient Care Coordinators (4)
    make({ id: 'wendy', displayName: 'Wendy', role: 'pcc' }),
    make({ id: 'kalea', displayName: 'Kalea', role: 'pcc' }),
    make({ id: 'ellis', displayName: 'Ellis', role: 'pcc' }),
    make({ id: 'christie', displayName: 'Christie', role: 'pcc' }),

    // Estheticians (2) — need PCC, receive no MAs
    make({ id: 'shania', displayName: 'Shania', role: 'esthetician', needsPcc: true }),
    make({ id: 'mia', displayName: 'Mia', role: 'esthetician', needsPcc: true }),

    // Wellness (1) — needs PCC, receives no MAs
    make({ id: 'abby', displayName: 'RN Abby', role: 'wellness', needsPcc: true }),

    // Remote (4) — no remote employee can act as PCC
    make({ id: 'catalina', displayName: 'Catalina', role: 'remote' }),
    make({ id: 'jade', displayName: 'Jade', role: 'remote' }),
    make({ id: 'michelle', displayName: 'Michelle', role: 'remote' }),
    make({ id: 'jo', displayName: 'Jo', role: 'remote' }),

    // Managers (2) — assignable as an MA manually, never auto-pooled
    make({ id: 'keahi', displayName: 'Keahi', role: 'manager' }),
    make({ id: 'sara', displayName: 'Sara', role: 'manager' }),

    // Aesthetic Concierge (2) — can act as PCC
    make({ id: 'raella', displayName: 'Raella', role: 'aesthetic_concierge', canPcc: true }),
    make({ id: 'maile', displayName: 'Maile', role: 'aesthetic_concierge', canPcc: true }),
  ];
}

export const PROVIDER_IDS = ['tricia', 'natalie', 'monica', 'steph', 'kendra', 'shama'];
