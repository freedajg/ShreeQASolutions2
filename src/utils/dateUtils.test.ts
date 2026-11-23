import { describe, expect, it } from 'vitest';
import { formatStandardDate } from './dateUtils';

describe('formatStandardDate', () => {
  it('formats a date-only string as dd-MMM-yyyy, read by its parts', () => {
    expect(formatStandardDate('2026-03-12')).toBe('12-Mar-2026');
  });

  it('pads the day with a leading zero', () => {
    expect(formatStandardDate('2026-10-01')).toBe('01-Oct-2026');
  });

  it('shows September as "Sep", never "Sept"', () => {
    expect(formatStandardDate('2026-09-28')).toBe('28-Sep-2026');
  });

  it('uses the fixed English month names in order', () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      formatStandardDate(`2026-${String(i + 1).padStart(2, '0')}-15`).slice(3, 6),
    );
    expect(months).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
  });

  it('shows a timestamp as its calendar day in IST', () => {
    // 27-Sep 20:00 UTC is 28-Sep 01:30 IST.
    expect(formatStandardDate('2026-09-27T20:00:00Z')).toBe('28-Sep-2026');
  });

  it('shows a Date object as its calendar day in IST', () => {
    // 30-Sep 20:00 UTC is 01-Oct 01:30 IST.
    expect(formatStandardDate(new Date('2026-09-30T20:00:00Z'))).toBe('01-Oct-2026');
  });

  it('rolls over the year boundary in IST', () => {
    // 31-Dec 20:00 UTC is 01-Jan 01:30 IST.
    expect(formatStandardDate('2026-12-31T20:00:00Z')).toBe('01-Jan-2027');
  });

  it('gives an em dash for an invalid string', () => {
    expect(formatStandardDate('not a date')).toBe('—');
  });

  it('gives an em dash for empty or null input', () => {
    expect(formatStandardDate('')).toBe('—');
    expect(formatStandardDate(null as unknown as string)).toBe('—');
  });
});
