import { describe, expect, it } from 'vitest';
import { formatKoreanDate, formatKoreanDateTime } from './format';

describe('format helpers', () => {
  it('formats order date-time without AM/PM or milliseconds', () => {
    expect(formatKoreanDateTime('2026-05-03 00:08:24.037')).toBe('2026-05-03 00:08:24');
  });

  it('formats date values with zero-padded month and day', () => {
    expect(formatKoreanDate('2026-05-03 00:08:24.037')).toBe('2026-05-03');
  });
});
