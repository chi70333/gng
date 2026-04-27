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
    zipCode: formData.get('zipCode'),
    address1: formData.get('address1'),
    address2: formData.get('address2'),
    password: formData.get('password'),
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
