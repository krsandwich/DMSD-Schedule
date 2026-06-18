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
  onExport: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Toolbar({
  month,
  setMonth,
  signedIn,
  isEditor,
  onGenerate,
  generating,
  onExport,
  onSignIn,
  onSignOut,
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
    </div>
  );
}
