// Legacy sources: member_join.php, member_join_ok.php
// Cache: no-cache. User registration writes directly to PostgreSQL with zod validation.

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { registerAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원가입',
  description: '지앤지 회원가입',
};

type JoinPageProps = {
  searchParams: {
    error?: string;
  };
};

export default function JoinPage({ searchParams }: JoinPageProps) {
  if (cookies().get('gng_join_terms')?.value !== 'y') {
    redirect('/join/terms');
  }

  const message =
    searchParams.error === 'conflict'
      ? '이미 가입된 아이디, 이메일 또는 휴대전화번호입니다.'
      : searchParams.error === 'validation'
        ? '필수 입력 항목을 확인해 주세요.'
        : null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">회원가입</h1>
        <p className="mt-1 text-sm text-neutral-500">
          기존 회원 기준과 동일하게 아이디로 가입합니다.
        </p>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {message}
        </p>
      )}

      <form action={registerAction} className="space-y-3">
        <input type="hidden" name="termsAccepted" value="y" />
        <input type="hidden" name="privacyAccepted" value="y" />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">아이디</span>
          <input
            name="loginId"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9]+"
            autoComplete="username"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
          <span className="mt-1 block text-xs text-neutral-500">
            3~20자의 영문과 숫자만 입력해 주세요.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">비밀번호</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
          <span className="mt-1 block text-xs text-neutral-500">
            8자 이상 입력해 주세요.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">이름</span>
          <input
            name="name"
            required
            autoComplete="name"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">휴대전화번호</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
        >
          가입하기
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
