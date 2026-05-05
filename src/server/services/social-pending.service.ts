// Social join pending state. Short-lived, HTTP-only cookie used between OAuth callback and join consent.

import { createHmac, timingSafeEqual } from 'crypto';

export const SOCIAL_PENDING_COOKIE = 'gng_social_pending';
export const SOCIAL_CALLBACK_COOKIE = 'gng_social_callback';
export const SOCIAL_PENDING_MAX_AGE = 60 * 30;
export const SOCIAL_REGISTRATION_TOKEN_MAX_AGE = 60;

export type PendingSocialProfile = {
  provider: 'kakao' | 'naver';
  providerUid: string;
  email: string;
  name: string | null;
  phone: string | null;
  callbackUrl: string;
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

function encodeSignedPayload(value: unknown): string {
  const payload = base64url(JSON.stringify(value));
  return `${payload}.${sign(payload)}`;
}

function decodeSignedPayload(value: string | undefined): unknown {
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
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

export function sanitizeCallbackUrl(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  return trimmed;
}

export function encodePendingSocialProfile(profile: PendingSocialProfile): string {
  return encodeSignedPayload(profile);
}

export function decodePendingSocialProfile(value: string | undefined): PendingSocialProfile | null {
  const parsed = decodeSignedPayload(value);
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
      phone: typeof profile.phone === 'string' ? profile.phone : null,
      callbackUrl: sanitizeCallbackUrl(profile.callbackUrl),
    };
  }

  return null;
}

export type SocialRegistrationToken = {
  userId: string;
  email: string;
  name: string;
  exp: number;
};

export function encodeSocialRegistrationToken(input: Omit<SocialRegistrationToken, 'exp'>): string {
  return encodeSignedPayload({
    ...input,
    exp: Math.floor(Date.now() / 1000) + SOCIAL_REGISTRATION_TOKEN_MAX_AGE,
  });
}

export function decodeSocialRegistrationToken(
  value: string | undefined,
): SocialRegistrationToken | null {
  const parsed = decodeSignedPayload(value);
  if (typeof parsed !== 'object' || parsed === null) return null;

  const token = parsed as Record<string, unknown>;
  if (
    typeof token.userId === 'string' &&
    typeof token.email === 'string' &&
    typeof token.name === 'string' &&
    typeof token.exp === 'number' &&
    token.exp >= Math.floor(Date.now() / 1000)
  ) {
    return {
      userId: token.userId,
      email: token.email,
      name: token.name,
      exp: token.exp,
    };
  }

  return null;
}
