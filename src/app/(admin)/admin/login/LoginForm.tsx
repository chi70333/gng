'use client';

import { ShieldCheck } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';
import { adminLoginAction, type AdminLoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-extrabold text-white disabled:opacity-60"
    >
      {pending ? '확인 중' : '관리자 로그인'}
    </button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const initialState: AdminLoginState = {};
  const [state, formAction] = useFormState(adminLoginAction, initialState);
  const errorMessage = state?.error;

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block">
        <span className="text-sm font-bold text-neutral-800">관리자 ID 또는 이메일</span>
        <input
          name="loginId"
          autoComplete="username"
          className="mt-2 min-h-12 w-full rounded-md border border-neutral-200 px-3 text-base outline-none focus:border-neutral-900"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-bold text-neutral-800">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-md border border-neutral-200 px-3 text-base outline-none focus:border-neutral-900"
          required
        />
      </label>
      {errorMessage ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {errorMessage}
        </p>
      ) : null}
      <SubmitButton />
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
        <ShieldCheck size={16} />
        관리자 접근과 변경 이력은 감사 로그에 기록됩니다.
      </div>
    </form>
  );
}
