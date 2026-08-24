import { describe, expect, it } from 'vitest';
import { resolveAttendance } from '../attendance';
import { assignMod } from '../mod';
import { assignMAs } from '../assignMAs';
import { assignPCCs } from '../assignPCCs';
import { computeWarnings } from '../warnings';
import type { Assignment, MonthlyPattern, WarningType } from '../types';
import { buildRoster } from './roster.fixture';
import { allWorking, makeOff } from './patterns.fixture';

const staff = buildRoster();

function fullDay(patterns: MonthlyPattern[]): { assignments: Assignment[]; index: Map<string, MonthlyPattern> } {
  const index = new Map(patterns.map((p) => [p.staffId, p]));
  const day = resolveAttendance('2026-06-01', 1, 1, staff, index);
  assignMod(day, staff, index);
  assignMAs(day, staff, index);
  assignPCCs(day, staff, index);
  return { assignments: [...day.values()], index };
}

function types(patterns: MonthlyPattern[]): WarningType[] {
  const { assignments, index } = fullDay(patterns);
  return computeWarnings('2026-06-01', assignments, staff, index).map((w) => w.type);
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
    const { assignments, index } = fullDay(allWorking(staff));
    const ma = assignments.find((a) => a.assignedProviderId === 'tricia');
    expect(ma).toBeDefined();
    ma!.location = ma!.location === 'kona' ? 'waimea' : 'kona';
    const w = computeWarnings('2026-06-01', assignments, staff, index).map((x) => x.type);
    expect(w).toContain('ma_location_mismatch');
  });

  it('warns when more than one person is designated MOD', () => {
    // Simulates a person being regenerated independently: their own row picks a
    // fresh MOD without clearing whoever else already held it (see
    // useReplacePersonMonth), so two rows can end up isMod: true for the same day.
    const { assignments, index } = fullDay(allWorking(staff));
    const currentMod = assignments.find((a) => a.isMod);
    expect(currentMod).toBeDefined();
    const other = assignments.find((a) => !a.isMod && a.staffId !== currentMod!.staffId);
    expect(other).toBeDefined();
    const withTwoMods = assignments.map((a) =>
      a.staffId === other!.staffId ? { ...a, isMod: true } : a,
    );
    const types = computeWarnings('2026-06-01', withTwoMods, staff, index).map((w) => w.type);
    expect(types).toContain('multiple_mod');
    expect(types).not.toContain('no_mod');
  });

  it('warns on a PCC/concierge assigned to cover a target at a different location', () => {
    const { assignments, index } = fullDay(allWorking(staff));
    const pcc = assignments.find((a) => a.pccCoversIds.length > 0);
    expect(pcc).toBeDefined();
    const target = pcc!.pccCoversIds[0];
    const targetAssignment = assignments.find((a) => a.staffId === target);
    expect(targetAssignment).toBeDefined();
    targetAssignment!.location = targetAssignment!.location === 'kona' ? 'waimea' : 'kona';
    const types = computeWarnings('2026-06-01', assignments, staff, index).map((w) => w.type);
    expect(types).toContain('pcc_location_mismatch');
  });

  it('warns when a coverage target has no PCC', () => {
    let patterns = allWorking(staff);
    for (const id of ['wendy', 'kalea', 'ellis', 'christie', 'raella', 'maile']) {
      patterns = makeOff(patterns, id);
    }
    expect(types(patterns)).toContain('target_no_pcc');
  });

  it('does not flag an esthetician who is standing in as an MA or PCC', () => {
    // No PCC / concierge working, so every target would otherwise be uncovered.
    let patterns = allWorking(staff);
    for (const id of ['wendy', 'kalea', 'ellis', 'christie', 'raella', 'maile']) {
      patterns = makeOff(patterns, id);
    }
    const { assignments, index } = fullDay(patterns);
    const flagged = (list: Assignment[], id: string) =>
      computeWarnings('2026-06-01', list, staff, index).some(
        (w) => w.type === 'target_no_pcc' && w.refKey === id,
      );

    // Baseline: Shania is flagged as an uncovered target.
    expect(flagged(assignments, 'shania')).toBe(true);

    // Standing in as an MA (assigned to a provider) clears her own-PCC flag…
    const asMa = assignments.map((a) =>
      a.staffId === 'shania' ? { ...a, assignedProviderId: 'tricia', maSlot: 1 } : a,
    );
    expect(flagged(asMa, 'shania')).toBe(false);

    // …as does standing in as a PCC (covering someone).
    const asPcc = assignments.map((a) =>
      a.staffId === 'shania' ? { ...a, pccCoversIds: ['monica'] } : a,
    );
    expect(flagged(asPcc, 'shania')).toBe(false);
    // Mia, who isn't standing in, is still flagged.
    expect(flagged(asPcc, 'mia')).toBe(true);
  });
});
