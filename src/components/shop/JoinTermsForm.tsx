'use client';

import { useState } from 'react';
import { acceptJoinTermsAction, startKakaoJoinAction } from '@/app/(shop)/join/terms/actions';

type JoinTermsFormProps = {
  terms: string;
  privacy: string;
  collectionConsent: string;
  error?: string;
  social?: 'kakao' | 'naver';
  pendingSocialProvider?: 'kakao' | 'naver';
};

export default function JoinTermsForm({
  terms,
  privacy,
  collectionConsent,
  error,
  social,
  pendingSocialProvider,
}: JoinTermsFormProps) {
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const consentItems = collectionConsent.includes('|')
    ? collectionConsent.split('|')
    : ['제품구매 본인여부 확인', '이름,이메일,전화번호,주소', '법령에 정한 기간'];
  const errorMessage =
    error === 'required'
      ? '필수 약관에 모두 동의해야 회원가입이 가능합니다.'
      : error === 'oauth_config'
        ? '카카오톡 가입 설정이 아직 완료되지 않았습니다.'
        : error === 'oauth'
          ? '카카오톡 계정 확인에 실패했습니다. 다시 시도해 주세요.'
          : error === 'unknown'
            ? '간편 가입을 시작하지 못했습니다. 다시 시도해 주세요.'
            : null;
  const isKakaoPending = social === 'kakao' && pendingSocialProvider === 'kakao';

  function checkAll(): void {
    setTermsChecked(true);
    setPrivacyChecked(true);
  }

  return (
    <div className="space-y-6">
      {isKakaoPending ? (
        <p className="rounded-lg bg-yellow-50 px-3 py-3 text-sm font-medium text-neutral-800">
          카카오톡 계정 확인이 완료되었습니다. 필수 약관에 동의한 뒤 다음을 누르면 회원가입이
          완료됩니다.
        </p>
      ) : (
        <form action={startKakaoJoinAction}>
          <input type="hidden" name="callbackUrl" value="/" />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            aria-label="카카오톡으로 가입"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-xs font-black">
              K
            </span>
            카카오톡으로 가입
          </button>
        </form>
      )}

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
      )}

      <form action={acceptJoinTermsAction} className="space-y-6">
        {social ? <input type="hidden" name="social" value={social} /> : null}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-neutral-900">
              이용약관 동의 <span className="text-blue-600">(필수)</span>
            </h2>
            <button
              type="button"
              onClick={checkAll}
              className="h-10 shrink-0 rounded-lg border border-blue-600 px-3 text-sm font-semibold text-blue-600"
            >
              전체동의
            </button>
          </div>
          <textarea
            readOnly
            value={terms}
            className="h-40 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-700"
          />
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="terms"
              value="y"
              checked={termsChecked}
              onChange={(event) => setTermsChecked(event.target.checked)}
              className="h-4 w-4"
            />
            위의 이용약관에 동의합니다.
          </label>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-neutral-900">개인정보처리방침</h2>
          <textarea
            readOnly
            value={privacy}
            className="h-40 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-700"
          />
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-neutral-900">
            개인정보 수집·이용동의 <span className="text-blue-600">(필수)</span>
          </h2>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm text-neutral-700">
            <div className="grid grid-cols-3 bg-neutral-50 text-center font-semibold">
              <div className="border-r border-neutral-200 p-3">목적</div>
              <div className="border-r border-neutral-200 p-3">항목</div>
              <div className="p-3">보유기간</div>
            </div>
            <div className="grid grid-cols-3 text-center">
              {consentItems.map((item) => (
                <div
                  key={item}
                  className="border-r border-t border-neutral-200 p-3 last:border-r-0"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="privacy"
              value="y"
              checked={privacyChecked}
              onChange={(event) => setPrivacyChecked(event.target.checked)}
              className="h-4 w-4"
            />
            위의 개인정보 수집·이용동의에 동의합니다.
          </label>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="/"
            className="flex h-12 items-center justify-center rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700"
          >
            취소
          </a>
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white"
          >
            다음
          </button>
        </div>
      </form>
    </div>
  );
}
