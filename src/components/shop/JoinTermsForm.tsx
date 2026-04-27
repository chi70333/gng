'use client';

import { useState } from 'react';
import { acceptJoinTermsAction } from '@/app/(shop)/join/terms/actions';

type JoinTermsFormProps = {
  terms: string;
  privacy: string;
  collectionConsent: string;
  error?: string;
  social?: 'kakao' | 'naver';
};

export default function JoinTermsForm({
  terms,
  privacy,
  collectionConsent,
  error,
  social,
}: JoinTermsFormProps) {
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const consentItems = collectionConsent.includes('|')
    ? collectionConsent.split('|')
    : ['제품구매 본인여부 확인', '이름,이메일,전화번호,주소', '법령에 정한 기간'];

  function checkAll(): void {
    setTermsChecked(true);
    setPrivacyChecked(true);
  }

  return (
    <form action={acceptJoinTermsAction} className="space-y-6">
      {social ? <input type="hidden" name="social" value={social} /> : null}

      {error === 'required' && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          필수 약관에 모두 동의해야 회원가입이 가능합니다.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-base font-bold text-neutral-900">
          이용약관 동의 <span className="text-blue-600">(필수)</span>
        </h2>
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
              <div key={item} className="border-t border-r border-neutral-200 p-3 last:border-r-0">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
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
          <button
            type="button"
            onClick={checkAll}
            className="h-11 rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-600"
          >
            모두동의
          </button>
        </div>
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
  );
}
