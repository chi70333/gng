'use client';

import { useSearchParams } from 'next/navigation';

export default function RegistrationNotice() {
  const searchParams = useSearchParams();

  if (searchParams.get('registered') !== '1') return null;

  return (
    <p className="rounded-lg bg-green-50 px-3 py-3 text-sm font-medium text-green-700">
      회원가입이 완료되었습니다. 지앤지 쇼핑몰을 바로 이용하실 수 있습니다.
    </p>
  );
}
