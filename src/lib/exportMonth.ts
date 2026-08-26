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
const WEEK_COLS = 6; // name column + 5 weekdays

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
 * Export one month to an .xlsx: one block per week, stacked vertically (not
 * one continuous row spanning the whole month) — each block is its own
 * mini-table (week label, day headers, one row per person) with a page break
 * after it, so every week prints cleanly on its own page. Each cell is
 * highlighted by location and holds the coverage names + custom note.
 * Triggers a browser download.
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

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(monthLabel);

  // Uniform column widths: name column + one per weekday (a single week only).
  ws.columns = [{ width: 20 }, ...Array.from({ length: 5 }, () => ({ width: 16 }))];
  // Freeze the name column only — there's no single header row to freeze
  // vertically since each week's header repeats further down the sheet.
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 0 }];

  let rowIdx = 1;

  const titleRow = ws.getRow(rowIdx);
  titleRow.getCell(1).value = monthLabel;
  titleRow.getCell(1).font = { bold: true, size: 14 };
  rowIdx += 2; // blank spacer row under the title

  weeks.forEach((week, w) => {
    const taskByStaff = weeklyTaskByWeek[w] ?? new Map();

    // Week label (merged across the block's width) + day headers.
    const weekHeaderRow = ws.getRow(rowIdx);
    weekHeaderRow.getCell(1).value = 'Week of ' + format(week[0], 'MMM d');
    ws.mergeCells(rowIdx, 1, rowIdx, WEEK_COLS);
    rowIdx += 1;

    const dayHeaderRow = ws.getRow(rowIdx);
    dayHeaderRow.getCell(1).value = 'Staff';
    week.forEach((d, i) => {
      dayHeaderRow.getCell(2 + i).value = format(d, 'EEE M/d');
    });
    rowIdx += 1;

    for (const r of [weekHeaderRow, dayHeaderRow]) {
      r.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
        cell.border = border;
      });
    }

    // Body: a bold role group row before each role, then one row per person,
    // for just this week's five days.
    let lastRole: Role | null = null;
    for (const s of rows) {
      if (s.role !== lastRole) {
        lastRole = s.role;
        const groupRow = ws.getRow(rowIdx);
        groupRow.getCell(1).value = ROLE_LABEL[s.role];
        for (let c = 1; c <= WEEK_COLS; c += 1) {
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

      week.forEach((d, j) => {
        const a = (assignmentsByDate.get(isoOf(d)) ?? []).find((x) => x.staffId === s.id);
        const cell = row.getCell(2 + j);
        const text = cellText(a, staffById);
        // Weekly task #N (orange) on the first (Monday) day of the week only.
        const taskNo = j === 0 ? taskByStaff.get(s.id) : undefined;
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

    // Page break after each week (except the last) so every week prints on
    // its own page, plus a blank spacer row for on-screen readability.
    if (w < weeks.length - 1) {
      ws.getRow(rowIdx - 1).addPageBreak();
      rowIdx += 1;
    }
  });

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
