import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import type { Assignment, Staff, Warning } from '@/engine/types';
import type { DayModel, ProviderView } from '@/lib/dayModel';
import { parseIso } from '@/lib/dates';
import { StaffTile } from './StaffTile';

interface Props {
  model: DayModel;
  staffById: Map<string, Staff>;
  editable: boolean;
  warnings: Warning[];
  onTileClick: (assignment: Assignment, staff: Staff) => void;
  onDismissWarning: (w: Warning) => void;
}

export function DayColumn({ model, staffById, editable, warnings, onTileClick, onDismissWarning }: Props) {
  const date = parseIso(model.date);

  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2">
      <div className="flex items-baseline justify-between border-b border-gray-100 pb-1">
        <span className="text-sm font-semibold">{format(date, 'EEE d')}</span>
        {warnings.length > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
            ⚠ {warnings.length}
          </span>
        )}
      </div>

      {warnings.length > 0 && (
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

      {model.mod && (
        <Section label="MOD">
          <StaffTile
            staff={model.mod.staff}
            assignment={model.mod.assignment}
            editable={editable}
            onClick={() => onTileClick(model.mod!.assignment, model.mod!.staff)}
          />
        </Section>
      )}

      <Section label="Providers">
        {model.providers.map((p) => (
          <ProviderCard
            key={p.staff.id}
            date={model.date}
            view={p}
            staffById={staffById}
            editable={editable}
            onTileClick={onTileClick}
          />
        ))}
      </Section>

      {model.coverers.length > 0 && (
        <Section label="PCC / Concierge">
          {model.coverers.map((c) => (
            <div key={c.staff.id}>
              <StaffTile
                staff={c.staff}
                assignment={c.assignment}
                editable={editable}
                onClick={() => onTileClick(c.assignment, c.staff)}
              />
              {c.covers.length > 0 && (
                <p className="pl-3 text-[10px] text-gray-500">
                  covers {c.covers.map((s) => s.displayName).join(', ')}
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

      {model.others.length > 0 && (
        <Section label="Other">
          {model.others.map((o) => (
            <StaffTile
              key={o.staff.id}
              staff={o.staff}
              assignment={o.assignment}
              editable={editable}
              onClick={() => onTileClick(o.assignment, o.staff)}
            />
          ))}
        </Section>
      )}

      {model.offStaff.length > 0 && (
        <details className="text-[11px] text-gray-400">
          <summary className="cursor-pointer">Off ({model.offStaff.length})</summary>
          <p className="pt-1 leading-snug">{model.offStaff.map((s) => s.displayName).join(', ')}</p>
        </details>
      )}
    </div>
  );
}

function ProviderCard({
  date,
  view,
  staffById,
  editable,
  onTileClick,
}: {
  date: string;
  view: ProviderView;
  staffById: Map<string, Staff>;
  editable: boolean;
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
                compact
                draggableId={`ma:${date}:${ma.staffId}`}
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
