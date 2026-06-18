import { Fragment, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { Role, Staff } from '@/engine/types';
import { useSession } from '@/hooks/useSession';
import { useAllStaff, useAddStaff, useDeleteStaff, useSetStaffActive } from '@/hooks/useStaff';
import { ROLE_LABEL, ROLE_ORDER, roleRank } from '@/lib/roles';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';

export function RosterPage() {
  const { isEditor } = useSession();
  const staffQuery = useAllStaff();
  const addStaff = useAddStaff();
  const setActive = useSetStaffActive();
  const deleteStaff = useDeleteStaff();

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('ma');
  const [showInactive, setShowInactive] = useState(false);
  const [status, setStatus] = useState('');

  const staff = useMemo(
    () =>
      [...(staffQuery.data ?? [])].sort(
        (a, b) => roleRank(a.role) - roleRank(b.role) || a.displayName.localeCompare(b.displayName),
      ),
    [staffQuery.data],
  );

  if (!isEditor) return <Navigate to="/" replace />;
  if (staffQuery.isLoading) return <Spinner label="Loading roster…" />;

  const visible = showInactive ? staff : staff.filter((s) => s.active);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStatus('');
    try {
      await addStaff.mutateAsync({ name: trimmed, role });
      setName('');
      setStatus(`Added ${trimmed}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'name must be unique';
      setStatus(`Could not add: ${msg}`);
    }
  };

  const remove = async (s: Staff) => {
    const ok = window.confirm(
      `Permanently delete ${s.displayName}? This also erases all of their schedule history and cannot be undone.`,
    );
    if (!ok) return;
    setStatus('');
    try {
      await deleteStaff.mutateAsync(s.id);
      setStatus(`Deleted ${s.displayName}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      setStatus(`Could not delete: ${msg}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link to="/">
          <Button variant="ghost">‹ Calendar</Button>
        </Link>
        <h1 className="text-sm font-semibold">Roster</h1>
        <div className="ml-auto flex items-center gap-3">
          {status && <span className="text-xs text-gray-500">{status}</span>}
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {/* Add person */}
        <div className="mb-6 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-gray-600">
            Name
            <input
              className="mt-1 w-56 rounded border border-gray-300 px-2 py-1 text-sm"
              value={name}
              placeholder="e.g. PA Jordan"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </label>
          <label className="flex flex-col text-xs text-gray-600">
            Role
            <select
              className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={add} disabled={addStaff.isPending || !name.trim()}>
            + Add person
          </Button>
        </div>

        {/* Roster list grouped by role */}
        <table className="w-full max-w-2xl border-collapse text-sm">
          <tbody>
            {visible.map((s, i) => {
              const showGroupHeader = i === 0 || visible[i - 1].role !== s.role;
              return (
                <Fragment key={s.id}>
                  {showGroupHeader && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {ROLE_LABEL[s.role]}
                      </td>
                    </tr>
                  )}
                  <RosterRow
                    staff={s}
                    onToggle={(active) => setActive.mutate({ id: s.id, active })}
                    onDelete={() => remove(s)}
                    deleting={deleteStaff.isPending}
                  />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </main>
    </div>
  );
}

function RosterRow({
  staff,
  onToggle,
  onDelete,
  deleting,
}: {
  staff: Staff;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <tr className="border-t border-gray-100">
      <td className="p-2">
        <span className={staff.active ? 'font-medium' : 'text-gray-400 line-through'}>
          {staff.displayName}
        </span>
        {!staff.active && <span className="ml-2 text-[10px] uppercase text-gray-400">inactive</span>}
      </td>
      <td className="p-2 text-right">
        {staff.active ? (
          <Button variant="ghost" onClick={() => onToggle(false)}>
            Deactivate
          </Button>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button variant="secondary" onClick={() => onToggle(true)}>
              Reactivate
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={deleting}>
              Delete
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
