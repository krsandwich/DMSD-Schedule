import { useMemo, useState } from 'react';
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
import { useDismissedWarnings, useDismissWarning } from '@/hooks/useDismissedWarnings';
import { useMonthWarnings } from '@/hooks/useMonthWarnings';
import { useMonthHolidays } from '@/hooks/useMonthHolidays';
import { useRealtime } from '@/hooks/useRealtime';
import { daysToIso, isoOf, monthLabel, nextMonth, sameCalendarMonth, weekdayRows } from '@/lib/dates';
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
  const [month, setMonth] = useState(() => new Date());

  const staffQuery = useAllStaff();
  const patternsQuery = useMonthlyPatterns(month);
  // Trailing days of the view spill into next month; pull its patterns + holidays too.
  const nextPatternsQuery = useMonthlyPatterns(nextMonth(month));
  const holidaysQuery = useMonthHolidays(month);
  const nextHolidaysQuery = useMonthHolidays(nextMonth(month));
  const assignmentsQuery = useAssignments(month);
  const dismissedQuery = useDismissedWarnings(month);

  const replaceMonth = useReplaceMonth(month);
  const upsert = useUpsertAssignment(month);
  const dismiss = useDismissWarning(month);

  useRealtime(month);

  // All staff (incl. inactive) drive the VIEW so historical months keep showing
  // people who have since been deactivated; only active staff are scheduled.
  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const dismissed = dismissedQuery.data ?? new Set<string>();
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const patternsByStaff = useMemo(
    () => new Map((patternsQuery.data ?? []).map((p) => [p.staffId, p])),
    [patternsQuery.data],
  );
  const nextPatternsByStaff = useMemo(
    () => new Map((nextPatternsQuery.data ?? []).map((p) => [p.staffId, p])),
    [nextPatternsQuery.data],
  );

  // Holiday dates (current + next month) as an ISO set, for greying days out.
  const holidaySet = useMemo(
    () =>
      new Set([
        ...daysToIso(month, holidaysQuery.data ?? []),
        ...daysToIso(nextMonth(month), nextHolidaysQuery.data ?? []),
      ]),
    [month, holidaysQuery.data, nextHolidaysQuery.data],
  );

  const warningsByDate = useMonthWarnings(assignments, staff, dismissed, patternsByStaff);

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
    const modEligible = (id: string) =>
      (patternsByStaff.get(id)?.modRank ?? null) !== null ||
      (nextPatternsByStaff.get(id)?.modRank ?? null) !== null;
    const worksThisWeek = (id: string) =>
      week.some((d) => (assignmentsByDate.get(isoOf(d)) ?? []).some((a) => a.staffId === id));
    const eligible = staff
      .filter((s) => s.active && s.role === 'ma' && !modEligible(s.id) && worksThisWeek(s.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((s) => s.id);
    return assignWeeklyTasks(getISOWeek(week[0]), eligible);
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

  const handleGenerate = () => {
    const { assignments: generated } = generateMonth({
      staff: activeStaff,
      patterns: [...(patternsQuery.data ?? []), ...(nextPatternsQuery.data ?? [])],
      month,
      holidays: holidaySet,
    });
    replaceMonth.mutate(generated);
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

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        month={month}
        setMonth={setMonth}
        isEditor={isEditor}
        signedIn={!!session}
        onGenerate={handleGenerate}
        generating={replaceMonth.isPending}
        onExport={handleExport}
        onSignIn={() => setShowSignIn(true)}
        onSignOut={signOut}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <main className="flex-1 space-y-4 overflow-auto p-4">
          {assignments.length === 0 && (
            <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              No schedule generated for this month yet.
              {isEditor ? ' Use “Generate month” to build one.' : ''}
            </p>
          )}

          {rows.map((week, i) => {
            const dayModels = week.map((day) => {
              const iso = isoOf(day);
              // Trailing days belong to next month — resolve off/R-O against its patterns.
              const patterns = sameCalendarMonth(day, month) ? patternsByStaff : nextPatternsByStaff;
              return buildDayModel(iso, assignmentsByDate.get(iso) ?? [], staff, patterns, holidaySet.has(iso));
            });
            const taskByStaff = weeklyTasksFor(week);
            return (
              <section key={i} className="overflow-x-auto pb-2">
                <WeekGrid
                  days={dayModels}
                  staffById={staffById}
                  editable={isEditor}
                  warningsByDate={warningsByDate}
                  taskByStaff={taskByStaff}
                  onTileClick={(assignment, s) => isEditor && setEditing({ assignment, staff: s })}
                  onDismissWarning={(w) => dismiss.mutate(w)}
                />
              </section>
            );
          })}
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
          onSave={(next) => {
            upsert.mutate(next);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {showSignIn && <SignInDialog onClose={() => setShowSignIn(false)} />}
    </div>
  );
}
