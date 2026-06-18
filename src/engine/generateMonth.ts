import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  getISOWeek,
  startOfMonth,
  subDays,
} from 'date-fns';
import { resolveAttendance } from './attendance';
import { assignMod } from './mod';
import { assignCoverage } from './coverage';
import { assignMAs } from './assignMAs';
import { assignPCCs } from './assignPCCs';
import { assignShipping } from './shipping';
import { computeWarnings } from './warnings';
import type {
  Assignment,
  GenerateMonthInput,
  GenerateMonthResult,
  MonthlyPattern,
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

  // Patterns indexed by staff AND calendar month, so trailing days that spill into
  // the next month resolve against that month's pattern (not the current month's).
  const patternsByMonth = indexPatternsByMonth(patterns);
  const assignments: Assignment[] = [];
  const warnings: GenerateMonthResult['warnings'] = [];

  // Running coverage count per coverer, for even distribution across the month.
  const coverageCount: Record<string, number> = {};

  const days = eachDayOfInterval(monthWeekInterval(month));

  for (const date of days) {
    const weekday = getDay(date); // 0 = Sun .. 6 = Sat
    if (weekday === 0 || weekday === 6) continue; // Mon–Fri only

    const isoDate = format(date, 'yyyy-MM-dd');
    if (holidays?.has(isoDate)) continue; // office closed: no staff, no warnings

    const dayOfMonth = getDate(date);
    // Parity of the ISO week number drives 'alternating' (Kona/Waimea) locations,
    // so the alternation is continuous across month boundaries.
    const weekParity = (getISOWeek(date) % 2) as 0 | 1;

    const patternsByStaff = patternsByMonth.get(format(startOfMonth(date), 'yyyy-MM-dd')) ?? EMPTY;

    // Step 1 — Attendance & locations.
    const day = resolveAttendance(isoDate, dayOfMonth, weekday, staff, patternsByStaff, weekParity);
    // Step 2 — MOD.
    assignMod(day, staff, patternsByStaff);
    // Step 3 — Provider coverage (even across the month).
    assignCoverage(day, staff, patternsByStaff, coverageCount);
    // Step 4 — Assign MAs.
    assignMAs(day, staff, patternsByStaff);
    // Step 5 — Assign PCCs / Aesthetic Concierge.
    assignPCCs(day, staff, patternsByStaff);
    // Step 6 — Shipping (MOD is the backup when no one is ranked).
    assignShipping(day, staff, patternsByStaff);

    const dayAssignments = [...day.values()];
    assignments.push(...dayAssignments);
    // Step 7 — Warnings.
    warnings.push(...computeWarnings(isoDate, dayAssignments, staff, patternsByStaff));
  }

  return { assignments, warnings };
}

const EMPTY: Map<string, MonthlyPattern> = new Map();

/** Group patterns by calendar month → (staffId → pattern). */
function indexPatternsByMonth(
  patterns: MonthlyPattern[],
): Map<string, Map<string, MonthlyPattern>> {
  const byMonth = new Map<string, Map<string, MonthlyPattern>>();
  for (const p of patterns) {
    // p.month is already a first-of-month ISO key (yyyy-MM-dd).
    const monthKey = p.month.slice(0, 10);
    let byStaff = byMonth.get(monthKey);
    if (!byStaff) {
      byStaff = new Map();
      byMonth.set(monthKey, byStaff);
    }
    byStaff.set(p.staffId, p);
  }
  return byMonth;
}

/**
 * The month rendered as whole Mon–Fri weeks: from its first Monday through the
 * Friday of the week containing its last Monday. Kept in sync with
 * `monthWeekRange` in src/lib/dates.ts (the engine stays import-free of /lib).
 */
function monthWeekInterval(month: Date): { start: Date; end: Date } {
  let start = startOfMonth(month);
  while (getDay(start) !== 1) start = addDays(start, 1);
  let lastMonday = endOfMonth(month);
  while (getDay(lastMonday) !== 1) lastMonday = subDays(lastMonday, 1);
  return { start, end: addDays(lastMonday, 4) };
}
