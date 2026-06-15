import { Link } from 'react-router-dom';
import { monthLabel, nextMonth, previousMonth } from '@/lib/dates';
import { Button } from '@/components/common/Button';

interface Props {
  month: Date;
  setMonth: (d: Date) => void;
  isEditor: boolean;
  onGenerate: () => void;
  generating: boolean;
  onSignOut: () => void;
}

export function Toolbar({ month, setMonth, isEditor, onGenerate, generating, onSignOut }: Props) {
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

      <div className="ml-auto flex items-center gap-2">
        {isEditor ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Editor
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Viewer
          </span>
        )}
        {isEditor && (
          <>
            <Link to="/setup">
              <Button variant="secondary">Monthly setup</Button>
            </Link>
            <Button onClick={onGenerate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate month'}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
