import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { generateMonth } from '@/engine';
import type { Assignment, Staff } from '@/engine/types';
import { useSession } from '@/hooks/useSession';
import { useStaff } from '@/hooks/useStaff';
import { useMonthlyPatterns } from '@/hooks/useMonthlyPatterns';
import { useAssignments, useReplaceMonth, useUpsertAssignment } from '@/hooks/useAssignments';
import { useDismissedWarnings, useDismissWarning } from '@/hooks/useDismissedWarnings';
import { useMonthWarnings } from '@/hooks/useMonthWarnings';
import { useRealtime } from '@/hooks/useRealtime';
import { isoOf, weekdayRows } from '@/lib/dates';
import { buildDayModel } from '@/lib/dayModel';
import { Spinner } from '@/components/common/Spinner';
import { Toolbar } from '@/components/calendar/Toolbar';
import { DayColumn } from '@/components/calendar/DayColumn';
import { AssignmentEditor } from '@/components/calendar/AssignmentEditor';

export function SchedulePage() {
  const { isEditor, signOut } = useSession();
  const [month, setMonth] = useState(() => new Date());

  const staffQuery = useStaff();
  const patternsQuery = useMonthlyPatterns(month);
  const assignmentsQuery = useAssignments(month);
  const dismissedQuery = useDismissedWarnings(month);

  const replaceMonth = useReplaceMonth(month);
  const upsert = useUpsertAssignment(month);
  const dismiss = useDismissWarning(month);

  useRealtime(month);

  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const dismissed = dismissedQuery.data ?? new Set<string>();
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const patternsByStaff = useMemo(
    () => new Map((patternsQuery.data ?? []).map((p) => [p.staffId, p])),
    [patternsQuery.data],
  );

  const warningsByDate = useMonthWarnings(assignments, staff, dismissed);

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [assignments]);

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

  const handleToggleShipping = (a: Assignment) => {
    upsert.mutate({ ...a, isShipping: !a.isShipping });
  };

  const handleGenerate = () => {
    const { assignments: generated } = generateMonth({
      staff,
      patterns: patternsQuery.data ?? [],
      month,
    });
    replaceMonth.mutate(generated);
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
        onGenerate={handleGenerate}
        generating={replaceMonth.isPending}
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

          {rows.map((week, i) => (
            <section key={i} className="flex gap-3 overflow-x-auto pb-2">
              {week.map((day) => {
                const iso = isoOf(day);
                const model = buildDayModel(iso, assignmentsByDate.get(iso) ?? [], staff, patternsByStaff);
                return (
                  <DayColumn
                    key={iso}
                    model={model}
                    staffById={staffById}
                    editable={isEditor}
                    warnings={warningsByDate.get(iso) ?? []}
                    onTileClick={(assignment, s) => isEditor && setEditing({ assignment, staff: s })}
                    onDismissWarning={(w) => dismiss.mutate(w)}
                    onToggleShipping={handleToggleShipping}
                  />
                );
              })}
            </section>
          ))}
        </main>
      </DndContext>

      {editing && (
        <AssignmentEditor
          staff={editing.staff}
          staffById={staffById}
          assignment={editing.assignment}
          dayAssignments={assignmentsByDate.get(editing.assignment.date) ?? []}
          allStaff={staff}
          onSave={(next) => {
            upsert.mutate(next);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
