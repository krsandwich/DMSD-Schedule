import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { Location, MonthlyPattern, Staff } from '@/engine/types';
import { useSession } from '@/hooks/useSession';
import { useStaff } from '@/hooks/useStaff';
import { useMonthlyPatterns, useSavePattern } from '@/hooks/useMonthlyPatterns';
import { monthLabel, nextMonth, previousMonth } from '@/lib/dates';
import { formatDayRanges, parseDayRanges } from '@/lib/dayRanges';
import { LOCATION_LABEL, SELECTABLE_LOCATIONS } from '@/lib/locations';
import { WEEKDAY_LABELS } from '@/lib/dates';
import { ROLE_LABEL, roleRank } from '@/lib/roles';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';

type WeekdayChoice = Location; // 'off' means not working that weekday
interface Draft {
  byWeekday: Record<number, WeekdayChoice>;
  offText: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

function emptyDraft(): Draft {
  return { byWeekday: { 1: 'off', 2: 'off', 3: 'off', 4: 'off', 5: 'off' }, offText: '' };
}

function draftFromPattern(p: MonthlyPattern): Draft {
  const byWeekday: Record<number, WeekdayChoice> = { 1: 'off', 2: 'off', 3: 'off', 4: 'off', 5: 'off' };
  for (const wd of p.usualWeekdays) byWeekday[wd] = p.locationByWeekday[String(wd)] ?? 'off';
  return { byWeekday, offText: formatDayRanges(p.requestedOffDays) };
}

export function MonthlySetupPage() {
  const { isEditor } = useSession();
  const [month, setMonth] = useState(() => new Date());

  const staffQuery = useStaff();
  const patternsQuery = useMonthlyPatterns(month);
  const priorPatternsQuery = useMonthlyPatterns(previousMonth(month));
  const savePattern = useSavePattern(month);

  const staff = useMemo(
    () =>
      [...(staffQuery.data ?? [])].sort(
        (a, b) =>
          roleRank(a.role) - roleRank(b.role) ||
          (a.priorityRank ?? 99) - (b.priorityRank ?? 99) ||
          a.displayName.localeCompare(b.displayName),
      ),
    [staffQuery.data],
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [status, setStatus] = useState('');

  // Initialise drafts from existing patterns (or empty).
  useEffect(() => {
    if (!staff.length || !patternsQuery.data) return;
    const byStaff = new Map(patternsQuery.data.map((p) => [p.staffId, p]));
    const next: Record<string, Draft> = {};
    for (const s of staff) {
      const p = byStaff.get(s.id);
      next[s.id] = p ? draftFromPattern(p) : emptyDraft();
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

  const setOffText = (staffId: string, offText: string) =>
    setDrafts((d) => ({ ...d, [staffId]: { ...d[staffId], offText } }));

  // Carry forward usual weekdays + locations from the prior month (not time off).
  const carryForward = () => {
    const prior = priorPatternsQuery.data;
    if (!prior?.length) {
      setStatus('No prior month to carry forward from.');
      return;
    }
    const byStaff = new Map(prior.map((p) => [p.staffId, p]));
    setDrafts((current) => {
      const next = { ...current };
      for (const s of staff) {
        const p = byStaff.get(s.id);
        if (!p) continue;
        const d = draftFromPattern(p);
        next[s.id] = { byWeekday: d.byWeekday, offText: current[s.id]?.offText ?? '' };
      }
      return next;
    });
    setStatus('Carried forward weekday patterns from ' + monthLabel(previousMonth(month)) + '.');
  };

  const draftToPattern = (s: Staff, d: Draft): MonthlyPattern => {
    const usualWeekdays: number[] = [];
    const locationByWeekday: Record<string, Location> = {};
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
    };
  };

  const saveAll = async () => {
    setStatus('Saving…');
    for (const s of staff) {
      const d = drafts[s.id];
      if (!d) continue;
      await savePattern.mutateAsync(draftToPattern(s, d));
    }
    setStatus('Saved all patterns for ' + monthLabel(month) + '.');
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="p-2">Staff</th>
              {WEEKDAY_LABELS.map((l) => (
                <th key={l} className="p-2">
                  {l}
                </th>
              ))}
              <th className="p-2">Requested off in {monthLabel(month)} (e.g. 1-3, 8-11)</th>
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
                        colSpan={WEEKDAYS.length + 2}
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
                        {SELECTABLE_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc === 'off' ? '—' : LOCATION_LABEL[loc]}
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
