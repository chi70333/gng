// Legacy sources: login.php, login_ok.php, login_popup.php, social_login.php
// Cache: no-cache. Auth is handled by Auth.js credentials and OAuth providers.

import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './LoginForm';
import { socialLoginAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '로그인',
  description: '지앤지 회원 로그인',
};

const socialProviders = [
  {
    id: 'kakao',
    label: '카카오로 로그인',
    ariaLabel: '카카오로 로그인',
    mark: 'K',
    className: 'bg-[#FEE500] text-black hover:opacity-90',
    markClassName: 'bg-black/10',
  },
] as const;

type LoginPageProps = {
  searchParams: {
    callbackUrl?: string;
    error?: string;
    registered?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl =
    searchParams.callbackUrl?.startsWith('/') &&
    !searchParams.callbackUrl.startsWith('//')
      ? searchParams.callbackUrl
      : '/';
  const errorMessage =
    searchParams.error === 'credentials'
      ? '아이디 또는 비밀번호가 올바르지 않습니다.'
      : searchParams.error === 'validation'
        ? '아이디와 비밀번호를 올바르게 입력해 주세요.'
        : searchParams.error === 'oauth_email'
          ? '소셜 계정의 이메일 권한이 필요합니다.'
          : searchParams.error === 'oauth'
            ? '소셜 로그인에 실패했습니다. 다시 시도해 주세요.'
            : searchParams.error === 'oauth_config'
              ? '소셜 로그인이 아직 설정되지 않았습니다.'
              : searchParams.error === 'Configuration'
                ? '간편 로그인 설정을 확인하는 중입니다. 잠시 후 다시 시도해 주세요.'
                : searchParams.error === 'dev_kakao'
                  ? '개발용 카카오 로그인 계정을 찾을 수 없습니다.'
                  : searchParams.error === 'social_expired'
                    ? '간편 회원가입 시간이 만료되었습니다. 다시 로그인해 주세요.'
                    : searchParams.error === 'AccessDenied'
                      ? '간편 로그인 계정 확인이 필요합니다. 다시 시도해 주세요.'
                      : searchParams.error === 'unknown'
                        ? '로그인에 실패했습니다. 다시 시도해 주세요.'
                        : null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">로그인</h1>
        <p className="mt-1 text-sm text-neutral-500">
          주문, 장바구니, 적립금 확인을 위해 로그인해 주세요.
        </p>
      </div>

      {searchParams.registered === '1' && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          회원가입이 완료되었습니다. 로그인해 주세요.
        </p>
      )}

      {errorMessage && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium text-neutral-400">간편 로그인</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="space-y-2">
        {socialProviders.map((provider) => (
          <form key={provider.id} action={socialLoginAction}>
            <input type="hidden" name="provider" value={provider.id} />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <button
              type="submit"
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-opacity ${provider.className}`}
              aria-label={provider.ariaLabel}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${provider.markClassName}`}
              >
                {provider.mark}
              </span>
              {provider.label}
            </button>
          </form>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link
          href="/join"
          className="flex min-h-11 items-center font-medium text-neutral-900 underline"
        >
          회원가입
        </Link>
        <Link
          href="/account/recover"
          className="flex min-h-11 items-center text-neutral-500 underline"
        >
          아이디/비밀번호 찾기
        </Link>
      </div>
    </div>
  );
}
