import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { parseReminders } from './reminders';

const SEPT = parseISO('2026-09-01');

describe('parseReminders', () => {
  it('parses "day: text" lines into an ISO-date -> texts map, defaulting to the context month', () => {
    const result = parseReminders('20: Monthly staff meeting\n5: Vendor visit', SEPT);
    expect(result.get('2026-09-20')).toEqual(['Monthly staff meeting']);
    expect(result.get('2026-09-05')).toEqual(['Vendor visit']);
  });

  it('supports an explicit "M/D: text" line for a spillover date', () => {
    const result = parseReminders('10/2: Vendor visit', SEPT);
    expect(result.get('2026-10-02')).toEqual(['Vendor visit']);
  });

  it('tolerates missing/extra whitespace around the colon', () => {
    const result = parseReminders('12:Doctor conference\n 8 :  Team lunch  ', SEPT);
    expect(result.get('2026-09-12')).toEqual(['Doctor conference']);
    expect(result.get('2026-09-08')).toEqual(['Team lunch']);
  });

  it('supports multiple reminders on the same day', () => {
    const result = parseReminders('20: Staff meeting\n20: Also inventory count', SEPT);
    expect(result.get('2026-09-20')).toEqual(['Staff meeting', 'Also inventory count']);
  });

  it('ignores blank lines, malformed lines, and nonexistent dates without crashing', () => {
    const result = parseReminders('\n\nnot a reminder\n20: Real one\n:no day\n2/30: impossible date', SEPT);
    expect(result.size).toBe(1);
    expect(result.get('2026-09-20')).toEqual(['Real one']);
  });

  it('returns an empty map for empty input', () => {
    expect(parseReminders('', SEPT).size).toBe(0);
  });
});
