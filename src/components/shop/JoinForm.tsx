'use client';

import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

type RegisterAction = (formData: FormData) => void | Promise<void>;

type JoinFormProps = {
  action: RegisterAction;
};

type FieldName = 'loginId' | 'password' | 'phone';
type AddressTarget = 'member' | 'business';

const loginIdMessage = '3~20자의 영문과 숫자만 입력해 주세요.';
const passwordMessage = '8자 이상 입력해 주세요.';
const phoneMessage = '010-1234-5678 형식으로 입력해 주세요.';
const postcodeScriptId = 'daum-postcode-script';
const postcodeScriptSrc = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  bname: string;
  buildingName: string;
  apartment: 'Y' | 'N';
  userSelectedType: 'R' | 'J';
};

type DaumPostcode = {
  open: () => void;
  embed: (element: HTMLElement) => void;
};

type DaumPostcodeConstructor = new (options: {
  oncomplete: (data: DaumPostcodeData) => void;
  onresize?: (size: { height: number }) => void;
  width?: string;
  height?: string;
}) => DaumPostcode;

declare global {
  interface Window {
    kakao?: {
      Postcode: DaumPostcodeConstructor;
    };
    daum?: {
      Postcode: DaumPostcodeConstructor;
    };
  }
}

function formatPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function buildRoadAddress(data: DaumPostcodeData): string {
  if (data.userSelectedType !== 'R') return data.jibunAddress;

  const extras = [data.bname, data.buildingName && data.apartment === 'Y' ? data.buildingName : '']
    .filter(Boolean)
    .join(', ');

  return extras ? `${data.roadAddress} (${extras})` : data.roadAddress;
}

function loadPostcodeScript(): Promise<void> {
  if (window.kakao?.Postcode || window.daum?.Postcode) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(postcodeScriptId) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');

    script.id = postcodeScriptId;
    script.src = postcodeScriptSrc;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('POSTCODE_SCRIPT_LOAD_FAILED'));

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
    >
      {pending ? '가입 처리 중' : '가입하기'}
    </button>
  );
}

function RequiredLabel({ children }: { children: string }) {
  return (
    <span className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-700">
      <span>{children}</span>
      <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
        필수입력
      </span>
    </span>
  );
}

