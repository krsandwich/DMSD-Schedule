import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import { formatDateRanges, parseDateRanges } from './dateRanges';

const SEPT = parseISO('2026-09-01');
const FEB = parseISO('2026-02-01');
const DEC = parseISO('2026-12-01');

describe('parseDateRanges', () => {
  it('expands bare ranges and singles against the context month, sorted and de-duplicated', () => {
    expect(parseDateRanges('1-3, 8-11', SEPT)).toEqual([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    ]);
    expect(parseDateRanges('15, 2, 2', SEPT)).toEqual(['2026-09-02', '2026-09-15']);
  });

  it('tolerates whitespace, reversed ranges and en-dashes', () => {
    expect(parseDateRanges('  5 – 3 ', SEPT)).toEqual(['2026-09-03', '2026-09-04', '2026-09-05']);
  });

  it('parses explicit M/D dates and ranges, spanning any month', () => {
    expect(parseDateRanges('10/1-10/3', SEPT)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(parseDateRanges('12/1-12/5', SEPT)).toEqual([
      '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05',
    ]);
  });

  it('mixes bare and explicit-month tokens in one input', () => {
    expect(parseDateRanges('1-3, 10/1-10/2', SEPT)).toEqual([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-10-01', '2026-10-02',
    ]);
  });

  it('rolls an explicit month before the context month into next year', () => {
    // December's view spills into January; "1/2" on December's page means next January.
    expect(parseDateRanges('1/2', DEC)).toEqual(['2027-01-02']);
  });

  it('ignores nonexistent calendar dates instead of rolling over', () => {
    expect(parseDateRanges('2/30, 2/28, 4/31', FEB)).toEqual(['2026-02-28']);
  });

  it('ignores invalid tokens and impossible day numbers', () => {
    expect(parseDateRanges('abc, 0, 40, 10', SEPT)).toEqual(['2026-09-10']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseDateRanges('', SEPT)).toEqual([]);
  });
});

describe('formatDateRanges', () => {
  it('collapses consecutive days in the context month back into bare ranges', () => {
    expect(formatDateRanges(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-08'], SEPT)).toBe('1-3, 8');
  });

  it('renders a run outside the context month with explicit M/D', () => {
    expect(formatDateRanges(['2026-10-01', '2026-10-02', '2026-10-03'], SEPT)).toBe('10/1-10/3');
  });

  it('renders a run crossing the month boundary with explicit M/D on both ends', () => {
    expect(formatDateRanges(['2026-09-29', '2026-09-30', '2026-10-01'], SEPT)).toBe('9/29-10/1');
  });

  it('round-trips with parseDateRanges', () => {
    const dates = parseDateRanges('1-3, 8-11, 20, 10/1-10/2', SEPT);
    expect(formatDateRanges(dates, SEPT)).toBe('1-3, 8-11, 20, 10/1-10/2');
  });
});
