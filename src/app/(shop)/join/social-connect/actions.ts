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
  decodePendingSocialProfile,
  encodeSocialRegistrationToken,
} from '@/server/services/social-pending.service';

const JOIN_TERMS_COOKIE = 'gng_join_terms';

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof err.digest === 'string' &&
    err.digest.startsWith('NEXT_REDIRECT')
  );
}

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
    zipCode: formData.get('zipCode'),
    address1: formData.get('address1'),
    address2: formData.get('address2'),
    memberType: formData.get('memberType') === 'D' ? 'D' : 'M',
    companyName: formData.get('companyName'),
    ceoName: formData.get('ceoName'),
    businessNumber: formData.get('businessNumber'),
    businessType: formData.get('businessType'),
    businessItem: formData.get('businessItem'),
    businessZipCode: formData.get('businessZipCode'),
    businessAddress1: formData.get('businessAddress1'),
    businessAddress2: formData.get('businessAddress2'),
    marketingAccepted: formData.get('marketingAccepted') === 'y' ? 'y' : 'n',
    smsAccepted: formData.get('smsAccepted') === 'y' ? 'y' : 'n',
    termsAccepted: acceptedJoinTerms ? formData.get('termsAccepted') : null,
    privacyAccepted: acceptedJoinTerms ? formData.get('privacyAccepted') : null,
  });

  if (!parsed.success) {
    redirect('/join/social-connect?error=validation');
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
      redirectTo: pendingSocial.callbackUrl,
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof AuthError) redirect('/login?registered=1');
    redirect('/login?registered=1');
  }
}
