// Pure domain types for the generation engine.
// NOTE: This module must stay free of React and Supabase imports (see CLAUDE.md §3).

export type Role =
  | 'provider'
  | 'ma'
  | 'pcc'
  | 'esthetician'
  | 'wellness'
  | 'remote'
  | 'manager'
  | 'aesthetic_concierge';

export type Location = 'kona' | 'waimea' | 'remote' | 'off';

export interface Staff {
  id: string;
  name: string;
  displayName: string;
  role: Role;
  /** Providers only: fill / tie-break ordering. 1 = highest priority. */
  priorityRank: number | null;
  /** MOD eligibility & priority: 1 = Keahi, 2 = Sara, 3 = Reina. null = not MOD-eligible. */
  modPriority: number | null;
  inMaPool: boolean;
  canSocialMedia: boolean;
  canPcc: boolean;
  canShipping: boolean;
  /** The 6 providers receive MAs. */
  receivesMas: boolean;
  /** Providers, estheticians, wellness need a PCC. */
  needsPcc: boolean;
  /** Provider needs coverage when out. Steph & Shama = false; other providers = true. */
  needsCoverageWhenOut: boolean;
  /** May cover absent providers. Any provider except Steph = true. */
  canCoverProviders: boolean;
  active: boolean;
}

export interface MonthlyPattern {
  staffId: string;
  /** First day of month, ISO yyyy-MM-dd. */
  month: string;
  /** 1 = Mon .. 5 = Fri. */
  usualWeekdays: number[];
  /** e.g. { "1": "kona", "2": "waimea" }. */
  locationByWeekday: Record<string, Location>;
  /** Days of month (1-based), expanded from ranges like "1-3, 8-11". */
  requestedOffDays: number[];
}

export interface Assignment {
  /** ISO yyyy-MM-dd. */
  date: string;
  staffId: string;
  location: Location;
  isMod: boolean;
  /** MA -> their provider. */
  assignedProviderId: string | null;
  /** 1 or 2 — order under provider. */
  maSlot: number | null;
  /** PCC / concierge -> targets coordinated. */
  pccCoversIds: string[];
  /** Provider -> absent providers covered. */
  providerCoverageIds: string[];
  isShipping: boolean;
  isSocialMedia: boolean;
  customText: string | null;
}

export type WarningType =
  | 'no_mod'
  | 'provider_no_ma'
  | 'provider_too_many_ma'
  | 'out_provider_no_coverage'
  | 'ma_location_mismatch'
  | 'target_no_pcc';

export interface Warning {
  /** ISO yyyy-MM-dd. */
  date: string;
  type: WarningType;
  /** Stable key for dismissal persistence — e.g. provider id, staff id, or 'mod'. */
  refKey: string;
  message: string;
}

export interface GenerateMonthInput {
  staff: Staff[];
  patterns: MonthlyPattern[];
  /** Any date within the target month. */
  month: Date;
}

export interface GenerateMonthResult {
  assignments: Assignment[];
  warnings: Warning[];
}

/** Mutable per-day working set, keyed by staffId. */
export type DayMap = Map<string, Assignment>;
