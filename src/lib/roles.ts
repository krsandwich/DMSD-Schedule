import type { Role } from '@/engine/types';

/** Display label for each official role group. */
export const ROLE_LABEL: Record<Role, string> = {
  provider: 'Providers',
  ma: 'Medical Assistants',
  manager: 'Manager',
  pcc: 'PCC',
  aesthetic_concierge: 'Aesthetic Concierge',
  esthetician: 'Esthetician',
  wellness: 'Wellness',
  remote: 'Remote Team',
};

/** Order roles appear in the calendar and setup, top to bottom. */
export const ROLE_ORDER: Role[] = [
  'provider',
  'ma',
  'pcc',
  'esthetician',
  'wellness',
  'aesthetic_concierge',
  'manager',
  'remote',
];

export function roleRank(role: Role): number {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}

/**
 * Front-desk / management support roles eligible for MOD, shipping, and a default
 * coverage target. MOD & shipping are driven purely by the per-month ranks set on
 * these people — no person is hard-coded as the only one allowed.
 */
export const SUPPORT_ROLES: Role[] = ['pcc', 'manager', 'aesthetic_concierge'];

export function isSupportRole(role: Role): boolean {
  return SUPPORT_ROLES.includes(role);
}

/** Capability flags derived from a role — used when adding a new staff member. */
export function roleFlags(role: Role): { canPcc: boolean; receivesMas: boolean; needsPcc: boolean } {
  return {
    receivesMas: role === 'provider',
    needsPcc: role === 'provider' || role === 'esthetician' || role === 'wellness',
    canPcc: role === 'aesthetic_concierge',
  };
}
