import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { MonthlyPattern, Staff, WeekdayLocation } from '@/engine/types';
import { useSession } from '@/hooks/useSession';
import { useStaff } from '@/hooks/useStaff';
import { useMonthlyPatterns, useSavePattern } from '@/hooks/useMonthlyPatterns';
import { useMonthHolidays, useSaveHolidays } from '@/hooks/useMonthHolidays';
import { format } from 'date-fns';
import { monthLabel, nextMonth, previousMonth } from '@/lib/dates';
import { formatDayRanges, parseDayRanges } from '@/lib/dayRanges';
import { SELECTABLE_WEEKDAY_LOCATIONS, WEEKDAY_LOCATION_LABEL } from '@/lib/locations';
import { WEEKDAY_LABELS } from '@/lib/dates';
import { ROLE_LABEL, isSupportRole, roleRank } from '@/lib/roles';
import {
  defaultCoverage,
  defaultModRank,
  defaultProviderRank,
  defaultShippingRank,
  defaultTargetName,
  defaultWantsTwoMas,
  defaultWeekdayLocations,
} from '@/lib/defaultPatterns';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';

/** Pull a human-readable message out of an Error or a Supabase PostgrestError object. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: string; details?: string; hint?: string; code?: string };
    return [o.message, o.details, o.hint, o.code ? `(${o.code})` : '']
      .filter(Boolean)
      .join(' — ') || JSON.stringify(e);
  }
  return String(e);
}

type WeekdayChoice = WeekdayLocation; // 'off' means not working that weekday
interface Draft {
  byWeekday: Record<number, WeekdayChoice>;
  offText: string;
  /** MA -> default provider id; PCC/concierge -> default target id; null = none. */
  defaultTargetId: string | null;
  /** Provider only: fill to 2 MAs first. */
  wantsTwoMas: boolean;
  /** Provider only: need + provide coverage. */
  coverage: boolean;
  /** Provider only: fill-order rank. */
  providerRank: number | null;
  modRank: number | null;
  shippingRank: number | null;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

function emptyDraft(): Draft {
  return {
    byWeekday: { 1: 'off', 2: 'off', 3: 'off', 4: 'off', 5: 'off' },
    offText: '',
    defaultTargetId: null,
    wantsTwoMas: false,
    coverage: false,
    providerRank: null,
    modRank: null,
    shippingRank: null,
  };
}

/** Seeded default Provider/target staff id for a person (null if none). */
function defaultTargetId(displayName: string, idByName: Map<string, string>): string | null {
  const name = defaultTargetName(displayName);
  return name ? idByName.get(name) ?? null : null;
}

/** Standard schedule pre-fill for a person with no saved pattern this month. */
function defaultDraft(s: Staff, idByName: Map<string, string>): Draft {
  const draft = emptyDraft();
  const defaults = defaultWeekdayLocations(s.displayName);
  for (const wd of WEEKDAYS) {
    const loc = defaults[wd];
    if (loc) draft.byWeekday[wd] = loc;
  }
  draft.defaultTargetId = defaultTargetId(s.displayName, idByName);
  draft.wantsTwoMas = defaultWantsTwoMas(s.displayName);
  draft.coverage = defaultCoverage(s.displayName);
  draft.providerRank = defaultProviderRank(s.displayName);
  draft.modRank = defaultModRank(s.displayName);
  draft.shippingRank = defaultShippingRank(s.displayName);
  return draft;
}

function draftFromPattern(p: MonthlyPattern, s: Staff, idByName: Map<string, string>): Draft {
  const byWeekday: Record<number, WeekdayChoice> = { 1: 'off', 2: 'off', 3: 'off', 4: 'off', 5: 'off' };
  for (const wd of p.usualWeekdays) byWeekday[wd] = p.locationByWeekday[String(wd)] ?? 'off';
  return {
    byWeekday,
    offText: formatDayRanges(p.requestedOffDays),
    wantsTwoMas: p.wantsTwoMas,
    coverage: p.coverage,
    // Fall back to the seeded defaults for rows saved before these fields existed.
    defaultTargetId: p.defaultTargetId ?? defaultTargetId(s.displayName, idByName),
    providerRank: p.providerRank ?? defaultProviderRank(s.displayName),
    modRank: p.modRank ?? defaultModRank(s.displayName),
    shippingRank: p.shippingRank ?? defaultShippingRank(s.displayName),
  };
}

