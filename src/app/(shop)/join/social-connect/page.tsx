// Legacy sources: social_join.php, social_join_ok.php
// Cache: no-cache. Social registration writes to PostgreSQL after required agreement consent.

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { socialRegisterAction } from './actions';
import {
  SOCIAL_PENDING_COOKIE,
  decodePendingSocialProfile,
} from '@/server/services/social-pending.service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '간편 회원가입',
  description: '카카오 또는 네이버 계정으로 지앤지 회원가입을 진행합니다.',
};

type SocialConnectPageProps = {
  searchParams: { error?: string };
};

export default function SocialConnectPage({ searchParams }: SocialConnectPageProps) {
  if (cookies().get('gng_join_terms')?.value !== 'y') {
    redirect('/join/terms');
  }

  const pendingSocial = decodePendingSocialProfile(cookies().get(SOCIAL_PENDING_COOKIE)?.value);
  if (!pendingSocial) {
    redirect('/login?error=social_expired');
  }

  const providerLabel = pendingSocial.provider === 'kakao' ? '카카오' : '네이버';
  const message =
    searchParams.error === 'conflict'
      ? '이미 가입된 이메일, 휴대전화번호 또는 간편 계정입니다.'
      : searchParams.error === 'validation'
        ? '필수 입력 항목을 확인해 주세요.'
        : null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">간편 회원가입</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {providerLabel} 계정으로 가입 정보를 확인해 주세요.
        </p>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {message}
        </p>
      )}

      <form action={socialRegisterAction} className="space-y-3">
        <input type="hidden" name="termsAccepted" value="y" />
        <input type="hidden" name="privacyAccepted" value="y" />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">이름</span>
          <input
            name="name"
            required
            defaultValue={pendingSocial.name ?? ''}
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
            defaultValue={pendingSocial.email}
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
          가입 완료
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        다른 방법으로 진행하시겠어요?{' '}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
