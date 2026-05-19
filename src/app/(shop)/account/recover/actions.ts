'use server';

import { redirect } from 'next/navigation';
import { passwordResetSchema } from '@/schemas/account';
import { resetAccountPassword } from '@/server/services/account.service';

export async function recoverAccountAction(formData: FormData): Promise<void> {
  const parsed = passwordResetSchema.safeParse({
    loginId: formData.get('loginId'),
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  });

  if (!parsed.success) {
    redirect('/account/recover?error=validation');
  }

  await resetAccountPassword(parsed.data);

  redirect('/account/recover?reset=1');
}
