import { Link } from 'react-router-dom';
import { monthKey, monthLabel, nextMonth, previousMonth } from '@/lib/dates';
import { LOCATION_DOT, LOCATION_LABEL, SELECTABLE_LOCATIONS } from '@/lib/locations';
import { Button } from '@/components/common/Button';
import { InlineSpinner } from '@/components/common/Spinner';

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
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-2">
      {/*
        Two-tier responsive strategy: the left cluster (nav + legend) and right
        cluster (actions) are each a single flex item here, so on a narrow
        window the WHOLE right cluster drops to its own line below the left
        one — a single clean break — rather than individual buttons peeling
        off in a ragged order. Only if a cluster is narrower than its own
        content does its *internal* flex-wrap kick in as a second fallback.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
                <Button variant="gray">Roster</Button>
              </Link>
              <Link to={`/setup?month=${monthKey(month)}`}>
                <Button variant="gray">Monthly setup</Button>
              </Link>

              <Button onClick={onGenerate} disabled={generating}>
                {generating && <InlineSpinner />}
                {generating ? 'Generating…' : 'Generate month'}
              </Button>
              {canRevert && (
                <Button
                  variant="danger"
                  onClick={onRevert}
                  disabled={generating}
                  title="Restore the schedule to just before the last Generate (undoes the generate and keeps your manual edits)"
                >
                  ↩ Revert
                </Button>
              )}
              <Button
                variant={isPublished ? 'secondary' : 'dark'}
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
      </div>
    </header>
  );
}

/** Color key for tile states, shown as a compact fixed 3x2 grid (two lines). */
function LocationLegend() {
  const items: { label: string; dot: string }[] = [
    ...SELECTABLE_LOCATIONS.map((loc) => ({ label: LOCATION_LABEL[loc], dot: LOCATION_DOT[loc] })),
    // Not real `location` values — display-only tile states (see StaffTile).
    { label: 'Request Off (R/O)', dot: 'bg-pink-400' },
    { label: 'Missed Shift', dot: 'bg-red-400' },
  ];

  return (
    <div className="grid w-fit grid-cols-3 gap-x-3 gap-y-0.5 rounded border border-gray-200 px-2 py-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1 text-xs text-gray-600">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
