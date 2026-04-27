// Legacy sources: idsearch.php, id_loss.php, id_loss_ok.php
// Cache: no-cache. Neutral response prevents account enumeration.

import type { Metadata } from 'next';
import Link from 'next/link';
import { recoverAccountAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '아이디 찾기',
  description: '지앤지 회원 아이디 찾기',
};

type RecoverPageProps = {
  searchParams: {
    sent?: string;
  };
};

export default function RecoverPage({ searchParams }: RecoverPageProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">아이디 찾기</h1>
        <p className="mt-1 text-sm text-neutral-500">
          가입 시 등록한 이메일을 입력하면 아이디 안내를 보내드립니다.
        </p>
      </div>

      {searchParams.sent === '1' && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          가입 정보가 확인되면 아이디 안내가 발송됩니다.
        </p>
      )}

      <form action={recoverAccountAction} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">가입 이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="아이디 찾기용 가입 이메일"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
        >
          아이디 안내 받기
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        아이디가 기억나셨나요?{' '}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