export function JoinForm({ action }: JoinFormProps) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isBusinessMember, setIsBusinessMember] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [businessZipCode, setBusinessZipCode] = useState('');
  const [businessAddress1, setBusinessAddress1] = useState('');
  const [businessAddress2, setBusinessAddress2] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [postcodeTarget, setPostcodeTarget] = useState<AddressTarget | null>(null);
  const [postcodeLayerHeight, setPostcodeLayerHeight] = useState(480);
  const detailAddressRef = useRef<HTMLInputElement>(null);
  const businessDetailAddressRef = useRef<HTMLInputElement>(null);
  const postcodeLayerRef = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    loginId: false,
    password: false,
    phone: false,
  });

  const validation = useMemo(() => {
    const phoneDigits = phone.replace(/[^0-9]/g, '');

    return {
      loginId: /^[A-Za-z0-9]{3,20}$/.test(loginId),
      password: password.length >= 8,
      phone: /^01[016789]\d{7,8}$/.test(phoneDigits),
    };
  }, [loginId, password, phone]);

  const isInvalid = (name: FieldName) => touched[name] && !validation[name];
  const isValid = (name: FieldName) => touched[name] && validation[name];
  const setFieldTouched = (name: FieldName) =>
    setTouched((current) => ({ ...current, [name]: true }));

  useEffect(() => {
    if (!postcodeTarget) return;

    let ignore = false;

    const embedPostcode = async () => {
      setPostcodeError('');

      try {
        await loadPostcodeScript();
        if (ignore) return;

        const Postcode = window.kakao?.Postcode ?? window.daum?.Postcode;
        const layer = postcodeLayerRef.current;
        if (!Postcode || !layer) throw new Error('POSTCODE_API_UNAVAILABLE');

        layer.replaceChildren();

        new Postcode({
          width: '100%',
          height: '100%',
          onresize: (size) => setPostcodeLayerHeight(Math.max(size.height, 420)),
          oncomplete: (data) => {
            if (postcodeTarget === 'business') {
              setBusinessZipCode(data.zonecode);
              setBusinessAddress1(buildRoadAddress(data));
              setPostcodeTarget(null);
              window.setTimeout(() => businessDetailAddressRef.current?.focus(), 0);
              return;
            }

            setZipCode(data.zonecode);
            setAddress1(buildRoadAddress(data));
            setPostcodeTarget(null);
            window.setTimeout(() => detailAddressRef.current?.focus(), 0);
          },
        }).embed(layer);
      } catch {
        setPostcodeTarget(null);
        setPostcodeError('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    };

    void embedPostcode();

    return () => {
      ignore = true;
    };
  }, [postcodeTarget]);

  const openPostcode = (target: AddressTarget) => {
    setPostcodeError('');
    setPostcodeLayerHeight(480);
    setPostcodeTarget(target);
  };

  return (
    <>
      <form action={action} className="space-y-3">
        <input type="hidden" name="termsAccepted" value="y" />
        <input type="hidden" name="privacyAccepted" value="y" />

        <label className="block">
          <RequiredLabel>아이디</RequiredLabel>
          <input
            name="loginId"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9]+"
            value={loginId}
            onBlur={() => setFieldTouched('loginId')}
            onChange={(event) => {
              setLoginId(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 20));
              setFieldTouched('loginId');
            }}
            aria-invalid={isInvalid('loginId')}
            aria-describedby="join-login-id-message"
            autoComplete="username"
            inputMode="text"
            className={`h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 ${
              isInvalid('loginId')
                ? 'border-red-400 focus:ring-red-100'
                : 'border-neutral-300 focus:ring-neutral-300'
            }`}
          />
          <span
            id="join-login-id-message"
            className={`mt-1 block text-xs ${
              isInvalid('loginId')
                ? 'text-red-600'
                : isValid('loginId')
                  ? 'text-emerald-600'
                  : 'text-neutral-500'
            }`}
          >
            {isValid('loginId') ? '사용할 수 있는 아이디 형식입니다.' : loginIdMessage}
          </span>
        </label>

        <label className="block">
          <RequiredLabel>비밀번호</RequiredLabel>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            value={password}
            onBlur={() => setFieldTouched('password')}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldTouched('password');
            }}
            aria-invalid={isInvalid('password')}
            aria-describedby="join-password-message"
            autoComplete="new-password"
            className={`h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 ${
              isInvalid('password')
                ? 'border-red-400 focus:ring-red-100'
                : 'border-neutral-300 focus:ring-neutral-300'
            }`}
          />
          <span
            id="join-password-message"
            className={`mt-1 block text-xs ${
              isInvalid('password')
                ? 'text-red-600'
                : isValid('password')
                  ? 'text-emerald-600'
                  : 'text-neutral-500'
            }`}
          >
            {isValid('password') ? '8자 이상 입력되었습니다.' : passwordMessage}
          </span>
        </label>

        <label className="block">
          <RequiredLabel>이름</RequiredLabel>
          <input
            name="name"
            required
            autoComplete="name"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>

        <label className="block">
          <RequiredLabel>이메일</RequiredLabel>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>

        <label className="block">
          <RequiredLabel>휴대전화번호</RequiredLabel>
          <input
            name="phone"
            type="tel"
            required
            value={phone}
            onBlur={() => setFieldTouched('phone')}
            onChange={(event) => {
              setPhone(formatPhone(event.target.value));
              setFieldTouched('phone');
            }}
            placeholder="010-1234-5678"
            maxLength={13}
            aria-invalid={isInvalid('phone')}
            aria-describedby="join-phone-message"
            autoComplete="tel"
            inputMode="numeric"
            className={`h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 ${
              isInvalid('phone')
                ? 'border-red-400 focus:ring-red-100'
                : 'border-neutral-300 focus:ring-neutral-300'
            }`}
          />
          <span
            id="join-phone-message"
            className={`mt-1 block text-xs ${
              isInvalid('phone')
                ? 'text-red-600'
                : isValid('phone')
                  ? 'text-emerald-600'
                  : 'text-neutral-500'
            }`}
          >
            {isValid('phone') ? '휴대전화번호 형식이 맞습니다.' : phoneMessage}
          </span>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-neutral-700">주소</legend>

          <div className="flex gap-2">
            <input
              name="zipCode"
              value={zipCode}
              onChange={(event) => setZipCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              placeholder="우편번호"
              autoComplete="postal-code"
              inputMode="numeric"
              className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
            />
            <button
              type="button"
              onClick={() => openPostcode('member')}
              className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-900 bg-white px-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
              aria-label="주소 검색"
            >
              <Search aria-hidden="true" size={16} />
              <span>검색</span>
            </button>
          </div>

          <input
            name="address1"
            value={address1}
            onChange={(event) => setAddress1(event.target.value.slice(0, 200))}
            placeholder="기본주소"
            autoComplete="street-address"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />

          <input
            ref={detailAddressRef}
            name="address2"
            value={address2}
            onChange={(event) => setAddress2(event.target.value.slice(0, 200))}
            placeholder="상세주소"
            autoComplete="address-line2"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
          />

          {postcodeError && (
            <p className="text-xs text-red-600" role="alert">
              {postcodeError}
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-2 rounded-xl border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium text-neutral-700">회원 유형</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm">
              <input
                type="radio"
                name="memberType"
                value="M"
                checked={!isBusinessMember}
                onChange={() => setIsBusinessMember(false)}
              />
              개인회원
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm">
              <input
                type="radio"
                name="memberType"
                value="D"
                checked={isBusinessMember}
                onChange={() => setIsBusinessMember(true)}
              />
              사업자회원
            </label>
          </div>

          {isBusinessMember && (
            <div className="space-y-2 pt-2">
              <input
                name="companyName"
                required={isBusinessMember}
                placeholder="회사명(법인명)"
                autoComplete="organization"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
              />
              <input
                name="ceoName"
                required={isBusinessMember}
                placeholder="대표자명"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
              />
              <input
                name="businessNumber"
                required={isBusinessMember}
                placeholder="사업자등록번호"
                inputMode="numeric"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="businessType"
                  required={isBusinessMember}
                  placeholder="업태"
                  className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                />
                <input
                  name="businessItem"
                  required={isBusinessMember}
                  placeholder="종목"
                  className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                />
              </div>
              <div className="flex gap-2">
                <input
                  name="businessZipCode"
                  required={isBusinessMember}
                  readOnly
                  value={businessZipCode}
                  placeholder="사업장 우편번호"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                />
                <button
                  type="button"
                  onClick={() => openPostcode('business')}
                  className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-900 bg-white px-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
                  aria-label="사업장 주소 검색"
                >
                  <Search aria-hidden="true" size={16} />
                  <span>검색</span>
                </button>
              </div>
              <input
                name="businessAddress1"
                required={isBusinessMember}
                readOnly
                value={businessAddress1}
                placeholder="사업장 주소"
                autoComplete="street-address"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
              />
              <input
                ref={businessDetailAddressRef}
                name="businessAddress2"
                required={isBusinessMember}
                value={businessAddress2}
                onChange={(event) => setBusinessAddress2(event.target.value.slice(0, 200))}
                placeholder="사업장 상세주소"
                autoComplete="address-line2"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
              />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2 rounded-xl border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium text-neutral-700">혜택 안내 수신</legend>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-neutral-700">
            <span>이메일로 이벤트와 혜택 정보를 받겠습니다.</span>
            <input type="checkbox" name="marketingAccepted" value="y" className="h-5 w-5" />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-neutral-700">
            <span>문자로 이벤트와 혜택 정보를 받겠습니다.</span>
            <input type="checkbox" name="smsAccepted" value="y" className="h-5 w-5" />
          </label>
        </fieldset>

        <SubmitButton />
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          로그인
        </Link>
      </p>

      {postcodeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 px-0 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-label={postcodeTarget === 'business' ? '사업장 주소 검색' : '주소 검색'}
        >
          <div className="w-full overflow-hidden rounded-t-lg bg-white shadow-xl sm:mx-auto sm:max-w-md sm:rounded-lg">
            <div className="flex h-12 items-center justify-between border-b border-neutral-200 px-4">
              <h2 className="text-base font-semibold text-neutral-900">주소 검색</h2>
              <button
                type="button"
                onClick={() => setPostcodeTarget(null)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100"
                aria-label="주소 검색 닫기"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <div
              ref={postcodeLayerRef}
              className="w-full"
              style={{ height: Math.min(postcodeLayerHeight, 560) }}
            />
          </div>
        </div>
      )}
    </>
  );
}
