// Legacy source: order_ok.php
// Cache: no-cache. Completion is per-order/user state.

import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문 완료',
};

type CompletePageProps = {
  searchParams: {
    orderNo?: string;
  };
};

export default function OrderCompletePage({ searchParams }: CompletePageProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-neutral-900">주문이 접수되었습니다</h1>
      {searchParams.orderNo && (
        <p className="mt-3 text-sm text-neutral-500">
          주문번호: <span className="font-medium text-neutral-900">{searchParams.orderNo}</span>
        </p>
      )}
      <p className="mt-4 text-sm text-neutral-500">
        결제 연동은 다음 마이그레이션 단계에서 연결됩니다.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
      >
        쇼핑 계속하기
      </Link>
    </div>
  );
}
