import { describe, expect, it } from 'vitest';
import { formatDayRanges, parseDayRanges } from './dayRanges';

describe('parseDayRanges', () => {
  it('expands ranges and singles, sorted and de-duplicated', () => {
    expect(parseDayRanges('1-3, 8-11')).toEqual([1, 2, 3, 8, 9, 10, 11]);
    expect(parseDayRanges('15, 2, 2')).toEqual([2, 15]);
  });

  it('tolerates whitespace, reversed ranges and en-dashes', () => {
    expect(parseDayRanges('  5 – 3 ')).toEqual([3, 4, 5]);
  });

  it('ignores invalid tokens and out-of-range days', () => {
    expect(parseDayRanges('abc, 0, 40, 10')).toEqual([10]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseDayRanges('')).toEqual([]);
  });
});

describe('formatDayRanges', () => {
  it('collapses consecutive days back into ranges', () => {
    expect(formatDayRanges([1, 2, 3, 8])).toBe('1-3, 8');
  });

  it('round-trips with parseDayRanges', () => {
    expect(formatDayRanges(parseDayRanges('1-3, 8-11, 20'))).toBe('1-3, 8-11, 20');
  });
});
