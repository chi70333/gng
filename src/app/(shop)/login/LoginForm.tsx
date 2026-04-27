'use client';

import { loginAction } from './actions';

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  return (
    <form action={loginAction} className="space-y-4">
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
        className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
      >
        로그인
      </button>
    </form>
  );
}
