import type { Location } from '@/engine/types';

export const LOCATION_LABEL: Record<Location, string> = {
  kona: 'Kona',
  waimea: 'Waimea',
  remote: 'Remote',
  off: 'Off / R-O',
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
