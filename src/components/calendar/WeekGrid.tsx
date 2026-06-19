import { Fragment } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import type { Assignment, Staff, Warning } from '@/engine/types';
import type { CovererView, DayModel, PersonView, ProviderView } from '@/lib/dayModel';
import { parseIso } from '@/lib/dates';
import { StaffTile } from './StaffTile';

interface Props {
  days: DayModel[];
  staffById: Map<string, Staff>;
  editable: boolean;
  warningsByDate: Map<string, Warning[]>;
  /** Weekly task numbers (#1–6) for this week, keyed by MA staff id. */
  taskByStaff: Map<string, number>;
  onTileClick: (assignment: Assignment, staff: Staff) => void;
  onDismissWarning: (w: Warning) => void;
}

/** A role row in the week grid: the label (shown once, on the left) and a cell renderer per day. */
interface RoleRow {
  key: string;
  label: string;
  muted?: boolean;
  /** Does this day have anyone in this role? */
  has: (day: DayModel) => boolean;
  cell: (day: DayModel, ctx: CellCtx) => React.ReactNode;
}

interface CellCtx {
  staffById: Map<string, Staff>;
  editable: boolean;
  taskByStaff: Map<string, number>;
  onTileClick: (a: Assignment, s: Staff) => void;
}

// Providers render as one fixed row each (see WeekGrid) — not a generic RoleRow.
const ROWS: RoleRow[] = [
  personRow('mas', 'Medical Assistants', (d) => d.standaloneMas),
  covererRow('pccs', 'PCC', (d) => d.pccs),
  personRow('estheticians', 'Esthetician', (d) => d.estheticians),
  personRow('wellness', 'Wellness', (d) => d.wellness),
  covererRow('concierge', 'Aesthetic Concierge', (d) => d.concierge),
  personRow('managers', 'Manager', (d) => d.managers),
  personRow('remote', 'Remote Team', (d) => d.remote),
  personRow('off', 'Off', (d) => d.off, true),
  personRow('requestedOff', 'Request Off (R/O)', (d) => d.requestedOff, true),
];

