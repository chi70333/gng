'use server';

import { AuthError } from 'next-auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { socialRegisterSchema } from '@/schemas/auth';
import { signIn } from '@/server/auth';
import { registerSocialUser } from '@/server/services/auth.service';
import {
  SOCIAL_CALLBACK_COOKIE,
  SOCIAL_PENDING_COOKIE,
  SOCIAL_PENDING_MAX_AGE,
  decodePendingSocialProfile,
  encodeSocialRegistrationToken,
  sanitizeCallbackUrl,
} from '@/server/services/social-pending.service';

const JOIN_TERMS_COOKIE = 'gng_join_terms';

function socialRegisteredCallbackUrl(callbackUrl: string): string {
  const [pathWithQuery = '/', hash = ''] = callbackUrl.split('#');
  const separator = pathWithQuery.includes('?') ? '&' : '?';
  return `${pathWithQuery}${separator}registered=1${hash ? `#${hash}` : ''}`;
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof err.digest === 'string' &&
    err.digest.startsWith('NEXT_REDIRECT')
  );
}

export async function startKakaoJoinAction(formData: FormData): Promise<void> {
  if (!process.env.KAKAO_CLIENT_ID) {
    redirect('/join/terms?error=oauth_config');
  }

  const callbackUrl = sanitizeCallbackUrl(formData.get('callbackUrl'));

  cookies().set(SOCIAL_CALLBACK_COOKIE, callbackUrl, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SOCIAL_PENDING_MAX_AGE,
    path: '/',
  });

  try {
    await signIn('kakao', {
      redirectTo: callbackUrl,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof AuthError) redirect('/join/terms?error=oauth');
    redirect('/join/terms?error=unknown');
  }
}

export async function acceptJoinTermsAction(formData: FormData): Promise<void> {
  const social = formData.get('social');

  if (formData.get('terms') !== 'y' || formData.get('privacy') !== 'y') {
    const query = social === 'kakao' || social === 'naver' ? `&social=${social}` : '';
    redirect(`/join/terms?error=required${query}`);
  }

  cookies().set(JOIN_TERMS_COOKIE, 'y', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    path: '/',
  });

  const pendingSocial = decodePendingSocialProfile(cookies().get(SOCIAL_PENDING_COOKIE)?.value);
  if (social === 'kakao' && pendingSocial?.provider === 'kakao') {
    const parsed = socialRegisterSchema.safeParse({
      email: pendingSocial.email,
      name: pendingSocial.name,
      phone: pendingSocial.phone,
      zipCode: '',
      address1: '',
      address2: '',
      memberType: 'M',
      companyName: '',
      ceoName: '',
      businessNumber: '',
      businessType: '',
      businessItem: '',
      businessZipCode: '',
      businessAddress1: '',
      businessAddress2: '',
      marketingAccepted: 'n',
      smsAccepted: 'n',
      termsAccepted: 'y',
      privacyAccepted: 'y',
    });

    if (!parsed.success) {
      redirect('/join/social-connect?error=phone_required');
    }

    let user;
    try {
      user = await registerSocialUser({
        ...parsed.data,
        provider: pendingSocial.provider,
        providerUid: pendingSocial.providerUid,
      });
    } catch {
      redirect('/join/social-connect?error=conflict');
    }

    cookies().delete(JOIN_TERMS_COOKIE);
    cookies().delete(SOCIAL_PENDING_COOKIE);
    cookies().delete(SOCIAL_CALLBACK_COOKIE);

    try {
      await signIn('social-registration', {
        token: encodeSocialRegistrationToken({
          userId: user.id,
          email: user.email,
          name: user.name,
        }),
        redirectTo: socialRegisteredCallbackUrl(pendingSocial.callbackUrl),
      });
    } catch (err) {
      if (isRedirectError(err)) throw err;
      if (err instanceof AuthError) redirect('/login?registered=1');
      redirect('/login?registered=1');
    }
  }

  if (social === 'naver' && pendingSocial?.provider === social) {
    redirect('/join/social-connect');
  }

  redirect('/join');
}
