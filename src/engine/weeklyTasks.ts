/** Number of weekly tasks to hand out (#1..#6). */
export const WEEKLY_TASK_COUNT = 6;

/**
 * Deterministic weekly task rotation.
 *
 * Given a continuous week index (e.g. the ISO week number) and the eligible MAs
 * in a STABLE order, assign task numbers 1..{@link WEEKLY_TASK_COUNT} to a window
 * of the list that slides by one each week. Because the caller rebuilds `eligible`
 * from the current roster every week, MAs added to the roster join the rotation
 * automatically, and MAs off the whole week (or MOD-eligible) are simply absent
 * from the list.
 *
 * Returns a Map of staffId → task number. If fewer than 6 MAs are eligible, only
 * that many tasks are handed out; if none, the map is empty.
 */
export function assignWeeklyTasks(weekIndex: number, eligible: string[]): Map<string, number> {
  const result = new Map<string, number>();
  const n = eligible.length;
  if (n === 0) return result;

  const offset = ((weekIndex % n) + n) % n; // safe for any (incl. negative) index
  for (let t = 0; t < WEEKLY_TASK_COUNT && t < n; t++) {
    result.set(eligible[(offset + t) % n], t + 1);
  }
  return result;
}
