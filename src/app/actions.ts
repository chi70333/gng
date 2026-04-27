'use server';

import { logoutSchema } from '@/schemas/auth';
import { signOut } from '@/server/auth';

export async function logoutAction(formData: FormData): Promise<void> {
  const parsed = logoutSchema.parse({
    callbackUrl: formData.get('callbackUrl'),
  });

  await signOut({ redirectTo: parsed.callbackUrl });
}
