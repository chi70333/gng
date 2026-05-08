'use server';

import { redirect } from 'next/navigation';
import { accountRecoverSchema } from '@/schemas/account';
import { requestAccountRecovery } from '@/server/services/account.service';

export async function recoverAccountAction(formData: FormData): Promise<void> {
  const parsed = accountRecoverSchema.safeParse({
    loginId: formData.get('loginId'),
    email: formData.get('email'),
  });

  const issued = parsed.success ? await requestAccountRecovery(parsed.data) : false;

  redirect(issued ? '/account/recover?sent=1' : '/account/recover?error=not_found');
}