export function WeekGrid({
  days,
  staffById,
  editable,
  warningsByDate,
  taskByStaff,
  onTileClick,
  onDismissWarning,
}: Props) {
  const ctx: CellCtx = { staffById, editable, taskByStaff, onTileClick };
  const rows = ROWS.filter((r) => days.some((d) => r.has(d)));
  const providers = orderedProviders(days);

  return (
    <div
      className="grid gap-x-3 gap-y-2"
      style={{ gridTemplateColumns: `7rem repeat(${days.length}, minmax(13rem, 1fr))` }}
    >
      {/* Header row: empty corner + per-day date / warnings. */}
      <div />
      {days.map((d) => (
        <DayHeader
          key={d.date}
          day={d}
          warnings={warningsByDate.get(d.date) ?? []}
          editable={editable}
          onDismissWarning={onDismissWarning}
        />
      ))}

      {/* Providers: one fixed row each, so each provider holds the same grid
          position all week (empty on days they're off — they show in Off below). */}
      {providers.map((prov, pi) => (
        <Fragment key={prov.id}>
          <div className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {pi === 0 ? 'Providers' : ''}
          </div>
          {days.map((d) => {
            const view = d.providers.find((p) => p.staff.id === prov.id);
            return (
              <div key={d.date} className={`space-y-1 pt-2 ${d.holiday ? 'bg-gray-100' : ''}`}>
                {d.holiday || !view ? null : (
                  <ProviderCard
                    date={d.date}
                    view={view}
                    staffById={staffById}
                    editable={editable}
                    taskByStaff={taskByStaff}
                    onTileClick={onTileClick}
                  />
                )}
              </div>
            );
          })}
        </Fragment>
      ))}

      {rows.map((row) => (
        <Fragment key={row.key}>
          <div
            className={`border-t border-gray-200 pt-2 text-[10px] font-semibold uppercase tracking-wide ${
              row.muted ? 'text-gray-300' : 'text-gray-400'
            }`}
          >
            {row.label}
          </div>
          {days.map((d) => (
            <div
              key={d.date}
              className={`space-y-1 border-t border-gray-200 pt-2 ${
                d.holiday ? 'bg-gray-100' : ''
              }`}
            >
              {d.holiday ? null : row.has(d) ? row.cell(d, ctx) : null}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

function DayHeader({
  day,
  warnings,
  editable,
  onDismissWarning,
}: {
  day: DayModel;
  warnings: Warning[];
  editable: boolean;
  onDismissWarning: (w: Warning) => void;
}) {
  const date = parseIso(day.date);
  return (
    <div className={`space-y-1 ${day.holiday ? 'bg-gray-100 px-1' : ''}`}>
      <div className="flex items-baseline justify-between border-b-2 border-gray-400 pb-1">
        <span className={`text-sm font-semibold ${day.holiday ? 'text-gray-400' : ''}`}>
          {format(date, 'EEE d')}
        </span>
        {day.holiday ? (
          <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Holiday
          </span>
        ) : (
          warnings.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
              ⚠ {warnings.length}
            </span>
          )
        )}
      </div>
      {!day.holiday && warnings.length > 0 && (
        <ul className="space-y-1 rounded bg-amber-50 p-1.5 text-[11px] text-amber-800">
          {warnings.map((w) => (
            <li key={`${w.type}:${w.refKey}`} className="flex items-start gap-1">
              <span className="flex-1">{w.message}</span>
              {editable && (
                <button
                  className="text-amber-500 hover:text-amber-800"
                  title="Dismiss"
                  onClick={() => onDismissWarning(w)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProviderCard({
  date,
  view,
  staffById,
  editable,
  taskByStaff,
  onTileClick,
}: {
  date: string;
  view: ProviderView;
  staffById: Map<string, Staff>;
  editable: boolean;
  taskByStaff: Map<string, number>;
  onTileClick: (a: Assignment, s: Staff) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `provider:${date}:${view.staff.id}`,
    data: { providerId: view.staff.id, date },
    disabled: !editable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded border p-1 ${isOver ? 'border-blue-400 bg-blue-50' : 'border-transparent'}`}
    >
      <StaffTile
        staff={view.staff}
        assignment={view.assignment}
        editable={editable}
        covers={view.coverage}
        onClick={() => onTileClick(view.assignment, view.staff)}
      />
      <div className="mt-1 space-y-0.5 pl-3">
        {[0, 1].map((slot) => {
          const ma = view.mas[slot];
          if (ma) {
            const maStaff = staffById.get(ma.staffId);
            if (!maStaff) return null;
            return (
              <StaffTile
                key={ma.staffId}
                staff={maStaff}
                assignment={ma}
                editable={editable}
                draggableId={`ma:${date}:${ma.staffId}`}
                taskNo={taskByStaff.get(ma.staffId)}
                onClick={() => onTileClick(ma, maStaff)}
              />
            );
          }
          return (
            <div
              key={`empty-${slot}`}
              className="rounded border border-dashed border-gray-200 px-1.5 py-1 text-[10px] text-gray-300"
            >
              MA {slot + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The week's providers in a stable order (by name), unioned across all days so
 *  each provider gets one fixed row even on days they're off. */
function orderedProviders(days: DayModel[]): Staff[] {
  const byId = new Map<string, Staff>();
  for (const d of days) {
    for (const p of d.providers) if (!byId.has(p.staff.id)) byId.set(p.staff.id, p.staff);
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function personRow(
  key: string,
  label: string,
  pick: (d: DayModel) => PersonView[],
  muted?: boolean,
): RoleRow {
  return {
    key,
    label,
    muted,
    has: (d) => pick(d).length > 0,
    cell: (d, ctx) =>
      pick(d).map((p) => (
        <StaffTile
          key={p.staff.id}
          staff={p.staff}
          assignment={p.assignment}
          editable={ctx.editable}
          taskNo={ctx.taskByStaff.get(p.staff.id)}
          onClick={() => ctx.onTileClick(p.assignment, p.staff)}
        />
      )),
  };
}

function covererRow(key: string, label: string, pick: (d: DayModel) => CovererView[]): RoleRow {
  return {
    key,
    label,
    has: (d) => pick(d).length > 0,
    cell: (d, ctx) =>
      pick(d).map((c) => (
        <StaffTile
          key={c.staff.id}
          staff={c.staff}
          assignment={c.assignment}
          editable={ctx.editable}
          covers={c.covers}
          onClick={() => ctx.onTileClick(c.assignment, c.staff)}
        />
      )),
  };
}
