import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import type { MonthlyPattern } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff } from './patterns.fixture';

function dayFrom(patterns: MonthlyPattern[], staff = buildRoster()) {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  return resolveAttendance('2026-06-01', 1, 1, staff, index);
}

describe('Step 2 — MOD', () => {
  const staff = buildRoster();

  it('picks the highest-priority working MOD-eligible person (Keahi)', () => {
    const day = dayFrom(allWorking(staff));
    const modId = assignMod(day, staff);
    expect(modId).toBe('keahi');
    expect(day.get('keahi')?.isMod).toBe(true);
  });

  it('falls back to Sara when Keahi is off', () => {
    const day = dayFrom(makeOff(allWorking(staff), 'keahi'));
    expect(assignMod(day, staff)).toBe('sara');
  });

  it('falls back to Reina when Keahi and Sara are off', () => {
    let patterns = makeOff(allWorking(staff), 'keahi');
    patterns = makeOff(patterns, 'sara');
    const day = dayFrom(patterns);
    expect(assignMod(day, staff)).toBe('reina');
  });

  it('returns null when no MOD-eligible person is working', () => {
    let patterns = makeOff(allWorking(staff), 'keahi');
    patterns = makeOff(patterns, 'sara');
    patterns = makeOff(patterns, 'reina');
    const day = dayFrom(patterns);
    expect(assignMod(day, staff)).toBeNull();
  });

  it('keeps MOD standalone — not placed under a provider', () => {
    const day = dayFrom(allWorking(staff));
    assignMod(day, staff);
    const keahi = day.get('keahi');
    expect(keahi?.assignedProviderId).toBeNull();
    expect(keahi?.maSlot).toBeNull();
  });
});
