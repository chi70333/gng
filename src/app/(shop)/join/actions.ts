'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { registerSchema } from '@/schemas/auth';
import { registerUser } from '@/server/services/auth.service';

export async function registerAction(formData: FormData): Promise<void> {
  const acceptedJoinTerms = cookies().get('gng_join_terms')?.value === 'y';
  const parsed = registerSchema.safeParse({
    loginId: formData.get('loginId'),
    email: formData.get('email'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    termsAccepted: acceptedJoinTerms ? formData.get('termsAccepted') : null,
    privacyAccepted: acceptedJoinTerms ? formData.get('privacyAccepted') : null,
  });

  if (!parsed.success) {
    redirect('/join?error=validation');
  }

  try {
    await registerUser(parsed.data);
  } catch {
    redirect('/join?error=conflict');
  }

  cookies().delete('gng_join_terms');
  redirect('/login?registered=1');
}
