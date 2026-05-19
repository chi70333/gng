'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const formData = new FormData(event.currentTarget);
    const loginId = String(formData.get('loginId') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!loginId || !password) {
      window.location.assign('/login?error=validation');
      return;
    }

    setIsPending(true);

    const result = await signIn('credentials', {
      loginId,
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      window.location.assign('/login?error=credentials');
      return;
    }

    window.location.assign(result?.url ?? callbackUrl);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">아이디</span>
        <input
          name="loginId"
          required
          autoComplete="username"
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">비밀번호</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        {isPending ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
