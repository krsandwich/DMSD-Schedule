import { describe, expect, it } from 'vitest';
import { parseReminders } from './reminders';

describe('parseReminders', () => {
  it('parses "day: text" lines into a day -> texts map', () => {
    const result = parseReminders('20: Monthly staff meeting\n5: Vendor visit');
    expect(result.get(20)).toEqual(['Monthly staff meeting']);
    expect(result.get(5)).toEqual(['Vendor visit']);
  });

  it('tolerates missing/extra whitespace around the colon', () => {
    const result = parseReminders('12:Doctor conference\n 8 :  Team lunch  ');
    expect(result.get(12)).toEqual(['Doctor conference']);
    expect(result.get(8)).toEqual(['Team lunch']);
  });

  it('supports multiple reminders on the same day', () => {
    const result = parseReminders('20: Staff meeting\n20: Also inventory count');
    expect(result.get(20)).toEqual(['Staff meeting', 'Also inventory count']);
  });

  it('ignores blank lines and malformed lines without crashing', () => {
    const result = parseReminders('\n\nnot a reminder\n20: Real one\n:no day\n99: out of range');
    expect(result.size).toBe(1);
    expect(result.get(20)).toEqual(['Real one']);
  });

  it('returns an empty map for empty input', () => {
    expect(parseReminders('').size).toBe(0);
  });
});
