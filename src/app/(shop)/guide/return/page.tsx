// Legacy source: guide_return.php
// Cache: ISR 1h. Static return guide page.

import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Return Guide',
};

export default function ReturnGuidePage() {
  return (
    <div className="mx-auto max-w-screen-md px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">교환/반품 안내</h1>
      <section className="mt-6 space-y-4 rounded-lg bg-white p-5 text-sm leading-7 text-neutral-700">
        <p>
          상품 수령 후 7일 이내에 교환 또는 반품을 신청할 수 있습니다. 단,
          사용 흔적이 있거나 상품 가치가 훼손된 경우 제한될 수 있습니다.
        </p>
        <p>
          오배송 또는 상품 하자의 경우 배송비는 GNG가 부담하며, 단순 변심은
          고객 부담 배송비가 발생할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
