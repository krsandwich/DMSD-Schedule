import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  isMonday,
  startOfMonth,
} from 'date-fns';
import { resolveAttendance } from './attendance';
import { assignMod } from './mod';
import { assignCoverage } from './coverage';
import { assignMAs } from './assignMAs';
import { assignPCCs } from './assignPCCs';
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
 * later steps depend on earlier ones. The weekly coverage counter that drives
 * even coverage distribution resets every Monday.
 */
export function generateMonth(input: GenerateMonthInput): GenerateMonthResult {
  const { staff, patterns, month } = input;

  const patternsByStaff = indexPatterns(patterns);
  const assignments: Assignment[] = [];
  const warnings: GenerateMonthResult['warnings'] = [];

  let weeklyCoverage: Record<string, number> = {};

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  for (const date of days) {
    const weekday = getDay(date); // 0 = Sun .. 6 = Sat
    if (weekday === 0 || weekday === 6) continue; // Mon–Fri only

    if (isMonday(date)) weeklyCoverage = {}; // reset every Monday

    const isoDate = format(date, 'yyyy-MM-dd');
    const dayOfMonth = getDate(date);

    // Step 1 — Attendance & locations.
    const day = resolveAttendance(isoDate, dayOfMonth, weekday, staff, patternsByStaff);
    // Step 2 — MOD.
    assignMod(day, staff);
    // Step 3 — Provider coverage.
    assignCoverage(day, staff, weeklyCoverage);
    // Step 4 — Assign MAs.
    assignMAs(day, staff);
    // Step 5 — Assign PCCs / Aesthetic Concierge.
    assignPCCs(day, staff);

    const dayAssignments = [...day.values()];
    assignments.push(...dayAssignments);
    // Step 9 — Warnings.
    warnings.push(...computeWarnings(isoDate, dayAssignments, staff));
  }

  return { assignments, warnings };
}

function indexPatterns(patterns: MonthlyPattern[]): Map<string, MonthlyPattern> {
  const map = new Map<string, MonthlyPattern>();
  for (const p of patterns) map.set(p.staffId, p);
  return map;
}
