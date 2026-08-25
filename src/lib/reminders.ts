/**
 * Parse Special Reminders free text into day-of-month -> reminder text(s).
 * One reminder per line, formatted "20: Monthly staff meeting" (whitespace
 * around the colon is optional). Lines without a leading day number and
 * colon, or with nothing after the colon, are silently ignored rather than
 * erroring — same tolerance as the day-range parser elsewhere in setup.
 * Multiple lines can target the same day; each becomes its own callout.
 */
export function parseReminders(text: string): Map<number, string[]> {
  const byDay = new Map<number, string[]>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d{1,2})\s*:\s*(.+)$/);
    if (!match) continue;
    const day = parseInt(match[1], 10);
    const reminderText = match[2].trim();
    if (!reminderText || day < 1 || day > 31) continue;
    const list = byDay.get(day) ?? [];
    list.push(reminderText);
    byDay.set(day, list);
  }
  return byDay;
}
