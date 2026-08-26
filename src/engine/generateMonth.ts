import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';
import { resolveAttendance } from './attendance';
import { assignMod } from './mod';
import { assignCoverage } from './coverage';
import { assignMAs } from './assignMAs';
import { assignPCCs } from './assignPCCs';
import { assignShipping } from './shipping';
import { assignInventory, isLastWeekdayOfMonth } from './inventory';
import { computeWarnings } from './warnings';
import type {
  Assignment,
  GenerateMonthInput,
  GenerateMonthResult,
  MonthlyPattern,
  Staff,
  Warning,
} from './types';

/**
 * Entry point: generate a full month of daily staffing.
 *
 * Office operates Monday–Friday only. Steps run in order (see CLAUDE.md §6);
 * later steps depend on earlier ones. Provider coverage is auto-assigned from the
 * per-provider Coverage flag and distributed evenly across the whole month.
 */
export function generateMonth(input: GenerateMonthInput): GenerateMonthResult {
  const { staff, patterns, month, holidays } = input;

  // One row per staff member, used for EVERY date in the view — including
  // trailing spillover days, which are governed by this same month's own
  // patterns (via real dates in requestedOffDates/additionalDaysDates), not a
  // separate next-month row.
  const patternsByStaff = patternsByStaffMap(patterns);
  const assignments: Assignment[] = [];
  const warnings: GenerateMonthResult['warnings'] = [];

  // Running coverage count per coverer, for even distribution across the month.
  const coverageCount: Record<string, number> = {};

  const interval = monthWeekInterval(month);
  const days = eachDayOfInterval(interval);

  for (const date of days) {
    const weekday = getDay(date); // 0 = Sun .. 6 = Sat
    if (weekday === 0 || weekday === 6) continue; // Mon–Fri only

    const isoDate = format(date, 'yyyy-MM-dd');
    if (holidays?.has(isoDate)) continue; // office closed: no staff, no warnings

    const weekBlock = weekBlockFor(date, interval.start);

    const result = generateDayAssignments(isoDate, weekday, weekBlock, staff, patternsByStaff, coverageCount);
    assignments.push(...result.assignments);
    warnings.push(...result.warnings);
  }

  return { assignments, warnings };
}

/**
 * Run attendance through warnings for a single day (incl. Inventory Day on
 * the last weekday of the month). Shared by `generateMonth`'s day loop and
 * `generateSingleDay` (used to fill in one date when a holiday is un-marked
 * in Monthly Setup, without touching the rest of the month).
 */
export function generateDayAssignments(
  isoDate: string,
  weekday: number,
  weekBlock: 0 | 1,
  staff: Staff[],
  patternsByStaff: Map<string, MonthlyPattern>,
  coverageCount: Record<string, number>,
): { assignments: Assignment[]; warnings: Warning[] } {
  // Step 1 — Attendance & locations.
  const day = resolveAttendance(isoDate, weekday, staff, patternsByStaff, weekBlock);
  // Step 2 — MOD.
  assignMod(day, staff, patternsByStaff);
  // Step 3 — Provider coverage (even across the month).
  assignCoverage(day, staff, patternsByStaff, coverageCount);
  // Step 4 — Assign MAs.
  assignMAs(day, staff, patternsByStaff);
  // Step 5 — Assign PCCs / Aesthetic Concierge.
  assignPCCs(day, staff, patternsByStaff);
  // Step 5.5 — Inventory Day (last weekday of the month only).
  if (isLastWeekdayOfMonth(parseISO(isoDate))) assignInventory(day, staff);
  // Step 6 — Shipping (MOD is the backup when no one is ranked).
  assignShipping(day, staff, patternsByStaff);

  const dayAssignments = [...day.values()];
  // Step 7 — Warnings.
  const warnings = computeWarnings(isoDate, dayAssignments, staff, patternsByStaff);
  return { assignments: dayAssignments, warnings };
}

/** Index one month's patterns by staffId, for use across its entire displayed view. */
export function patternsByStaffMap(patterns: MonthlyPattern[]): Map<string, MonthlyPattern> {
  return new Map(patterns.map((p) => [p.staffId, p]));
}

/**
 * The month rendered as whole Mon–Fri weeks: from its first Monday through the
 * Friday of the week containing its last Monday. Kept in sync with
 * `monthWeekRange` in src/lib/dates.ts (the engine stays import-free of /lib).
 */
export function monthWeekInterval(month: Date): { start: Date; end: Date } {
  let start = startOfMonth(month);
  while (getDay(start) !== 1) start = addDays(start, 1);
  let lastMonday = endOfMonth(month);
  while (getDay(lastMonday) !== 1) lastMonday = subDays(lastMonday, 1);
  return { start, end: addDays(lastMonday, 4) };
}

/**
 * The two-week alternating block (0 or 1) a date falls in, counted continuously
 * from the view's first Monday (`viewStart`, i.e. `monthWeekInterval(month).start`)
 * — including trailing spillover days, which continue the same block sequence
 * rather than resetting. Weeks 0–1 → block 0, weeks 2–3 → block 1, weeks 4–5 →
 * block 0, and so on.
 */
export function weekBlockFor(date: Date, viewStart: Date): 0 | 1 {
  const weekIndex = Math.floor(differenceInCalendarDays(date, viewStart) / 7);
  return (Math.floor(weekIndex / 2) % 2) as 0 | 1;
}
