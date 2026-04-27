// Social join pending state. Short-lived, HTTP-only cookie used between OAuth callback and join consent.

import { createHmac, timingSafeEqual } from 'crypto';

export const SOCIAL_PENDING_COOKIE = 'gng_social_pending';
export const SOCIAL_PENDING_MAX_AGE = 60 * 30;

export type PendingSocialProfile = {
  provider: 'kakao' | 'naver';
  providerUid: string;
  email: string;
  name: string | null;
};

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'gng-local-social-pending';
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encodePendingSocialProfile(profile: PendingSocialProfile): string {
  const payload = base64url(JSON.stringify(profile));
  return `${payload}.${sign(payload)}`;
}

export function decodePendingSocialProfile(value: string | undefined): PendingSocialProfile | null {
  if (!value) return null;

  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;

    const profile = parsed as Record<string, unknown>;
    if (
      (profile.provider === 'kakao' || profile.provider === 'naver') &&
      typeof profile.providerUid === 'string' &&
      typeof profile.email === 'string' &&
      (typeof profile.name === 'string' || profile.name === null)
    ) {
      return {
        provider: profile.provider,
        providerUid: profile.providerUid,
        email: profile.email,
        name: profile.name,
      };
    }
  } catch {
    return null;
  }

  return null;
}
