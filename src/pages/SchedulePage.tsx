import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { getISOWeek } from 'date-fns';
import { generateMonth } from '@/engine';
import { assignWeeklyTasks } from '@/engine/weeklyTasks';
import type { Assignment, Staff } from '@/engine/types';
import { useSession } from '@/hooks/useSession';
import { useAllStaff } from '@/hooks/useStaff';
import { useMonthlyPatterns } from '@/hooks/useMonthlyPatterns';
import { useAssignments, useReplaceMonth, useUpsertAssignment } from '@/hooks/useAssignments';
import { useScheduleSnapshot, useSaveSnapshot } from '@/hooks/useScheduleSnapshot';
import { useClearDismissedWarnings, useDismissedWarnings, useDismissWarning } from '@/hooks/useDismissedWarnings';
import { useMonthWarnings } from '@/hooks/useMonthWarnings';
import { useMonthHolidays } from '@/hooks/useMonthHolidays';
import { useMonthReminders } from '@/hooks/useMonthReminders';
import { parseReminders } from '@/lib/reminders';
import { usePublishedMonths, useSetMonthPublished } from '@/hooks/usePublishedMonths';
import { useHiddenMonths, upcomingNonHiddenMonth } from '@/hooks/useHiddenMonths';
import { useRealtime } from '@/hooks/useRealtime';
import { isoOf, monthKey, monthLabel, parseIso, parseMonthParam, weekdayRows } from '@/lib/dates';
import { roleRank } from '@/lib/roles';
import { buildDayModel } from '@/lib/dayModel';
import { Spinner } from '@/components/common/Spinner';
import { SignInDialog } from '@/components/common/SignInDialog';
import { Toolbar } from '@/components/calendar/Toolbar';
import { WeekGrid } from '@/components/calendar/WeekGrid';
import { AssignmentEditor } from '@/components/calendar/AssignmentEditor';

