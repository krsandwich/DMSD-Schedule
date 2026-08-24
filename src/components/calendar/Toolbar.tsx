import { Link } from 'react-router-dom';
import { monthLabel, nextMonth, previousMonth } from '@/lib/dates';
import { LOCATION_DOT, LOCATION_LABEL, SELECTABLE_LOCATIONS } from '@/lib/locations';
import { Button } from '@/components/common/Button';

interface Props {
  month: Date;
  setMonth: (d: Date) => void;
  signedIn: boolean;
  isEditor: boolean;
  onGenerate: () => void;
  generating: boolean;
  /** Restore the schedule to the snapshot taken before the last Generate. */
  onRevert: () => void;
  /** A snapshot exists to revert to. */
  canRevert: boolean;
  onExport: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  /** Whether the selected month is published (visible to viewers). */
  isPublished: boolean;
  onTogglePublish: () => void;
  publishPending: boolean;
}

export function Toolbar({
  month,
  setMonth,
  signedIn,
  isEditor,
  onGenerate,
  generating,
  onRevert,
  canRevert,
  onExport,
  onSignIn,
  onSignOut,
  isPublished,
  onTogglePublish,
  publishPending,
}: Props) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={() => setMonth(previousMonth(month))}>
          ‹
        </Button>
        <span className="min-w-40 text-center text-sm font-semibold">{monthLabel(month)}</span>
        <Button variant="ghost" onClick={() => setMonth(nextMonth(month))}>
          ›
        </Button>
        {isEditor && (
          <span
            title={isPublished ? 'Visible to viewers' : 'Hidden from viewers'}
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isPublished ? 'Published' : 'Draft'}
          </span>
        )}
      </div>

      <LocationLegend />

      <div className="ml-auto flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isEditor ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isEditor ? 'Editor' : 'Viewer'}
        </span>
        <Button variant="secondary" onClick={onExport}>
          Export Excel
        </Button>
        {isEditor && (
          <>
            <Link to="/roster">
              <Button variant="secondary">Roster</Button>
            </Link>
            <Link to="/setup">
              <Button variant="secondary">Monthly setup</Button>
            </Link>
            <Button onClick={onGenerate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate month'}
            </Button>
            {canRevert && (
              <Button
                variant="secondary"
                onClick={onRevert}
                disabled={generating}
                title="Restore the schedule to just before the last Generate (undoes the generate and keeps your manual edits)"
              >
                ↩ Revert last Generate
              </Button>
            )}
            <Button
              variant={isPublished ? 'secondary' : 'primary'}
              onClick={onTogglePublish}
              disabled={publishPending}
              title={
                isPublished
                  ? 'Published — click to hide this month from viewers'
                  : 'Not published — click to make this month visible to viewers'
              }
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </>
        )}
        {signedIn ? (
          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        ) : (
          <Button onClick={onSignIn}>Sign in</Button>
        )}
      </div>
    </header>
  );
}

/** Color key for location tiles, shown in the top bar. */
function LocationLegend() {
  return (
    <div className="flex items-center gap-3 rounded border border-gray-200 px-2 py-1">
      {SELECTABLE_LOCATIONS.map((loc) => (
        <span key={loc} className="flex items-center gap-1 text-xs text-gray-600">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LOCATION_DOT[loc]}`} />
          {LOCATION_LABEL[loc]}
        </span>
      ))}
      {/* Requested off (R/O) is not a location — it renders pink (see StaffTile). */}
      <span className="flex items-center gap-1 text-xs text-gray-600">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400" />
        Request Off (R/O)
      </span>
    </div>
  );
}
