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
  'manager',
  'pcc',
  'aesthetic_concierge',
  'esthetician',
  'wellness',
  'ma',
  'remote',
];

export function roleRank(role: Role): number {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}