export function SchedulePage() {
  const { session, isEditor, signOut } = useSession();
  const [showSignIn, setShowSignIn] = useState(false);
  // Monthly Setup's "‹ Calendar" link carries the month it was viewing, so
  // flipping between the two pages stays on the same month. Present only when
  // arriving from that link — a plain visit falls back to the usual
  // earliest-non-hidden/published-month default below. `monthParam` is
  // validated (not just parsed) so a malformed/out-of-range URL (e.g.
  // "banana" or "2026-13-01") never crashes the page — it's treated the same
  // as no param at all.
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = parseMonthParam(searchParams.get('month'));
  const [month, setMonthState] = useState(() => monthParam ?? new Date());

  // The URL is kept in sync with `month` so refresh/bookmark/back-forward all
  // land on the right month, instead of silently reverting to whatever the
  // URL said on first load.
  const setMonth = (d: Date, opts?: { replace?: boolean }) => {
    setMonthState(d);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('month', monthKey(d));
      return next;
    }, opts);
  };

  // Follow EXTERNAL changes to the URL (browser back/forward, a hand-edited
  // or bookmarked link) — the initializer above only runs once on mount.
  useEffect(() => {
    if (monthParam && monthKey(monthParam) !== monthKey(month)) setMonthState(monthParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const staffQuery = useAllStaff();
  const patternsQuery = useMonthlyPatterns(month);
  const holidaysQuery = useMonthHolidays(month);
  const remindersQuery = useMonthReminders(month);
  const assignmentsQuery = useAssignments(month);
  const dismissedQuery = useDismissedWarnings(month);
  const publishedQuery = usePublishedMonths();
  const hiddenQuery = useHiddenMonths();

  const replaceMonth = useReplaceMonth(month);
  const saveSnapshot = useSaveSnapshot(month);
  const snapshotQuery = useScheduleSnapshot(month);
  const upsert = useUpsertAssignment(month);
  const dismiss = useDismissWarning(month);
  const clearDismissed = useClearDismissedWarnings(month);
  const setPublished = useSetMonthPublished();

  const isPublished = (publishedQuery.data ?? new Set<string>()).has(monthKey(month));

  // Viewers: on first load, if the current month isn't published, jump to the most
  // recent published month (if any) so they don't land on an empty screen.
  // Skipped when a month came in via the URL (see monthParam above).
  const didInitViewer = useRef(!!monthParam);
  useEffect(() => {
    if (isEditor || didInitViewer.current || !publishedQuery.data) return;
    didInitViewer.current = true;
    if (!publishedQuery.data.has(monthKey(month))) {
      const latest = [...publishedQuery.data].sort().at(-1);
      if (latest) setMonth(parseIso(latest), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditor, publishedQuery.data]);

  // Editors: on first load, open the earliest non-hidden month from now forward
  // (skips months the editor has hidden in Monthly Setup). Skipped when a
  // month came in via the URL (see monthParam above).
  const didInitEditor = useRef(!!monthParam);
  useEffect(() => {
    if (!isEditor || didInitEditor.current || !hiddenQuery.data) return;
    didInitEditor.current = true;
    const target = upcomingNonHiddenMonth(new Date(), hiddenQuery.data);
    if (monthKey(target) !== monthKey(month)) setMonth(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditor, hiddenQuery.data]);

  useRealtime(month);

  // All staff (incl. inactive) drive the VIEW so historical months keep showing
  // people who have since been deactivated; only active staff are scheduled
  // (handleGenerate re-derives its own fresh active-staff list — see there).
  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const dismissed = dismissedQuery.data ?? new Set<string>();
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const patternsByStaff = useMemo(
    () => new Map((patternsQuery.data ?? []).map((p) => [p.staffId, p])),
    [patternsQuery.data],
  );

  // Holiday dates as an ISO set, for greying days out. This month's own row
  // also governs its trailing spillover dates (see CLAUDE.md §6/§8).
  const holidaySet = useMemo(() => new Set(holidaysQuery.data ?? []), [holidaysQuery.data]);

  // Special Reminders as ISO date -> reminder text(s), for the orange callout
  // under each date's header. Purely informational — not tied to generation,
  // so it just reflects whatever's saved, live.
  const remindersByDate = useMemo(
    () => parseReminders(remindersQuery.data ?? '', month),
    [month, remindersQuery.data],
  );

  const warningsByDate = useMonthWarnings(assignments, staff, dismissed, patternsByStaff, month);

  // Providers flagged for coverage this month (both need and can provide it).
  const coverageStaffIds = useMemo(
    () => new Set([...patternsByStaff].filter(([, p]) => p.coverage).map(([id]) => id)),
    [patternsByStaff],
  );

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [assignments]);

  // Weekly tasks (#1–6): rotate among MAs who aren't MOD-eligible and work at
  // least one day that week (R/O the whole week → skipped). Deterministic by ISO
  // week, recomputed from the current roster so new MAs join automatically.
  const weeklyTasksFor = (week: Date[]): Map<string, number> => {
    const modEligible = (id: string) => (patternsByStaff.get(id)?.modRank ?? null) !== null;
    const worksThisWeek = (id: string) =>
      week.some((d) => (assignmentsByDate.get(isoOf(d)) ?? []).some((a) => a.staffId === id));
    const eligible = staff
      .filter((s) => s.active && s.role === 'ma' && !modEligible(s.id) && worksThisWeek(s.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((s) => s.id);
    const tasks = assignWeeklyTasks(getISOWeek(week[0]), eligible);
    // Manual overrides win over the automatic rotation. An override stored on any
    // day of the week pins that MA's task # for the whole week (the badge is weekly).
    for (const day of week) {
      for (const a of assignmentsByDate.get(isoOf(day)) ?? []) {
        if (a.weeklyTaskNo != null) tasks.set(a.staffId, a.weeklyTaskNo);
      }
    }
    return tasks;
  };

  const [editing, setEditing] = useState<{ assignment: Assignment; staff: Staff } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const over = e.over?.data.current as { providerId?: string; date?: string } | undefined;
    const active = e.active.data.current as { assignment?: Assignment } | undefined;
    if (!over?.providerId || !over.date || !active?.assignment) return;

    const a = active.assignment;
    if (a.assignedProviderId === over.providerId) return;

    const existing = (assignmentsByDate.get(a.date) ?? []).filter(
      (x) => x.assignedProviderId === over.providerId && x.staffId !== a.staffId,
    ).length;

    upsert.mutate({
      ...a,
      assignedProviderId: over.providerId,
      maSlot: Math.min(existing + 1, 2),
    });
  };

  const handleGenerate = async () => {
    // Snapshot the current schedule (incl. all manual edits) BEFORE overwriting it,
    // so "Revert last Generate" can restore it. If the snapshot write fails, abort
    // the generate rather than overwrite with no way back.
    try {
      await saveSnapshot.mutateAsync(assignments);
    } catch {
      window.alert('Could not save a backup before generating — aborted. Please try again.');
      return;
    }
    // A fresh regenerate can surface different problems than the old schedule
    // had — don't let a stale dismissal hide a warning on the new one. Not
    // safety-critical (unlike the snapshot above), so a failure here doesn't
    // block the generate.
    try {
      await clearDismissed.mutateAsync();
    } catch {
      // best-effort
    }

    // Force a fresh read from the server for everything the engine needs,
    // rather than trusting whatever's currently cached client-side. A Monthly
    // Setup edit (e.g. someone's time off) can commit to the DB and still not
    // be reflected in this page's cache yet — Generate must never silently
    // run on stale inputs. Use these refetch results directly rather than any
    // memoized value derived from the pre-refetch render.
    const [freshStaff, freshPatterns, freshHolidays] = await Promise.all([
      staffQuery.refetch(),
      patternsQuery.refetch(),
      holidaysQuery.refetch(),
    ]);
    const freshActiveStaff = (freshStaff.data ?? []).filter((s) => s.active);

    const { assignments: generated } = generateMonth({
      staff: freshActiveStaff,
      patterns: freshPatterns.data ?? [],
      month,
      holidays: new Set(freshHolidays.data ?? []),
    });
    replaceMonth.mutate(generated);
  };

  // Restore the schedule to the snapshot captured just before the last Generate.
  const handleRevert = () => {
    const snap = snapshotQuery.data;
    if (!snap) return;
    const when = new Date(snap.takenAt).toLocaleString();
    if (!window.confirm(`Revert ${monthLabel(month)} to the schedule from just before the last Generate (${when})? This replaces the current schedule.`))
      return;
    replaceMonth.mutate(snap.rows);
  };

  const handleExport = async () => {
    // Active staff + any deactivated person who has an assignment this month.
    const assignedIds = new Set(assignments.map((a) => a.staffId));
    const rows = staff
      .filter((s) => s.active || assignedIds.has(s.id))
      .sort(
        (a, b) => roleRank(a.role) - roleRank(b.role) || a.displayName.localeCompare(b.displayName),
      );
    const { exportMonthToExcel } = await import('@/lib/exportMonth');
    await exportMonthToExcel({
      month,
      monthLabel: monthLabel(month),
      rows,
      assignmentsByDate,
      staffById,
      weeklyTaskByWeek: weekdayRows(month).map(weeklyTasksFor),
    });
  };

  if (staffQuery.isLoading || assignmentsQuery.isLoading) {
    return <Spinner label="Loading schedule…" />;
  }

  const rows = weekdayRows(month);

  // The MA's current weekly task # (override if set, else rotation) for the editor.
  let editingTaskNo: number | undefined;
  if (editing && editing.staff.role === 'ma') {
    const week = rows.find((w) => w.some((d) => isoOf(d) === editing.assignment.date));
    if (week) editingTaskNo = weeklyTasksFor(week).get(editing.staff.id);
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        month={month}
        setMonth={setMonth}
        isEditor={isEditor}
        signedIn={!!session}
        onGenerate={handleGenerate}
        generating={replaceMonth.isPending || saveSnapshot.isPending}
        onRevert={handleRevert}
        canRevert={!!snapshotQuery.data}
        onExport={handleExport}
        onSignIn={() => setShowSignIn(true)}
        onSignOut={signOut}
        isPublished={isPublished}
        onTogglePublish={() => setPublished.mutate({ month, published: !isPublished })}
        publishPending={setPublished.isPending}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <main className="flex-1 space-y-4 overflow-auto p-4">
          {!isEditor && !isPublished ? (
            <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              This month hasn’t been published yet.
            </p>
          ) : (
          <>
          {assignments.length === 0 && (
            <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              No schedule generated for this month yet.
              {isEditor ? ' Use “Generate month” to build one.' : ''}
            </p>
          )}

          {rows.map((week, i) => {
            const dayModels = week.map((day) => {
              const iso = isoOf(day);
              return buildDayModel(iso, assignmentsByDate.get(iso) ?? [], staff, patternsByStaff, holidaySet.has(iso));
            });
            const taskByStaff = weeklyTasksFor(week);
            return (
              <section key={i} className="overflow-x-auto pb-2">
                <WeekGrid
                  days={dayModels}
                  staffById={staffById}
                  editable={isEditor}
                  warningsByDate={warningsByDate}
                  remindersByDate={remindersByDate}
                  taskByStaff={taskByStaff}
                  onTileClick={(assignment, s) => isEditor && setEditing({ assignment, staff: s })}
                  onDismissWarning={(w) => dismiss.mutate(w)}
                />
              </section>
            );
          })}
          </>
          )}
        </main>
      </DndContext>

      {editing && (
        <AssignmentEditor
          staff={editing.staff}
          staffById={staffById}
          assignment={editing.assignment}
          dayAssignments={assignmentsByDate.get(editing.assignment.date) ?? []}
          allStaff={staff}
          coverageStaffIds={coverageStaffIds}
          currentTaskNo={editingTaskNo}
          onSave={(next) => {
            upsert.mutate(next);
            // Weekly task # is a per-week badge: propagate a change to all of this
            // MA's other assignments in the same week so every day stays consistent.
            if (editing.staff.role === 'ma' && next.weeklyTaskNo !== editing.assignment.weeklyTaskNo) {
              const week = rows.find((w) => w.some((d) => isoOf(d) === next.date));
              week?.forEach((day) => {
                const iso = isoOf(day);
                if (iso === next.date) return;
                const a = (assignmentsByDate.get(iso) ?? []).find((x) => x.staffId === next.staffId);
                if (a) upsert.mutate({ ...a, weeklyTaskNo: next.weeklyTaskNo });
              });
            }
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {showSignIn && <SignInDialog onClose={() => setShowSignIn(false)} />}
    </div>
  );
}
