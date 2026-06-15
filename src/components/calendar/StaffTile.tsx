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
  compact?: boolean;
}

export function StaffTile({ staff, assignment, editable, draggableId, onClick, compact }: Props) {
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
      className={`flex items-center gap-1 rounded border px-1.5 py-1 text-xs leading-tight ${
        LOCATION_TILE[assignment.location]
      } ${editable ? 'cursor-pointer hover:ring-1 hover:ring-blue-400' : ''} ${
        drag.isDragging ? 'opacity-50' : ''
      }`}
      title={staff.displayName}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${LOCATION_DOT[assignment.location]}`} />
      <span className="truncate font-medium text-gray-800">{staff.displayName}</span>
      {!compact && (
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {assignment.isMod && <Badge title="Manager on Duty">MOD</Badge>}
          {assignment.isShipping && <span title="Shipping">📦</span>}
          {assignment.isSocialMedia && <span title="Social Media">📣</span>}
          {assignment.providerCoverageIds.length > 0 && (
            <Badge title="Covering absent providers">+{assignment.providerCoverageIds.length}</Badge>
          )}
          {assignment.customText && <span title={assignment.customText}>📝</span>}
        </span>
      )}
    </div>
  );
}

function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="rounded bg-gray-800/80 px-1 text-[10px] font-semibold leading-tight text-white"
    >
      {children}
    </span>
  );
}
