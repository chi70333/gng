// Legacy sources: member_join.php, member_join_ok.php
// Cache: no-cache. User registration writes directly to PostgreSQL with zod validation.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { JoinForm } from '@/components/shop/JoinForm';
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
        <p className="mt-1 text-sm text-neutral-500">아이디와 비밀번호로 가입합니다.</p>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {message}
        </p>
      )}

      <JoinForm action={registerAction} />
    </div>
  );
}
