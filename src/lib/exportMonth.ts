import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { Assignment, Location, Role, Staff } from '@/engine/types';
import { isoOf, weekdayRows } from '@/lib/dates';
import { ROLE_LABEL } from '@/lib/roles';

// Cell fill per location, matching the calendar tile colors (Kona purple, Waimea
// blue, Remote green, Off grey). ARGB = 'FF' + hex.
const FILL: Record<Location, string> = {
  kona: 'FFEDE9FE',
  waimea: 'FFDBEAFE',
  remote: 'FFDCFCE7',
  off: 'FFF3F4F6',
};

const HEADER_FILL = 'FFE5E7EB';
const GRID = 'FFD1D5DB';

const border = {
  top: { style: 'thin' as const, color: { argb: GRID } },
  left: { style: 'thin' as const, color: { argb: GRID } },
  bottom: { style: 'thin' as const, color: { argb: GRID } },
  right: { style: 'thin' as const, color: { argb: GRID } },
};

/** Day-cell text: MOD / shipping / social markers, the MA's provider, who they
 *  cover, and the custom note. (Location is conveyed by the cell color.) */
function cellText(a: Assignment | undefined, staffById: Map<string, Staff>): string {
  if (!a || a.location === 'off') return '';
  const parts: string[] = [];
  if (a.isMod) parts.push('MOD');
  if (a.isShipping) parts.push('📦');
  if (a.isSocialMedia) parts.push('📣');
  if (a.assignedProviderId) {
    const provider = staffById.get(a.assignedProviderId)?.displayName;
    if (provider) parts.push('→ ' + provider);
  }
  const covers = [...a.providerCoverageIds, ...a.pccCoversIds]
    .map((id) => staffById.get(id)?.displayName)
    .filter((n): n is string => !!n);
  if (covers.length) parts.push('covers ' + covers.join(', '));
  if (a.customText) parts.push(a.customText);
  return parts.join(' · ');
}

/**
 * Export one month to an .xlsx: one row per person (frozen on the left), weekdays
 * across grouped by week. Each cell is highlighted by location and holds the
 * coverage names + custom note. Triggers a browser download.
 */
export async function exportMonthToExcel(opts: {
  month: Date;
  monthLabel: string;
  rows: Staff[];
  assignmentsByDate: Map<string, Assignment[]>;
  staffById: Map<string, Staff>;
  /** Weekly task numbers (#1–6) per week, aligned to the week order. */
  weeklyTaskByWeek?: Map<string, number>[];
}): Promise<void> {
  const { month, monthLabel, rows, assignmentsByDate, staffById, weeklyTaskByWeek = [] } = opts;
  const weeks = weekdayRows(month);
  const days = weeks.flat();

  // The first (Monday) cell of each week carries that week's task numbers, so a
  // task shows once per week next to the name rather than on every day cell.
  const taskByFirstDayIso = new Map<string, Map<string, number>>();
  weeks.forEach((wk, w) => taskByFirstDayIso.set(isoOf(wk[0]), weeklyTaskByWeek[w] ?? new Map()));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(monthLabel);

  // Uniform column widths: name column + one per weekday.
  ws.columns = [{ width: 20 }, ...days.map(() => ({ width: 16 }))];

  const weekRow = ws.getRow(1);
  const dayRow = ws.getRow(2);
  weekRow.getCell(1).value = monthLabel;
  dayRow.getCell(1).value = 'Staff';

  // Week labels (row 1, merged over each week) + day headers (row 2).
  let col = 2;
  for (const week of weeks) {
    const start = col;
    for (const d of week) {
      dayRow.getCell(col).value = format(d, 'EEE M/d');
      col += 1;
    }
    const end = col - 1;
    weekRow.getCell(start).value = 'Week of ' + format(week[0], 'MMM d');
    if (end > start) ws.mergeCells(1, start, 1, end);
  }

  for (const r of [weekRow, dayRow]) {
    r.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.border = border;
    });
  }

  // Body: a bold role group row before each role, then one row per person, with
  // every weekday cell highlighted by location.
  const lastCol = days.length + 1;
  let rowIdx = 3;
  let lastRole: Role | null = null;
  for (const s of rows) {
    if (s.role !== lastRole) {
      lastRole = s.role;
      const groupRow = ws.getRow(rowIdx);
      groupRow.getCell(1).value = ROLE_LABEL[s.role];
      for (let c = 1; c <= lastCol; c += 1) {
        const cell = groupRow.getCell(c);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
        cell.border = border;
      }
      rowIdx += 1;
    }

    const row = ws.getRow(rowIdx);
    const nameCell = row.getCell(1);
    nameCell.value = s.displayName;
    nameCell.font = { bold: true };
    nameCell.alignment = { vertical: 'middle', wrapText: false };
    nameCell.border = border;

    days.forEach((d, j) => {
      const a = (assignmentsByDate.get(isoOf(d)) ?? []).find((x) => x.staffId === s.id);
      const cell = row.getCell(2 + j);
      const text = cellText(a, staffById);
      // Weekly task #N (orange) on the first day of the week only.
      const taskNo = taskByFirstDayIso.get(isoOf(d))?.get(s.id);
      if (taskNo != null) {
        cell.value = {
          richText: [
            { text: `#${taskNo}`, font: { bold: true, color: { argb: 'FFEA580C' } } },
            ...(text ? [{ text: ` ${text}` }] : []),
          ],
        };
      } else {
        cell.value = text;
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[a?.location ?? 'off'] } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = border;
    });
    rowIdx += 1;
  }

  // Lock the name column and the two header rows.
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `schedule-${format(month, 'yyyy-MM')}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
