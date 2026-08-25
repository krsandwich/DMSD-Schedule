import { useDraggable } from '@dnd-kit/core';
import type { Assignment, Staff } from '@/engine/types';
import { LOCATION_DOT, LOCATION_TILE } from '@/lib/locations';

interface Props {
  staff: Staff;
  assignment: Assignment;
  editable: boolean;
  /** MA tiles can be dragged onto providers to reassign. */
  draggableId?: string;
  onClick?: () => void;
  /** Names this person covers (absent providers, or PCC targets) — shown inside the tile. */
  covers?: Staff[];
  /** The MA this intern shadows this month — shown inside the tile. */
  shadows?: Staff;
  /** Weekly task number (#1–6) for eligible MAs; shown as a badge. */
  taskNo?: number;
  /** Requested-off (R/O): render pink to distinguish from plain Off (grey). */
  requestedOff?: boolean;
}

export function StaffTile({
  staff,
  assignment,
  editable,
  draggableId,
  onClick,
  covers,
  shadows,
  taskNo,
  requestedOff,
}: Props) {
  const drag = useDraggable({
    id: draggableId ?? `static:${assignment.date}:${staff.id}`,
    data: { assignment, staff },
    disabled: !draggableId || !editable,
  });

  const style = drag.transform
    ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={draggableId ? drag.setNodeRef : undefined}
      style={style}
      {...(draggableId && editable ? { ...drag.listeners, ...drag.attributes } : {})}
      onClick={onClick}
      className={`w-full overflow-hidden rounded border px-1.5 py-1 text-xs leading-tight ${
        requestedOff
          ? 'border-pink-300 bg-pink-100 text-pink-700'
          : assignment.isMissedShift
            ? 'border-red-300 bg-red-100 text-red-700'
            : LOCATION_TILE[assignment.location]
      } ${editable ? 'cursor-pointer hover:ring-1 hover:ring-blue-400' : ''} ${
        drag.isDragging ? 'opacity-50' : ''
      }`}
      title={[
        staff.displayName,
        assignment.isMissedShift ? 'Missed Shift' : null,
        assignment.customText,
      ]
        .filter(Boolean)
        .join(' — ')}
    >
      <div className="flex items-center gap-1">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            requestedOff
              ? 'bg-pink-400'
              : assignment.isMissedShift
                ? 'bg-red-400'
                : LOCATION_DOT[assignment.location]
          }`}
        />
        <span className="truncate font-medium text-gray-800">{staff.displayName}</span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {taskNo != null && (
            <span
              title={`Weekly task #${taskNo}`}
              className="rounded bg-orange-100 px-1 text-[10px] font-semibold leading-tight text-orange-700"
            >
              #{taskNo}
            </span>
          )}
          {assignment.isMod && <Badge title="Manager on Duty">MOD</Badge>}
          {assignment.isInventory && (
            <Badge title="Inventory Day" className="bg-amber-800/90">
              INV
            </Badge>
          )}
          {assignment.isShipping && <span title="Shipping">📦</span>}
          {assignment.isSocialMedia && <span title="Social Media">📣</span>}
        </span>
      </div>
      {covers && covers.length > 0 && (
        <p
          className="truncate text-[10px] font-medium text-gray-700"
          title={`covers ${covers.map((s) => s.displayName).join(', ')}`}
        >
          <span className="mr-0.5" aria-hidden>
            🔄
          </span>
          {covers.map((s) => s.displayName).join(', ')}
        </p>
      )}
      {shadows && (
        <p
          className="truncate text-[10px] font-medium text-gray-700"
          title={`shadowing ${shadows.displayName}`}
        >
          <span className="mr-0.5" aria-hidden>
            🎓
          </span>
          Shadowing {shadows.displayName}
        </p>
      )}
      {assignment.customText && (
        <p className="truncate text-[10px] font-medium text-red-600" title={assignment.customText}>
          <span className="mr-0.5" aria-hidden>
            🖊️
          </span>
          {assignment.customText}
        </p>
      )}
    </div>
  );
}

function Badge({
  children,
  title,
  className = 'bg-gray-800/80',
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`rounded px-1 text-[10px] font-semibold leading-tight text-white ${className}`}
    >
      {children}
    </span>
  );
}
