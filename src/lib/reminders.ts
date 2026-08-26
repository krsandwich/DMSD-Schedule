import { format } from 'date-fns';
import { resolveDateToken } from './dateRanges';

/**
 * Parse Special Reminders free text into ISO date -> reminder text(s). One
 * reminder per line, formatted "20: Monthly staff meeting" or "10/2: Vendor
 * visit" (whitespace around the colon is optional) — the day token uses the
 * same bare/"M/D" parsing as the setup date-range fields: a bare number
 * defaults to `contextMonth`, so a reminder for a trailing spillover date
 * still lives on this same month's page. Lines without a leading day token
 * and colon, with nothing after the colon, or naming a nonexistent calendar
 * date, are silently ignored rather than erroring. Multiple lines can target
 * the same day; each becomes its own callout.
 */
export function parseReminders(text: string, contextMonth: Date): Map<string, string[]> {
  const byDate = new Map<string, string[]>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d{1,2}(?:\/\d{1,2})?)\s*:\s*(.+)$/);
    if (!match) continue;
    const date = resolveDateToken(match[1], contextMonth);
    const reminderText = match[2].trim();
    if (!date || !reminderText) continue;
    const iso = format(date, 'yyyy-MM-dd');
    const list = byDate.get(iso) ?? [];
    list.push(reminderText);
    byDate.set(iso, list);
  }
  return byDate;
}
