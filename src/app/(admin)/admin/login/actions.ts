'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { adminLoginSchema } from '@/schemas/admin-auth';
import { signIn } from '@/server/auth';

export type AdminLoginState = {
  error?: string;
};

export async function adminLoginAction(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const parsed = adminLoginSchema.safeParse({
    loginId: formData.get('loginId'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: '아이디와 비밀번호를 확인해 주세요.' };
  }

  const callbackUrl =
    typeof formData.get('callbackUrl') === 'string'
      ? String(formData.get('callbackUrl'))
      : '/admin';
  const safeCallback =
    callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/admin';

  try {
    await signIn('admin-credentials', {
      loginId: parsed.data.loginId,
      password: parsed.data.password,
      redirectTo: safeCallback,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: '관리자 계정 정보를 확인해 주세요.' };
    }
    throw err;
  }

  redirect(safeCallback);
}
