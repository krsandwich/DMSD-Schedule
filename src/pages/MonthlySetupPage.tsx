import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { MonthlyPattern, Staff, WeekdayLocation } from '@/engine/types';
import { generatePersonMonth, generateSingleDay } from '@/engine';
import { useSession } from '@/hooks/useSession';
import { useStaff } from '@/hooks/useStaff';
import { useMonthlyPatterns, useSavePattern } from '@/hooks/useMonthlyPatterns';
import { useMonthHolidays, useSaveHolidays } from '@/hooks/useMonthHolidays';
import { useMonthReminders, useSaveReminders } from '@/hooks/useMonthReminders';
import { useAssignments, useReplaceDayAssignments, useReplacePersonMonth } from '@/hooks/useAssignments';
import { useHiddenMonths, useSetMonthHidden, upcomingNonHiddenMonth } from '@/hooks/useHiddenMonths';
import { format, parseISO } from 'date-fns';
import { daysToIso, monthKey, monthLabel, nextMonth, previousMonth } from '@/lib/dates';
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
import { Spinner, InlineSpinner } from '@/components/common/Spinner';

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
  /** Additional force-work days (day-of-month ranges) and their location. */
  addlText: string;
  addlLocation: WeekdayLocation;
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
    addlText: '',
    addlLocation: 'off',
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
    addlText: formatDayRanges(p.additionalDays),
    addlLocation: p.additionalDaysLocation ?? 'off',
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
  // The calendar's "Monthly setup" link carries the month it was viewing, so
  // flipping between the two pages stays on the same month. Present only when
  // arriving from that link — a plain visit falls back to the usual
  // earliest-non-hidden-month default below.
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const [month, setMonth] = useState(() => (monthParam ? parseISO(monthParam) : new Date()));

  const staffQuery = useStaff();
  const patternsQuery = useMonthlyPatterns(month);
  const priorPatternsQuery = useMonthlyPatterns(previousMonth(month));
  // Next month's patterns + holidays feed per-person generation: a month renders as
  // whole Mon–Fri weeks, so its trailing days resolve against next month's setup.
  const nextPatternsQuery = useMonthlyPatterns(nextMonth(month));
  const nextHolidaysQuery = useMonthHolidays(nextMonth(month));
  // The month's currently-persisted assignments — per-person generate needs
  // these to place the target correctly around who's already assigned,
  // instead of re-simulating the whole day blind to existing state.
  const assignmentsQuery = useAssignments(month);
  const savePattern = useSavePattern(month);
  const holidaysQuery = useMonthHolidays(month);
  const saveHolidays = useSaveHolidays(month);
  const remindersQuery = useMonthReminders(month);
  const saveReminders = useSaveReminders(month);
  const replacePerson = useReplacePersonMonth(month);
  const replaceDay = useReplaceDayAssignments();
  const hiddenQuery = useHiddenMonths();
  const setHidden = useSetMonthHidden();

  const isHidden = (hiddenQuery.data ?? new Set<string>()).has(monthKey(month));

  // On first load, open the earliest non-hidden month from now forward.
  // Skipped when a month came in via the URL (see monthParam above).
  const didInit = useRef(!!monthParam);
  useEffect(() => {
    if (didInit.current || !hiddenQuery.data) return;
    didInit.current = true;
    const target = upcomingNonHiddenMonth(new Date(), hiddenQuery.data);
    if (monthKey(target) !== monthKey(month)) setMonth(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenQuery.data]);

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
  // MA dropdown options, for interns' "Shadows" field.
  const maStaffList = useMemo(
    () => staff.filter((s) => s.role === 'ma').sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [staff],
  );
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [holidayText, setHolidayText] = useState('');
  const [remindersText, setRemindersText] = useState('');
  const [status, setStatus] = useState('');
  // Which staff row is mid-generation (disables just that row's button).
  const [genId, setGenId] = useState<string | null>(null);

  // --- Autosave -----------------------------------------------------------
  // Edits persist automatically (per row, debounced) via the single-row pattern
  // upsert, so there is no "Save all" button. A synchronous mirror of `drafts`
  // lets edit handlers read the latest draft without waiting for a re-render.
  const draftsRef = useRef<Record<string, Draft>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Keys with a pending debounce timer or an in-flight save (staff id, or
  // '__holidays__' / '__reminders__'); drives the "Saving… / All changes
  // saved" indicator.
  const pending = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [everSaved, setEverSaved] = useState(false);
  const refreshBusy = () => setBusy(pending.current.size > 0);

  // Cancel any outstanding debounce timers on unmount.
  useEffect(
    () => () => {
      for (const t of Object.values(saveTimers.current)) clearTimeout(t);
    },
    [],
  );

  // Load the month's holidays into the editable field.
  useEffect(() => {
    if (!holidaysQuery.data) return;
    setHolidayText(formatDayRanges(holidaysQuery.data));
  }, [holidaysQuery.data]);

  // Load the month's Special Reminders into the editable field. Stored/loaded
  // as raw text (no parse/format round-trip needed), so this is a direct
  // mirror — checked against `undefined` specifically, since '' (genuinely no
  // reminders) is falsy and would otherwise be skipped.
  useEffect(() => {
    if (remindersQuery.data === undefined) return;
    setRemindersText(remindersQuery.data);
  }, [remindersQuery.data]);

  // Hydrate drafts from saved patterns (or seeded defaults) ONCE per month. After
  // that, the on-screen drafts own the state: because autosave invalidates the
  // patterns query, re-hydrating on every refetch would clobber whatever the user
  // is mid-typing. Changing month re-hydrates for the new month.
  const hydratedMonth = useRef<string | null>(null);
  useEffect(() => {
    if (!staff.length || !patternsQuery.data) return;
    const key = monthKey(month);
    if (hydratedMonth.current === key) return;
    hydratedMonth.current = key;
    const byStaff = new Map(patternsQuery.data.map((p) => [p.staffId, p]));
    const idByName = new Map(staff.map((x) => [x.displayName, x.id]));
    const next: Record<string, Draft> = {};
    for (const s of staff) {
      const p = byStaff.get(s.id);
      next[s.id] = p ? draftFromPattern(p, s, idByName) : defaultDraft(s, idByName);
    }
    draftsRef.current = next;
    setDrafts(next);
  }, [staff, patternsQuery.data, month]);

  if (!isEditor) return <Navigate to="/" replace />;
  if (staffQuery.isLoading || patternsQuery.isLoading) return <Spinner />;

  const draftOf = (staffId: string): Draft => draftsRef.current[staffId] ?? emptyDraft();

  // Debounced per-row autosave: coalesces rapid edits (typing) into one upsert
  // ~700ms after the last change to that row.
  const scheduleSave = (staffId: string, draft: Draft) => {
    const s = staffById.get(staffId);
    if (!s) return;
    pending.current.add(staffId);
    refreshBusy();
    clearTimeout(saveTimers.current[staffId]);
    saveTimers.current[staffId] = setTimeout(async () => {
      try {
        await savePattern.mutateAsync({ ...draftToPattern(s, draft), month: monthKey(month) });
        setEverSaved(true);
      } catch (e) {
        setStatus('Autosave failed: ' + errorMessage(e));
      } finally {
        pending.current.delete(staffId);
        refreshBusy();
      }
    }, 700);
  };

  // Apply an edit: update the draft (state + synchronous mirror) and autosave it.
  const commit = (staffId: string, next: Draft) => {
    draftsRef.current = { ...draftsRef.current, [staffId]: next };
    setDrafts(draftsRef.current);
    scheduleSave(staffId, next);
  };

  const setChoice = (staffId: string, wd: number, value: WeekdayChoice) =>
    commit(staffId, {
      ...draftOf(staffId),
      byWeekday: { ...draftOf(staffId).byWeekday, [wd]: value },
    });

  const setField = (staffId: string, patch: Partial<Draft>) =>
    commit(staffId, { ...draftOf(staffId), ...patch });

  const setOffText = (staffId: string, offText: string) => setField(staffId, { offText });

  // Holidays autosave on blur (a single field, so no per-keystroke debounce).
  // A day newly added to the list is cleared (holidays get no staff); a day
  // newly removed is filled back in — both scoped to just that date, so the
  // rest of the month's schedule (incl. manual edits) is untouched.
  const saveHolidaysNow = async () => {
    pending.current.add('__holidays__');
    refreshBusy();
    try {
      // Force fresh reads rather than trusting whatever's cached. Two distinct
      // staleness risks here, both silent: (1) if `oldDays` is stale/undefined
      // (e.g. a fast edit right after this page mounted), the "removed" list
      // can come back wrong — including empty, even though the new list still
      // gets saved correctly below (that save is unconditional, independent
      // of this diff), which looks exactly like "the holiday was cleared but
      // never regenerated". (2) generateSingleDay needs real patterns/staff —
      // an empty fallback silently resolves everyone "off" and writes zero
      // rows, indistinguishable from the day never having been generated.
      const [freshHolidays, freshStaff] = await Promise.all([holidaysQuery.refetch(), staffQuery.refetch()]);
      const newDays = parseDayRanges(holidayText);
      const oldDays = freshHolidays.data ?? [];
      const oldSet = new Set(oldDays);
      const newSet = new Set(newDays);
      const added = newDays.filter((d) => !oldSet.has(d));
      const removed = oldDays.filter((d) => !newSet.has(d));
      const freshStaffList = (freshStaff.data ?? []).sort(
        (a, b) => roleRank(a.role) - roleRank(b.role) || a.displayName.localeCompare(b.displayName),
      );

      for (const d of added) {
        const iso = daysToIso(month, [d])[0];
        await replaceDay.mutateAsync({ date: iso, assignments: [] });
      }
      if (removed.length) {
        const freshPatterns = await patternsQuery.refetch();
        for (const d of removed) {
          const iso = daysToIso(month, [d])[0];
          const generated = generateSingleDay(parseISO(iso), freshStaffList, freshPatterns.data ?? []);
          await replaceDay.mutateAsync({ date: iso, assignments: generated });
        }
      }

      await saveHolidays.mutateAsync(newDays);
      setEverSaved(true);
      if (added.length || removed.length) {
        setStatus(
          [
            added.length && `cleared ${added.length} day${added.length === 1 ? '' : 's'}`,
            removed.length && `generated ${removed.length} day${removed.length === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(', ') + '.',
        );
      }
    } catch (e) {
      setStatus('Holiday autosave failed: ' + errorMessage(e));
    } finally {
      pending.current.delete('__holidays__');
      refreshBusy();
    }
  };

  // Special Reminders autosave on blur. Purely informational — unlike
  // holidays, nothing about the schedule itself changes — so this is just a
  // plain save, no per-date clear/generate side effects.
  const saveRemindersNow = async () => {
    pending.current.add('__reminders__');
    refreshBusy();
    try {
      await saveReminders.mutateAsync(remindersText);
      setEverSaved(true);
    } catch (e) {
      setStatus('Reminders autosave failed: ' + errorMessage(e));
    } finally {
      pending.current.delete('__reminders__');
      refreshBusy();
    }
  };

  const setDefaultChoice = (staffId: string, value: string) =>
    setField(staffId, { defaultTargetId: value || null });

  const parseRank = (value: string): number | null => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  };

  // Carry forward usual weekdays + locations from the prior month (not time off).
  // An explicit bulk action, so it persists every carried row immediately (only the
  // rows that actually had a prior-month pattern — people with none are left alone).
  const carryForward = async () => {
    const prior = priorPatternsQuery.data;
    if (!prior?.length) {
      setStatus('No prior month to copy from.');
      return;
    }
    const byStaff = new Map(prior.map((p) => [p.staffId, p]));
    const idByName = new Map(staff.map((x) => [x.displayName, x.id]));
    const base = draftsRef.current;
    const next = { ...base };
    const carried: string[] = [];
    for (const s of staff) {
      const p = byStaff.get(s.id);
      if (!p) continue;
      const d = draftFromPattern(p, s, idByName);
      // Carry weekday patterns + defaults/ranks; keep this month's requested time
      // off and additional days (both are month-specific, not carried).
      next[s.id] = {
        ...d,
        offText: base[s.id]?.offText ?? '',
        addlText: base[s.id]?.addlText ?? '',
        addlLocation: base[s.id]?.addlLocation ?? 'off',
      };
      carried.push(s.id);
    }
    draftsRef.current = next;
    setDrafts(next);

    pending.current.add('__carry__');
    refreshBusy();
    try {
      for (const id of carried) {
        const s = staffById.get(id);
        if (s) await savePattern.mutateAsync({ ...draftToPattern(s, next[id]), month: monthKey(month) });
      }
      setEverSaved(true);
      setStatus(
        `Copied ${carried.length} pattern${carried.length === 1 ? '' : 's'} from ` +
          monthLabel(previousMonth(month)) +
          '.',
      );
    } catch (e) {
      setStatus('Copy last month failed: ' + errorMessage(e));
    } finally {
      pending.current.delete('__carry__');
      refreshBusy();
    }
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
      additionalDays: parseDayRanges(d.addlText),
      additionalDaysLocation: d.addlLocation,
      defaultTargetId: d.defaultTargetId,
      wantsTwoMas: d.wantsTwoMas,
      coverage: d.coverage,
      providerRank: d.providerRank,
      modRank: d.modRank,
      shippingRank: d.shippingRank,
    };
  };

  // Generate ONE person into the existing schedule without clearing anyone else's.
  // Saves this row's pattern, then places the target around who's ALREADY really
  // assigned that month (generatePersonMonth) — not a from-scratch simulation
  // blind to existing state, which is what let independent per-person generates
  // pile every new MA onto the same top-priority provider. Persists only this
  // person's working days; every other staff member's rows are untouched.
  const generatePerson = async (s: Staff) => {
    const d = draftOf(s.id);
    setGenId(s.id);
    setStatus(`Generating ${s.displayName}…`);
    try {
      // Cancel this row's pending autosave — we persist it explicitly below.
      clearTimeout(saveTimers.current[s.id]);
      pending.current.delete(s.id);
      refreshBusy();
      const targetPattern: MonthlyPattern = { ...draftToPattern(s, d), month: monthKey(month) };
      // Persist this row's setup so the schedule and setup stay in sync.
      await savePattern.mutateAsync(targetPattern);

      // Cross-person context: every other person's saved pattern for this month +
      // next month's patterns (for the trailing spill-over days), with this person's
      // just-edited draft swapped in. Mirrors SchedulePage's handleGenerate inputs.
      const others = (patternsQuery.data ?? []).filter((p) => p.staffId !== s.id);
      const patterns = [...others, targetPattern, ...(nextPatternsQuery.data ?? [])];
      const holidays = new Set([
        ...daysToIso(month, parseDayRanges(holidayText)),
        ...daysToIso(nextMonth(month), nextHolidaysQuery.data ?? []),
      ]);

      const mine = generatePersonMonth({
        staffId: s.id,
        staff,
        patterns,
        month,
        holidays,
        existingAssignments: assignmentsQuery.data ?? [],
      }).filter((a) => a.location !== 'off');
      await replacePerson.mutateAsync({ staffId: s.id, assignments: mine });

      setStatus(
        mine.length
          ? `Added ${s.displayName} to the ${monthLabel(month)} schedule (${mine.length} day${
              mine.length === 1 ? '' : 's'
            }).`
          : `${s.displayName} has no working days in ${monthLabel(month)} — schedule cleared for them.`,
      );
    } catch (e) {
      setStatus('Generate failed: ' + errorMessage(e));
    } finally {
      setGenId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link to={`/?month=${monthKey(month)}`}>
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
          {isHidden && (
            <span
              title="Hidden — skipped when the app picks a default month"
              className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
            >
              Hidden
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-xs text-gray-500">{status}</span>}
          <Button
            variant="secondary"
            onClick={() => setHidden.mutate({ month, hidden: !isHidden })}
            disabled={setHidden.isPending}
            title={
              isHidden
                ? 'Unhide — allow this month to be a default landing month again'
                : 'Hide — stop the app from defaulting to this month'
            }
          >
            {isHidden ? 'Unhide month' : 'Hide month'}
          </Button>
          <Button variant="secondary" onClick={carryForward} title="Copy weekday/location patterns from last month (not time off)">
            Copy last month
          </Button>
          <span
            className="min-w-28 text-right text-xs text-gray-400"
            title="Changes save automatically as you edit"
          >
            {busy ? 'Saving…' : everSaved ? 'All changes saved ✓' : ''}
          </span>
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
              onBlur={saveHolidaysNow}
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
              <th className="p-2">Additional days</th>
              <th className="p-2">Additional days location</th>
              <th className="p-2">Defaults &amp; ranks</th>
              <th className="p-2 text-right">Generate</th>
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
                        colSpan={WEEKDAYS.length + 6}
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
                      <input
                        className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                        value={d.addlText}
                        placeholder="3, 6"
                        onChange={(e) => setField(s.id, { addlText: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        className="rounded border border-gray-300 px-1 py-1 text-xs"
                        value={d.addlLocation}
                        onChange={(e) =>
                          setField(s.id, { addlLocation: e.target.value as WeekdayLocation })
                        }
                      >
                        {SELECTABLE_WEEKDAY_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc === 'off' ? '—' : WEEKDAY_LOCATION_LABEL[loc]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <DefaultsCell
                        staff={s}
                        draft={d}
                        providers={providers}
                        mas={maStaffList}
                        onProviderChoice={(v) => setDefaultChoice(s.id, v)}
                        onWantsTwoMas={(v) => setField(s.id, { wantsTwoMas: v })}
                        onCoverage={(v) => setField(s.id, { coverage: v })}
                        onProviderRank={(v) => setField(s.id, { providerRank: parseRank(v) })}
                        onModRank={(v) => setField(s.id, { modRank: parseRank(v) })}
                        onShippingRank={(v) => setField(s.id, { shippingRank: parseRank(v) })}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => generatePerson(s)}
                        disabled={genId !== null}
                        title={`Generate ${s.displayName} into the ${monthLabel(
                          month,
                        )} schedule (does not clear anyone else)`}
                        className="inline-flex w-28 items-center justify-center gap-1.5 whitespace-nowrap rounded border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                      >
                        {genId === s.id ? (
                          <>
                            <InlineSpinner />
                            Generating
                          </>
                        ) : (
                          '⚡ Generate'
                        )}
                      </button>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <span className="text-lg leading-none">📌</span>
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-orange-800">
              Special Reminders — {format(month, 'MMM yyyy')}
            </label>
            <p className="mt-1 text-xs text-orange-700">
              One per line, formatted <code className="rounded bg-orange-100 px-1">day: text</code> — e.g.{' '}
              <code className="rounded bg-orange-100 px-1">20: Monthly staff meeting</code>. Shows as a callout on
              that date on the calendar. Doesn't carry forward to next month.
            </p>
            <textarea
              className="mt-2 w-full max-w-md rounded border border-orange-300 px-2 py-1.5 text-sm"
              rows={3}
              value={remindersText}
              placeholder={'20: Monthly staff meeting\n5: Vendor visit'}
              onChange={(e) => setRemindersText(e.target.value)}
              onBlur={saveRemindersNow}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Per-person Provider default + MOD / shipping ranks (support roles only). */
function DefaultsCell({
  staff,
  draft,
  providers,
  mas,
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
  /** MA options for an intern's "Shadows" field. */
  mas: Staff[];
  onProviderChoice: (value: string) => void;
  onWantsTwoMas: (value: boolean) => void;
  onCoverage: (value: boolean) => void;
  onProviderRank: (value: string) => void;
  onModRank: (value: string) => void;
  onShippingRank: (value: string) => void;
}) {
  // Interns get no defaults/ranks — just which MA they shadow this month.
  if (staff.role === 'intern') {
    return (
      <label className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">Shadows</span>
        <select
          className="rounded border border-gray-300 px-1 py-1"
          value={draft.defaultTargetId ?? ''}
          onChange={(e) => onProviderChoice(e.target.value)}
        >
          <option value="">—</option>
          {mas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>
    );
  }

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
