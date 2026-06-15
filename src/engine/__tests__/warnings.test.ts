import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import { assignCoverage } from '../coverage';
import { assignMAs } from '../assignMAs';
import { assignPCCs } from '../assignPCCs';
import { computeWarnings } from '../warnings';
import type { Assignment, MonthlyPattern, WarningType } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff } from './patterns.fixture';

const staff = buildRoster();

function fullDay(patterns: MonthlyPattern[]): Assignment[] {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
  assignMod(day, staff);
  assignCoverage(day, staff, {});
  assignMAs(day, staff);
  assignPCCs(day, staff);
  return [...day.values()];
}

function types(patterns: MonthlyPattern[]): WarningType[] {
  return computeWarnings('2026-06-01', fullDay(patterns), staff).map((w) => w.type);
}

describe('Step 9 — warnings', () => {
  it('produces no warnings for a fully-staffed day', () => {
    expect(types(allWorking(staff))).toEqual([]);
  });

  it('warns when no MOD is designated', () => {
    let patterns = makeOff(allWorking(staff), 'keahi');
    patterns = makeOff(patterns, 'sara');
    patterns = makeOff(patterns, 'reina');
    expect(types(patterns)).toContain('no_mod');
  });

  it('warns when a working provider has no MA', () => {
    // Too few MAs to cover all providers: leave only one MA working.
    let patterns = allWorking(staff);
    for (const id of ['sandra', 'huaka', 'sarai', 'mya', 'puuwai', 'sena', 'alana', 'braelynn', 'jordyn']) {
      patterns = makeOff(patterns, id);
    }
    expect(types(patterns)).toContain('provider_no_ma');
  });

  it('warns when an out provider (not Steph/Shama) has no coverage', () => {
    // Monica out; every eligible coverer also out.
    let patterns = allWorking(staff);
    for (const id of ['monica', 'tricia', 'natalie', 'kendra', 'shama']) patterns = makeOff(patterns, id);
    expect(types(patterns)).toContain('out_provider_no_coverage');
  });

  it('does not warn when Steph is out (never needs coverage)', () => {
    const patterns = makeOff(allWorking(staff), 'steph');
    expect(types(patterns)).not.toContain('out_provider_no_coverage');
  });

  it('warns on an MA assigned to a provider at a different location', () => {
    const day = fullDay(allWorking(staff));
    const ma = day.find((a) => a.assignedProviderId === 'tricia');
    expect(ma).toBeDefined();
    ma!.location = ma!.location === 'kona' ? 'waimea' : 'kona';
    const w = computeWarnings('2026-06-01', day, staff).map((x) => x.type);
    expect(w).toContain('ma_location_mismatch');
  });

  it('warns when a coverage target has no PCC', () => {
    let patterns = allWorking(staff);
    for (const id of ['wendy', 'kalea', 'ellis', 'christie', 'raella', 'maile']) {
      patterns = makeOff(patterns, id);
    }
    expect(types(patterns)).toContain('target_no_pcc');
  });
});
