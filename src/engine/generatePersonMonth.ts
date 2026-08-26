import { eachDayOfInterval, format, getDay, parseISO } from 'date-fns';
import { resolveAttendance } from './attendance';
import { assignMod } from './mod';
import { assignCoverage } from './coverage';
import { assignMAs } from './assignMAs';
import { assignPCCs } from './assignPCCs';
import { assignShipping } from './shipping';
import { assignInventory, isLastWeekdayOfMonth } from './inventory';
import { monthWeekInterval, patternsByStaffMap, weekBlockFor } from './generateMonth';
import type { Assignment, GeneratePersonMonthInput } from './types';

/**
 * Generate ONE person's assignments for a month, treating every OTHER staff
 * member's currently-persisted assignment as locked/real and left exactly as
 * it is. Used to add a newly-hired person (or re-run one person) into an
 * already-generated, hand-edited month without disturbing anyone else's rows.
 *
 * Mirrors `generateMonth`'s day loop and month-week range, but before running
 * Steps 2-6 each day, overlays the freshly-resolved attendance with the real
 * persisted row for everyone except the target. `assignMAs`/`assignCoverage`/
 * `assignPCCs` seed their counts from whatever's already on the day map (see
 * their own comments), so a provider/coverer/PCC who already has real load
 * is correctly treated as already-partly-or-fully satisfied instead of
 * looking untouched — which is what made independent per-person runs pile
 * every new MA onto the same top-priority provider before this existed.
 */
export function generatePersonMonth(input: GeneratePersonMonthInput): Assignment[] {
  const { staffId, staff, patterns, month, holidays, existingAssignments } = input;

  const patternsByStaff = patternsByStaffMap(patterns);
  const existingByDate = indexExistingByDate(existingAssignments);
  const results: Assignment[] = [];
  const coverageCount: Record<string, number> = {};

  const interval = monthWeekInterval(month);
  const days = eachDayOfInterval(interval);

  for (const date of days) {
    const weekday = getDay(date); // 0 = Sun .. 6 = Sat
    if (weekday === 0 || weekday === 6) continue; // Mon–Fri only

    const isoDate = format(date, 'yyyy-MM-dd');
    if (holidays?.has(isoDate)) continue; // office closed: no staff, no warnings

    const weekBlock = weekBlockFor(date, interval.start);

    // Step 1 — Attendance & locations (fresh for everyone, including the target).
    const day = resolveAttendance(isoDate, weekday, staff, patternsByStaff, weekBlock);

    // Lock everyone else to their real persisted state for this day.
    const existingToday = existingByDate.get(isoDate);
    let alreadyHasMod = false;
    if (existingToday) {
      for (const [id, real] of existingToday) {
        if (id === staffId) continue;
        day.set(id, { ...real });
        if (real.isMod) alreadyHasMod = true;
      }
    }

    // Step 2 — MOD: only decide if nobody already holds it today — re-picking
    // would risk a duplicate MOD (see warnings.ts `multiple_mod`) rather than
    // fixing anything, since MOD reassignment isn't what this is for.
    if (!alreadyHasMod) assignMod(day, staff, patternsByStaff);
    // Step 3 — Provider coverage (already-covered absentees and already-loaded
    // coverers are correctly respected — see coverage.ts).
    assignCoverage(day, staff, patternsByStaff, coverageCount);
    // Step 4 — Assign MAs (already-full providers are correctly respected —
    // see assignMAs.ts).
    assignMAs(day, staff, patternsByStaff);
    // Step 5 — Assign PCCs / Aesthetic Concierge (already-covered targets and
    // already-loaded PCCs are correctly respected — see assignPCCs.ts).
    assignPCCs(day, staff, patternsByStaff);
    // Step 5.5 — Inventory Day (last weekday of the month only; already-decided
    // locations — locked or from this same call — are left alone).
    if (isLastWeekdayOfMonth(parseISO(isoDate))) assignInventory(day, staff);
    // Step 6 — Shipping (not an exclusive resource; safe to recompute).
    assignShipping(day, staff, patternsByStaff);

    const mine = day.get(staffId);
    if (mine) results.push(mine);
  }

  return results;
}

/** Group existing assignments by ISO date → (staffId → Assignment). */
function indexExistingByDate(assignments: Assignment[]): Map<string, Map<string, Assignment>> {
  const byDate = new Map<string, Map<string, Assignment>>();
  for (const a of assignments) {
    let byStaff = byDate.get(a.date);
    if (!byStaff) {
      byStaff = new Map();
      byDate.set(a.date, byStaff);
    }
    byStaff.set(a.staffId, a);
  }
  return byDate;
}
