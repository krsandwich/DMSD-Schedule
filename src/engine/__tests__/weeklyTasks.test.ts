import { describe, expect, it } from 'vitest';
import { assignWeeklyTasks, WEEKLY_TASK_COUNT } from '../weeklyTasks';

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // 7 eligible MAs

describe('assignWeeklyTasks — weekly rotation', () => {
  it('hands out tasks #1..#6 to the first six in order', () => {
    const map = assignWeeklyTasks(0, POOL);
    expect([...map.entries()]).toEqual([
      ['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5], ['f', 6],
    ]);
    expect(map.has('g')).toBe(false); // only 6 tasks
  });

  it('shifts the window by one each week', () => {
    const wk1 = assignWeeklyTasks(1, POOL);
    expect(wk1.get('b')).toBe(1);
    expect(wk1.get('g')).toBe(6);
    expect(wk1.has('a')).toBe(false); // a rotated out this week
  });

  it('wraps around the end of the list', () => {
    // offset 6 in a 7-long list: g(#1), a(#2), b(#3), c(#4), d(#5), e(#6); f unused.
    const map = assignWeeklyTasks(6, POOL);
    expect(map.get('g')).toBe(1);
    expect(map.get('a')).toBe(2);
    expect(map.get('e')).toBe(6);
    expect(map.has('f')).toBe(false);
  });

  it('includes a newly added MA in the rotation automatically', () => {
    const withNew = [...POOL, 'newbie'];
    // At an offset that reaches the end, the new MA can receive a task.
    const map = assignWeeklyTasks(7, withNew); // n=8, offset 7 -> starts at 'newbie'
    expect(map.get('newbie')).toBe(1);
  });

  it('hands out only as many tasks as there are eligible MAs', () => {
    const map = assignWeeklyTasks(0, ['x', 'y', 'z']);
    expect(map.size).toBe(3);
    expect([...map.values()].sort()).toEqual([1, 2, 3]);
  });

  it('returns an empty map when nobody is eligible', () => {
    expect(assignWeeklyTasks(3, []).size).toBe(0);
  });

  it('never assigns a task number above the cap', () => {
    const map = assignWeeklyTasks(2, POOL);
    for (const n of map.values()) expect(n).toBeLessThanOrEqual(WEEKLY_TASK_COUNT);
  });
});
