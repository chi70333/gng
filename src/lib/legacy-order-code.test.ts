import { describe, expect, it } from 'vitest';
import {
  createLegacyOrderCode,
  legacyClientIpFromHeaders,
  legacyIpLastOctet,
} from '@/lib/legacy-order-code';

describe('legacy order code', () => {
  it('matches the PHP tradecode shape', () => {
    const code = createLegacyOrderCode({
      now: new Date(1_771_234_567_000),
      clientIp: '203.0.113.244',
      random: () => 0,
    });

    expect(code).toBe('AAA34567244');
  });

  it('uses the first forwarded IPv4 address', () => {
    expect(legacyIpLastOctet('198.51.100.42, 10.0.0.1')).toBe('42');
  });

  it('falls back when the caller IP is not IPv4', () => {
    expect(createLegacyOrderCode({ clientIp: '2001:db8::1', random: () => 25 / 26 })).toMatch(
      /^ZZZ\d{5}0$/,
    );
  });

  it('prefers forwarded headers for legacy IP suffixes', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.77, 10.0.0.1',
      'x-real-ip': '198.51.100.88',
    });

    expect(legacyClientIpFromHeaders(headers)).toBe('198.51.100.77, 10.0.0.1');
  });
});
