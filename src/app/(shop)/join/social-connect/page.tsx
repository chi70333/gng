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
import { SocialConnectPhoneField } from '@/components/shop/SocialConnectPhoneField';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '간편 회원가입',
  description: '카카오 또는 네이버 계정으로 지앤지 회원가입을 진행합니다.',
};

type SocialConnectPageProps = {
  searchParams: { error?: string };
};

function Field({
  label,
  name,
  autoComplete,
  defaultValue,
  inputMode,
  maxLength,
  placeholder,
  required = true,
  type = 'text',
}: {
  label: string;
  name: string;
  autoComplete: string;
  defaultValue?: string;
  inputMode?: 'email' | 'numeric' | 'tel' | 'text';
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-3 text-sm font-medium text-neutral-700">
        <span>{label}</span>
        {required ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            필수
          </span>
        ) : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none focus:ring-2 focus:ring-neutral-300"
      />
    </label>
  );
}

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
    <div className="mx-auto w-full max-w-md px-4 py-8">
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

        <Field
          label="이름"
          name="name"
          autoComplete="name"
          defaultValue={pendingSocial.name ?? ''}
        />
        <Field
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={pendingSocial.email}
        />
        <SocialConnectPhoneField
          label="휴대전화번호"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          maxLength={13}
          placeholder="010-1234-5678"
        />
        <Field
          label="우편번호"
          name="zipCode"
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={10}
          required={false}
        />
        <Field
          label="주소"
          name="address1"
          autoComplete="street-address"
          maxLength={200}
          required={false}
        />
        <Field
          label="상세주소"
          name="address2"
          autoComplete="address-line2"
          maxLength={200}
          required={false}
        />

        <fieldset className="space-y-2 rounded-lg border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium text-neutral-700">회원 유형</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm">
              <input type="radio" name="memberType" value="M" defaultChecked />
              개인회원
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm">
              <input type="radio" name="memberType" value="D" />
              사업자회원
            </label>
          </div>
          <p className="text-xs text-neutral-500">
            사업자회원은 아래 사업장 정보를 함께 입력해 주세요.
          </p>
          <Field label="회사명 또는 법인명" name="companyName" autoComplete="organization" required={false} />
          <Field label="대표자명" name="ceoName" autoComplete="name" required={false} />
          <Field
            label="사업자등록번호"
            name="businessNumber"
            autoComplete="off"
            inputMode="numeric"
            required={false}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="업태" name="businessType" autoComplete="off" required={false} />
            <Field label="종목" name="businessItem" autoComplete="off" required={false} />
          </div>
          <Field
            label="사업장 우편번호"
            name="businessZipCode"
            autoComplete="postal-code"
            inputMode="numeric"
            required={false}
          />
          <Field
            label="사업장 주소"
            name="businessAddress1"
            autoComplete="street-address"
            required={false}
          />
          <Field
            label="사업장 상세주소"
            name="businessAddress2"
            autoComplete="address-line2"
            required={false}
          />
        </fieldset>

        <fieldset className="space-y-2 rounded-lg border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium text-neutral-700">선택 안내 수신</legend>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-neutral-700">
            <span>이메일로 이벤트와 혜택 정보를 받겠습니다.</span>
            <input type="checkbox" name="marketingAccepted" value="y" className="h-5 w-5" />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-neutral-700">
            <span>문자로 이벤트와 혜택 정보를 받겠습니다.</span>
            <input type="checkbox" name="smsAccepted" value="y" className="h-5 w-5" />
          </label>
        </fieldset>

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
