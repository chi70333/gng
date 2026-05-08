// Legacy sources: idsearch.php, id_loss.php, id_loss_ok.php
// Cache: no-cache. Recovery response shows whether a matching active account was found.

import type { Metadata } from 'next';
import Link from 'next/link';
import { recoverAccountAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '비밀번호 재설정',
  description: '지앤지 회원 임시비밀번호 발급',
};

type RecoverPageProps = {
  searchParams: {
    sent?: string;
    error?: string;
  };
};

export default function RecoverPage({ searchParams }: RecoverPageProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">비밀번호 재설정</h1>
        <p className="mt-1 text-sm text-neutral-500">
          가입한 아이디와 이메일을 입력하면 임시비밀번호를 발급합니다.
        </p>
      </div>

      {searchParams.sent === '1' && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          임시비밀번호가 발급되었습니다. 비밀번호는 Q123456$$$ 입니다.
        </p>
      )}

      {searchParams.error === 'not_found' && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          아이디와 가입 이메일이 일치하는 활성 회원을 찾지 못했습니다.
        </p>
      )}

      <form action={recoverAccountAction} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">아이디</span>
          <input
            name="loginId"
            type="text"
            required
            autoComplete="username"
            aria-label="비밀번호 재설정용 아이디"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">가입 이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="비밀번호 재설정용 가입 이메일"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
        >
          임시비밀번호 발급
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        임시비밀번호를 발급받으셨나요?{' '}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
