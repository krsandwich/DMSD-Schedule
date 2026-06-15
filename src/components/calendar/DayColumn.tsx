import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import type { Assignment, Staff, Warning } from '@/engine/types';
import type { CovererView, DayModel, PersonView, ProviderView } from '@/lib/dayModel';
import { parseIso } from '@/lib/dates';
import { StaffTile } from './StaffTile';

interface Props {
  model: DayModel;
  staffById: Map<string, Staff>;
  editable: boolean;
  warnings: Warning[];
  onTileClick: (assignment: Assignment, staff: Staff) => void;
  onDismissWarning: (w: Warning) => void;
  onToggleShipping: (a: Assignment) => void;
}

export function DayColumn({
  model,
  staffById,
  editable,
  warnings,
  onTileClick,
  onDismissWarning,
  onToggleShipping,
}: Props) {
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

      <PersonSection label="Medical Assistants" people={model.standaloneMas} editable={editable} onTileClick={onTileClick} />
      <PersonSection label="Manager" people={model.managers} editable={editable} onTileClick={onTileClick} />
      <CovererSection
        label="PCC"
        coverers={model.pccs}
        editable={editable}
        onTileClick={onTileClick}
        onToggleShipping={onToggleShipping}
      />
      <CovererSection
        label="Aesthetic Concierge"
        coverers={model.concierge}
        editable={editable}
        onTileClick={onTileClick}
        onToggleShipping={onToggleShipping}
      />
      <PersonSection label="Esthetician" people={model.estheticians} editable={editable} onTileClick={onTileClick} />
      <PersonSection label="Wellness" people={model.wellness} editable={editable} onTileClick={onTileClick} />
      <PersonSection label="Remote Team" people={model.remote} editable={editable} onTileClick={onTileClick} />

      <PersonSection label="Off" people={model.off} editable={editable} onTileClick={onTileClick} muted />
      <PersonSection
        label="Request Off (R/O)"
        people={model.requestedOff}
        editable={editable}
        onTileClick={onTileClick}
        muted
      />
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
      {view.coverage.length > 0 && (
        <p className="pl-3 text-[10px] text-gray-500">covers {view.coverage.map((s) => s.displayName).join(', ')}</p>
      )}
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

function PersonSection({
  label,
  people,
  editable,
  onTileClick,
  muted,
}: {
  label: string;
  people: PersonView[];
  editable: boolean;
  onTileClick: (a: Assignment, s: Staff) => void;
  muted?: boolean;
}) {
  if (people.length === 0) return null;
  return (
    <Section label={`${label} (${people.length})`} muted={muted}>
      {people.map((p) => (
        <StaffTile
          key={p.staff.id}
          staff={p.staff}
          assignment={p.assignment}
          editable={editable}
          onClick={() => onTileClick(p.assignment, p.staff)}
        />
      ))}
    </Section>
  );
}

function CovererSection({
  label,
  coverers,
  editable,
  onTileClick,
  onToggleShipping,
}: {
  label: string;
  coverers: CovererView[];
  editable: boolean;
  onTileClick: (a: Assignment, s: Staff) => void;
  onToggleShipping: (a: Assignment) => void;
}) {
  if (coverers.length === 0) return null;
  return (
    <Section label={`${label} (${coverers.length})`}>
      {coverers.map((c) => (
        <div key={c.staff.id}>
          <StaffTile
            staff={c.staff}
            assignment={c.assignment}
            editable={editable}
            onClick={() => onTileClick(c.assignment, c.staff)}
          />
          {c.covers.length > 0 && (
            <p className="pl-3 text-[10px] text-gray-500">covers {c.covers.map((s) => s.displayName).join(', ')}</p>
          )}
          <label
            className={`flex items-center gap-1 pl-3 text-[10px] ${
              editable ? 'cursor-pointer text-gray-600' : 'text-gray-400'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={c.assignment.isShipping}
              disabled={!editable}
              onChange={() => onToggleShipping(c.assignment)}
            />
            Shipping 📦
          </label>
        </div>
      ))}
    </Section>
  );
}

function Section({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div>
      <p
        className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
          muted ? 'text-gray-300' : 'text-gray-400'
        }`}
      >
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
