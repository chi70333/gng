import { describe, expect, it } from 'vitest';
import { formatKoreanDate, formatKoreanDateTime } from './format';

describe('format helpers', () => {
  it('formats order date-time in Korea time without AM/PM or milliseconds', () => {
    expect(formatKoreanDateTime('2026-05-03T00:45:05.000Z')).toBe('2026-05-03 09:45:05');
  });

  it('formats date values with zero-padded month and day', () => {
    expect(formatKoreanDate('2026-05-02T15:08:24.037Z')).toBe('2026-05-03');
  });
});
