import { useState } from 'react';
import type { Assignment, Staff } from '@/engine/types';
import { LOCATION_LABEL, SELECTABLE_LOCATIONS } from '@/lib/locations';
import { isSupportRole } from '@/lib/roles';
import { Button } from '@/components/common/Button';

interface Props {
  staff: Staff;
  staffById: Map<string, Staff>;
  assignment: Assignment;
  /** All assignments for the same day, to populate provider / target selects. */
  dayAssignments: Assignment[];
  allStaff: Staff[];
  /** Providers flagged for coverage this month (both need and can provide it). */
  coverageStaffIds: Set<string>;
  onSave: (next: Assignment) => void;
  onClose: () => void;
}

export function AssignmentEditor({
  staff,
  staffById,
  assignment,
  dayAssignments,
  allStaff,
  coverageStaffIds,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<Assignment>(assignment);
  const set = (patch: Partial<Assignment>) => setDraft((d) => ({ ...d, ...patch }));

  const present = new Set(dayAssignments.map((a) => a.staffId));
  const workingProviders = allStaff.filter((s) => s.receivesMas && present.has(s.id));
  const outProviders = allStaff.filter(
    (s) => s.role === 'provider' && coverageStaffIds.has(s.id) && !present.has(s.id),
  );
  const pccTargets = allStaff.filter((s) => s.needsPcc && present.has(s.id));

  // MAs — and managers, manually — can be assigned under a provider.
  const canBeMa = staff.role === 'ma' || staff.role === 'manager';
  // Only coverage-flagged providers can be assigned to cover absent providers.
  const canCover = staff.role === 'provider' && coverageStaffIds.has(staff.id);
  const isCoverer = staff.role === 'pcc' || staff.role === 'aesthetic_concierge';
  // MAs and support roles can be MOD / handle shipping.
  const canModOrShip = staff.role === 'ma' || isSupportRole(staff.role);

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-80 overflow-y-auto bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{staff.displayName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">{assignment.date}</p>

        <Field label="Location">
          <select
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={draft.location}
            onChange={(e) => set({ location: e.target.value as Assignment['location'] })}
          >
            {SELECTABLE_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {LOCATION_LABEL[loc]}
              </option>
            ))}
          </select>
        </Field>

        {canModOrShip && (
          <Toggle
            label="Manager on Duty (MOD)"
            checked={draft.isMod}
            onChange={(v) => set({ isMod: v, assignedProviderId: v ? null : draft.assignedProviderId })}
          />
        )}

        {canBeMa && (
          <Field label="Assigned provider">
            <select
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={draft.assignedProviderId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                set({ assignedProviderId: id, maSlot: id ? (draft.maSlot ?? 1) : null });
              }}
            >
              <option value="">— Unassigned —</option>
              {workingProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </Field>
        )}

        {canCover && outProviders.length > 0 && (
          <Field label="Coverage (absent providers)">
            <div className="space-y-1">
              {outProviders.map((p) => (
                <Check
                  key={p.id}
                  label={p.displayName}
                  checked={draft.providerCoverageIds.includes(p.id)}
                  onChange={() => set({ providerCoverageIds: toggleId(draft.providerCoverageIds, p.id) })}
                />
              ))}
            </div>
          </Field>
        )}

        {isCoverer && (
          <Field label="PCC covers">
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {pccTargets.map((t) => (
                <Check
                  key={t.id}
                  label={t.displayName}
                  checked={draft.pccCoversIds.includes(t.id)}
                  onChange={() => set({ pccCoversIds: toggleId(draft.pccCoversIds, t.id) })}
                />
              ))}
            </div>
          </Field>
        )}

        {canModOrShip && (
          <Toggle label="Shipping 📦" checked={draft.isShipping} onChange={(v) => set({ isShipping: v })} />
        )}

        {staff.role === 'ma' && (
          <Toggle
            label="Social Media 📣"
            checked={draft.isSocialMedia}
            onChange={(v) => set({ isSocialMedia: v })}
          />
        )}

        <Field label="Custom note">
          <textarea
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            rows={2}
            value={draft.customText ?? ''}
            onChange={(e) => set({ customText: e.target.value || null })}
          />
        </Field>

        {draft.assignedProviderId && (
          <p className="mb-3 text-xs text-gray-500">
            Provider: {staffById.get(draft.assignedProviderId)?.displayName}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button onClick={() => onSave(draft)}>Save</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-3 flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