export function MonthlySetupPage() {
  const { isEditor } = useSession();
  const [month, setMonth] = useState(() => new Date());

  const staffQuery = useStaff();
  const patternsQuery = useMonthlyPatterns(month);
  const priorPatternsQuery = useMonthlyPatterns(previousMonth(month));
  const savePattern = useSavePattern(month);
  const holidaysQuery = useMonthHolidays(month);
  const saveHolidays = useSaveHolidays(month);

  const staff = useMemo(
    () =>
      [...(staffQuery.data ?? [])].sort(
        (a, b) => roleRank(a.role) - roleRank(b.role) || a.displayName.localeCompare(b.displayName),
      ),
    [staffQuery.data],
  );
  // Provider dropdown options (shared by MAs and support roles), constant order.
  const providers = useMemo(
    () => staff.filter((s) => s.receivesMas).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [staff],
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [holidayText, setHolidayText] = useState('');
  const [status, setStatus] = useState('');

  // Load the month's holidays into the editable field.
  useEffect(() => {
    if (!holidaysQuery.data) return;
    setHolidayText(formatDayRanges(holidaysQuery.data));
  }, [holidaysQuery.data]);

  // Initialise drafts from existing patterns (or empty).
  useEffect(() => {
    if (!staff.length || !patternsQuery.data) return;
    const byStaff = new Map(patternsQuery.data.map((p) => [p.staffId, p]));
    const idByName = new Map(staff.map((x) => [x.displayName, x.id]));
    const next: Record<string, Draft> = {};
    for (const s of staff) {
      const p = byStaff.get(s.id);
      next[s.id] = p ? draftFromPattern(p, s, idByName) : defaultDraft(s, idByName);
    }
    setDrafts(next);
  }, [staff, patternsQuery.data]);

  if (!isEditor) return <Navigate to="/" replace />;
  if (staffQuery.isLoading || patternsQuery.isLoading) return <Spinner />;

  const setChoice = (staffId: string, wd: number, value: WeekdayChoice) =>
    setDrafts((d) => ({
      ...d,
      [staffId]: { ...d[staffId], byWeekday: { ...d[staffId].byWeekday, [wd]: value } },
    }));

  const setField = (staffId: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [staffId]: { ...d[staffId], ...patch } }));

  const setOffText = (staffId: string, offText: string) => setField(staffId, { offText });

  const setDefaultChoice = (staffId: string, value: string) =>
    setField(staffId, { defaultTargetId: value || null });

  const parseRank = (value: string): number | null => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  };

  // Carry forward usual weekdays + locations from the prior month (not time off).
  const carryForward = () => {
    const prior = priorPatternsQuery.data;
    if (!prior?.length) {
      setStatus('No prior month to carry forward from.');
      return;
    }
    const byStaff = new Map(prior.map((p) => [p.staffId, p]));
    const idByName = new Map(staff.map((x) => [x.displayName, x.id]));
    setDrafts((current) => {
      const next = { ...current };
      for (const s of staff) {
        const p = byStaff.get(s.id);
        if (!p) continue;
        const d = draftFromPattern(p, s, idByName);
        // Carry weekday patterns + defaults/ranks; keep this month's requested time off.
        next[s.id] = { ...d, offText: current[s.id]?.offText ?? '' };
      }
      return next;
    });
    setStatus('Carried forward weekday patterns from ' + monthLabel(previousMonth(month)) + '.');
  };

  const draftToPattern = (s: Staff, d: Draft): MonthlyPattern => {
    const usualWeekdays: number[] = [];
    const locationByWeekday: Record<string, WeekdayLocation> = {};
    for (const wd of WEEKDAYS) {
      const loc = d.byWeekday[wd];
      if (loc !== 'off') {
        usualWeekdays.push(wd);
        locationByWeekday[String(wd)] = loc;
      }
    }
    return {
      staffId: s.id,
      month: '',
      usualWeekdays,
      locationByWeekday,
      requestedOffDays: parseDayRanges(d.offText),
      defaultTargetId: d.defaultTargetId,
      wantsTwoMas: d.wantsTwoMas,
      coverage: d.coverage,
      providerRank: d.providerRank,
      modRank: d.modRank,
      shippingRank: d.shippingRank,
    };
  };

  const saveAll = async () => {
    setStatus('Saving…');
    try {
      await saveHolidays.mutateAsync(parseDayRanges(holidayText));
      for (const s of staff) {
        const d = drafts[s.id];
        if (!d) continue;
        await savePattern.mutateAsync(draftToPattern(s, d));
      }
      setStatus('Saved all patterns for ' + monthLabel(month) + '.');
    } catch (e) {
      setStatus('Save failed: ' + errorMessage(e));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link to="/">
          <Button variant="ghost">‹ Calendar</Button>
        </Link>
        <h1 className="text-sm font-semibold">Monthly setup</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => setMonth(previousMonth(month))}>
            ‹
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</span>
          <Button variant="ghost" onClick={() => setMonth(nextMonth(month))}>
            ›
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-xs text-gray-500">{status}</span>}
          <Button variant="secondary" onClick={carryForward}>
            Carry forward
          </Button>
          <Button onClick={saveAll} disabled={savePattern.isPending}>
            Save all
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <span className="text-lg leading-none">🎉</span>
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-amber-800">
              Holidays — {format(month, 'MMM yyyy')}
            </label>
            <input
              className="mt-2 w-48 rounded border border-amber-300 px-2 py-1 text-sm"
              value={holidayText}
              placeholder="1, 4-5"
              onChange={(e) => setHolidayText(e.target.value)}
            />
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="p-2">Staff</th>
              {WEEKDAY_LABELS.map((l) => (
                <th key={l} className="p-2">
                  {l}
                </th>
              ))}
              <th className="p-2">Requested off {format(month, 'MMM yyyy')}</th>
              <th className="p-2">Defaults &amp; ranks</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s, i) => {
              const d = drafts[s.id] ?? emptyDraft();
              const showGroupHeader = i === 0 || staff[i - 1].role !== s.role;
              return (
                <Fragment key={s.id}>
                  {showGroupHeader && (
                    <tr className="bg-gray-50">
                      <td
                        colSpan={WEEKDAYS.length + 3}
                        className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {ROLE_LABEL[s.role]}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-gray-100">
                    <td className="p-2 font-medium">{s.displayName}</td>
                  {WEEKDAYS.map((wd) => (
                    <td key={wd} className="p-2">
                      <select
                        className="rounded border border-gray-300 px-1 py-1 text-xs"
                        value={d.byWeekday[wd]}
                        onChange={(e) => setChoice(s.id, wd, e.target.value as WeekdayChoice)}
                      >
                        {SELECTABLE_WEEKDAY_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc === 'off' ? '—' : WEEKDAY_LOCATION_LABEL[loc]}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                    <td className="p-2">
                      <input
                        className="w-40 rounded border border-gray-300 px-2 py-1 text-xs"
                        value={d.offText}
                        placeholder="1-3, 8-11"
                        onChange={(e) => setOffText(s.id, e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <DefaultsCell
                        staff={s}
                        draft={d}
                        providers={providers}
                        onProviderChoice={(v) => setDefaultChoice(s.id, v)}
                        onWantsTwoMas={(v) => setField(s.id, { wantsTwoMas: v })}
                        onCoverage={(v) => setField(s.id, { coverage: v })}
                        onProviderRank={(v) => setField(s.id, { providerRank: parseRank(v) })}
                        onModRank={(v) => setField(s.id, { modRank: parseRank(v) })}
                        onShippingRank={(v) => setField(s.id, { shippingRank: parseRank(v) })}
                      />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </main>
    </div>
  );
}

/** Per-person Provider default + MOD / shipping ranks (support roles only). */
function DefaultsCell({
  staff,
  draft,
  providers,
  onProviderChoice,
  onWantsTwoMas,
  onCoverage,
  onProviderRank,
  onModRank,
  onShippingRank,
}: {
  staff: Staff;
  draft: Draft;
  providers: Staff[];
  onProviderChoice: (value: string) => void;
  onWantsTwoMas: (value: boolean) => void;
  onCoverage: (value: boolean) => void;
  onProviderRank: (value: string) => void;
  onModRank: (value: string) => void;
  onShippingRank: (value: string) => void;
}) {
  const isMa = staff.role === 'ma';
  const isSupport = isSupportRole(staff.role);
  const isProvider = staff.receivesMas;
  // MAs and support roles pick a default Provider; both can be ranked for MOD / shipping.
  const showProvider = isMa || isSupport;
  const showRanks = isMa || isSupport;
  const providerValue = draft.defaultTargetId ?? '';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {isProvider && (
        <label className="flex items-center gap-1">
          <span className="text-gray-500">Priority&nbsp;#</span>
          <input
            type="number"
            min={1}
            className="w-12 rounded border border-gray-300 px-1 py-1"
            value={draft.providerRank ?? ''}
            onChange={(e) => onProviderRank(e.target.value)}
          />
        </label>
      )}

      {isProvider && (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={draft.wantsTwoMas}
            onChange={(e) => onWantsTwoMas(e.target.checked)}
          />
          <span className="text-gray-500">2 MAs</span>
        </label>
      )}

      {isProvider && (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={draft.coverage}
            onChange={(e) => onCoverage(e.target.checked)}
          />
          <span className="text-gray-500">Coverage</span>
        </label>
      )}

      {showProvider && (
        <label className="flex items-center gap-1">
          <span className="text-gray-500">Provider</span>
          <select
            className="rounded border border-gray-300 px-1 py-1"
            value={providerValue}
            onChange={(e) => onProviderChoice(e.target.value)}
          >
            <option value="">—</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      {showRanks && (
        <label className="flex items-center gap-1">
          <span className="text-gray-500">MOD&nbsp;#</span>
          <input
            type="number"
            min={1}
            className="w-12 rounded border border-gray-300 px-1 py-1"
            value={draft.modRank ?? ''}
            onChange={(e) => onModRank(e.target.value)}
          />
        </label>
      )}

      {showRanks && (
        <label className="flex items-center gap-1">
          <span className="text-gray-500">📦&nbsp;#</span>
          <input
            type="number"
            min={1}
            className="w-12 rounded border border-gray-300 px-1 py-1"
            value={draft.shippingRank ?? ''}
            onChange={(e) => onShippingRank(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
