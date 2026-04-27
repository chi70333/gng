import { describe, expect, it } from 'vitest';
import {
  decodePendingSocialProfile,
  decodeSocialRegistrationToken,
  encodePendingSocialProfile,
  encodeSocialRegistrationToken,
  sanitizeCallbackUrl,
} from './social-pending.service';

describe('social pending profile', () => {
  it('keeps a safe callback URL with pending social profile data', () => {
    const encoded = encodePendingSocialProfile({
      provider: 'kakao',
      providerUid: 'kakao-123',
      email: 'social@example.com',
      name: '홍길동',
      callbackUrl: '/order',
    });

    expect(decodePendingSocialProfile(encoded)).toMatchObject({
      provider: 'kakao',
      providerUid: 'kakao-123',
      callbackUrl: '/order',
    });
  });

  it('falls back unsafe callback URLs to the shop root', () => {
    expect(sanitizeCallbackUrl('https://example.com')).toBe('/');
    expect(sanitizeCallbackUrl('//example.com')).toBe('/');
    expect(sanitizeCallbackUrl('/cart')).toBe('/cart');
  });
});

describe('social registration token', () => {
  it('round-trips a short-lived login token', () => {
    const encoded = encodeSocialRegistrationToken({
      userId: '10',
      email: 'social@example.com',
      name: '홍길동',
    });

    expect(decodeSocialRegistrationToken(encoded)).toMatchObject({
      userId: '10',
      email: 'social@example.com',
      name: '홍길동',
    });
  });
});
