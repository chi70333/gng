'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { socialRegisterSchema } from '@/schemas/auth';
import { registerSocialUser } from '@/server/services/auth.service';
import {
  SOCIAL_PENDING_COOKIE,
  decodePendingSocialProfile,
} from '@/server/services/social-pending.service';

const JOIN_TERMS_COOKIE = 'gng_join_terms';

export async function socialRegisterAction(formData: FormData): Promise<void> {
  const acceptedJoinTerms = cookies().get(JOIN_TERMS_COOKIE)?.value === 'y';
  const pendingSocial = decodePendingSocialProfile(cookies().get(SOCIAL_PENDING_COOKIE)?.value);

  if (!pendingSocial) {
    redirect('/login?error=social_expired');
  }

  const parsed = socialRegisterSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    termsAccepted: acceptedJoinTerms ? formData.get('termsAccepted') : null,
    privacyAccepted: acceptedJoinTerms ? formData.get('privacyAccepted') : null,
  });

  if (!parsed.success) {
    redirect('/join/social-connect?error=validation');
  }

  try {
    await registerSocialUser({
      ...parsed.data,
      provider: pendingSocial.provider,
      providerUid: pendingSocial.providerUid,
    });
  } catch {
    redirect('/join/social-connect?error=conflict');
  }

  cookies().delete(JOIN_TERMS_COOKIE);
  cookies().delete(SOCIAL_PENDING_COOKIE);
  redirect('/login?registered=1');
}
