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

/**
 * A monthly-setup weekday choice. Either a fixed {@link Location}, or
 * `'alternating'` — the person switches between Kona and Waimea week to week.
 * `'alternating'` is resolved to a concrete location per-day in Step 1 by week
 * parity (even ISO week → Kona, odd → Waimea); it never reaches a daily assignment.
 */
export type WeekdayLocation = Location | 'alternating';

export interface Staff {
  id: string;
  name: string;
  displayName: string;
  role: Role;
  /** Aesthetic concierge may act as a PCC. */
  canPcc: boolean;
  /** The 6 providers receive MAs. */
  receivesMas: boolean;
  /** Providers, estheticians, wellness need a PCC. */
  needsPcc: boolean;
  active: boolean;
}

export interface MonthlyPattern {
  staffId: string;
  /** First day of month, ISO yyyy-MM-dd. */
  month: string;
  /** 1 = Mon .. 5 = Fri. */
  usualWeekdays: number[];
  /** e.g. { "1": "kona", "2": "waimea", "3": "alternating" }. */
  locationByWeekday: Record<string, WeekdayLocation>;
  /** Days of month (1-based), expanded from ranges like "1-3, 8-11". */
  requestedOffDays: number[];
  /**
   * Preferred assignment, by role:
   *  - MA  → their default provider (a `receivesMas` staff id).
   *  - PCC → their default coverage target (a `needsPcc` staff id).
   * When the person and their target are both working at the SAME location that
   * day, the engine assigns them together before any balancing. null = no default.
   */
  defaultTargetId: string | null;
  /** Provider only: this provider should be filled to 2 MAs before even distribution. */
  wantsTwoMas: boolean;
  /** Provider only: both needs coverage when out and can cover others when in. */
  coverage: boolean;
  /** Provider only: fill-order rank (1 = highest). Defaults from the seeded priority. */
  providerRank: number | null;
  /** MOD rank (1 = highest). The highest-ranked working person becomes MOD. null = not MOD-eligible. */
  modRank: number | null;
  /** Shipping rank (1 = highest). The highest-ranked working person gets shipping. null = not eligible. */
  shippingRank: number | null;
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
  /**
   * Patterns for every calendar month the rendered weeks touch. A month is shown
   * as whole Mon–Fri weeks, so the trailing days spill into the next calendar
   * month; include that month's patterns too. Each date resolves against the
   * pattern whose `month` matches the date's calendar month.
   */
  patterns: MonthlyPattern[];
  /** Any date within the target month. */
  month: Date;
  /** ISO dates (yyyy-MM-dd) that are office holidays — no staff are scheduled. */
  holidays?: Set<string>;
}

export interface GenerateMonthResult {
  assignments: Assignment[];
  warnings: Warning[];
}

/** Mutable per-day working set, keyed by staffId. */
export type DayMap = Map<string, Assignment>;
