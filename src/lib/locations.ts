import type { Location, WeekdayLocation } from '@/engine/types';

export const LOCATION_LABEL: Record<Location, string> = {
  kona: 'Kona',
  waimea: 'Waimea',
  remote: 'Remote',
  off: 'Off / R-O',
};

/** Label for a monthly-setup weekday choice, including the 'alternating' option. */
export const WEEKDAY_LOCATION_LABEL: Record<WeekdayLocation, string> = {
  ...LOCATION_LABEL,
  alternating: 'Kona / Waimea',
};

/** Tailwind classes for a tile at a given location. */
export const LOCATION_TILE: Record<Location, string> = {
  kona: 'bg-kona-bg border-kona-border text-kona',
  waimea: 'bg-waimea-bg border-waimea-border text-waimea',
  remote: 'bg-remote-bg border-remote-border text-remote',
  off: 'bg-off-bg border-off-border text-gray-500',
};

export const LOCATION_DOT: Record<Location, string> = {
  kona: 'bg-kona',
  waimea: 'bg-waimea',
  remote: 'bg-remote',
  off: 'bg-off',
};

export const SELECTABLE_LOCATIONS: Location[] = ['kona', 'waimea', 'remote', 'off'];

/** Weekday choices offered in Monthly Setup: the fixed locations plus 'alternating'. */
export const SELECTABLE_WEEKDAY_LOCATIONS: WeekdayLocation[] = [
  'off',
  'kona',
  'waimea',
  'alternating',
  'remote',
];
