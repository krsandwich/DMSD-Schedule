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
  | 'aesthetic_concierge'
  | 'intern';

export type Location = 'kona' | 'waimea' | 'remote' | 'off';

/**
 * A monthly-setup weekday choice. Either a fixed {@link Location}, or a two-week
 * alternating pattern:
 *  - `'alternating'`  → Kona for the first two weeks of the month, Waimea for the
 *    next two, repeating (Kona / Waimea).
 *  - `'waimea_kona'`  → the reverse (Waimea / Kona).
 * These are resolved to a concrete location per-day in Step 1 from the two-week
 * block index; they never reach a daily assignment.
 */
export type WeekdayLocation = Location | 'alternating' | 'waimea_kona';

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
  /**
   * ISO dates (yyyy-MM-dd), expanded from ranges like "1-3, 8-11" (bare
   * numbers default to this pattern's own month) or "12/1-12/5" (explicit
   * month/day — used to reach a trailing spillover date that's still part of
   * this row's own displayed week range). Real calendar dates, not day-of-month
   * offsets, so this same row also governs its month's spillover days —
   * there's no separate next-month row to maintain.
   */
  requestedOffDates: string[];
  /**
   * Additional working days (ISO dates, same "1-3" / "12/1-12/5" parsing as
   * {@link requestedOffDates}) — the inverse of requestedOffDates. On these
   * days the person works at {@link additionalDaysLocation}, overriding their
   * usual weekday pattern and any requested-off. Empty = none.
   */
  additionalDaysDates: string[];
  /**
   * Location for {@link additionalDaysDates}. null or `'off'` means the additional
   * days have no effect. `'alternating'` / `'waimea_kona'` resolve by two-week
   * block like a weekday.
   */
  additionalDaysLocation: WeekdayLocation | null;
  /**
   * Preferred assignment, by role:
   *  - MA     → their default provider (a `receivesMas` staff id).
   *  - PCC    → their default coverage target (a `needsPcc` staff id).
   *  - Intern → the MA they shadow this month (a `role === 'ma'` staff id).
   *             Purely informational (shown on the calendar) — the engine
   *             does not auto-assign interns anywhere.
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
  /**
   * Inventory Day duty. Auto-assigned to one MA and one PCC-tier person per
   * location on the last weekday of the month (see inventory.ts); also
   * manually toggleable any day in the tile editor.
   */
  isInventory: boolean;
  /** MA-only manual flag: they were scheduled but didn't show up. Renders the
   * tile light red instead of their usual location color. Purely manual —
   * never set by generation. */
  isMissedShift: boolean;
  customText: string | null;
  /**
   * Weekly task # (#1–6) override. null = use the automatic per-week rotation
   * (see weeklyTasks.ts); a number pins this MA's weekly task badge for the week.
   */
  weeklyTaskNo: number | null;
}

export type WarningType =
  | 'no_mod'
  | 'multiple_mod'
  | 'provider_no_ma'
  | 'provider_too_many_ma'
  | 'out_provider_no_coverage'
  | 'ma_location_mismatch'
  | 'target_no_pcc'
  | 'pcc_location_mismatch'
  | 'inventory_ma_missing'
  | 'inventory_pcc_missing'
  | 'pattern_out_of_sync';

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
   * This month's own patterns (one row per staff member for `month`). A month
   * is shown as whole Mon–Fri weeks, so the view's trailing days spill into
   * the next calendar month — those days are governed by this SAME set of
   * patterns too (via real ISO dates in `requestedOffDates` /
   * `additionalDaysDates` that can point past this row's own month), not a
   * separate next-month row.
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

export interface GeneratePersonMonthInput {
  staffId: string;
  staff: Staff[];
  patterns: MonthlyPattern[];
  month: Date;
  holidays?: Set<string>;
  /**
   * The month's currently-persisted assignments. Every staff member OTHER
   * than `staffId` is treated as locked/real and left exactly as-is; only
   * `staffId`'s own slot (MA/PCC/MOD/coverage placement) is computed fresh,
   * correctly aware of who's already assigned rather than re-simulating the
   * whole day from scratch.
   */
  existingAssignments: Assignment[];
}

/** Mutable per-day working set, keyed by staffId. */
export type DayMap = Map<string, Assignment>;
