'use server';

import { redirect } from 'next/navigation';
import { accountRecoverSchema } from '@/schemas/account';
import { requestAccountRecovery } from '@/server/services/account.service';

export async function recoverAccountAction(formData: FormData): Promise<void> {
  const parsed = accountRecoverSchema.safeParse({
  loginId: formData.get('loginId'),
  email: formData.get('email'),
  });


  if (parsed.success) {
    await requestAccountRecovery(parsed.data);
  }

  redirect('/account/recover?sent=1');
}
