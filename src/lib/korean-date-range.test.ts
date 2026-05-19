import { describe, expect, it } from 'vitest';
import { getKoreanDateParts, koreanDateRangeUtc } from './korean-date-range';

describe('korean date range', () => {
  it('builds a UTC range for one Korea Standard Time day', () => {
    const range = koreanDateRangeUtc({ year: 2026, month: 5, day: 19 });

    expect(range.start.toISOString()).toBe('2026-05-18T15:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-05-19T15:00:00.000Z');
  });

  it('reads date parts in Korea Standard Time', () => {
    const parts = getKoreanDateParts(new Date('2026-05-18T15:30:00.000Z'));

    expect(parts).toEqual({ year: 2026, month: 5, day: 19 });
  });
});
