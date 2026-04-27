'use server';

import { AuthError } from 'next-auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginSchema, socialLoginSchema } from '@/schemas/auth';
import { signIn } from '@/server/auth';
import { SOCIAL_CALLBACK_COOKIE, SOCIAL_PENDING_MAX_AGE } from '@/server/services/social-pending.service';

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof err.digest === 'string' &&
    err.digest.startsWith('NEXT_REDIRECT')
  );
}

function isSocialProviderConfigured(provider: 'kakao' | 'naver'): boolean {
  if (provider === 'kakao') {
    return Boolean(process.env.KAKAO_CLIENT_ID);
  }

  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({
    loginId: formData.get('loginId'),
    password: formData.get('password'),
  });
  const callbackUrl = socialLoginSchema.parse({
    callbackUrl: formData.get('callbackUrl'),
    provider: 'kakao',
  }).callbackUrl;

  if (!parsed.success) {
    redirect('/login?error=validation');
  }

  try {
    await signIn('credentials', {
      loginId: parsed.data.loginId,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof AuthError) {
      redirect('/login?error=credentials');
    }
    redirect('/login?error=unknown');
  }
}

export async function socialLoginAction(formData: FormData): Promise<void> {
  const parsed = socialLoginSchema.safeParse({
    provider: formData.get('provider'),
    callbackUrl: formData.get('callbackUrl'),
  });

  if (!parsed.success) {
    redirect('/login?error=validation');
  }

  if (!isSocialProviderConfigured(parsed.data.provider)) {
    redirect('/login?error=oauth_config');
  }

  cookies().set(SOCIAL_CALLBACK_COOKIE, parsed.data.callbackUrl, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SOCIAL_PENDING_MAX_AGE,
    path: '/',
  });

  await signIn(parsed.data.provider, {
    redirectTo: parsed.data.callbackUrl,
  });
}
