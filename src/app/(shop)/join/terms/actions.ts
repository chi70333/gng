'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  SOCIAL_PENDING_COOKIE,
  decodePendingSocialProfile,
} from '@/server/services/social-pending.service';

const JOIN_TERMS_COOKIE = 'gng_join_terms';

export async function acceptJoinTermsAction(formData: FormData): Promise<void> {
  if (formData.get('terms') !== 'y' || formData.get('privacy') !== 'y') {
    redirect('/join/terms?error=required');
  }

  cookies().set(JOIN_TERMS_COOKIE, 'y', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    path: '/',
  });

  const social = formData.get('social');
  const pendingSocial = decodePendingSocialProfile(cookies().get(SOCIAL_PENDING_COOKIE)?.value);
  if (
    (social === 'kakao' || social === 'naver') &&
    pendingSocial?.provider === social
  ) {
    redirect('/join/social-connect');
  }

  redirect('/join');
}
