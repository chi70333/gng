'use client';

import Link from 'next/link';
import AddToCartPanel from '@/components/shop/AddToCartPanel';
import MemberPrice from '@/components/shop/MemberPrice';
import { useMemberSession } from '@/hooks/use-member-session';
import type {
  ProductOption,
  ProductSku,
} from '@/server/repositories/product.repository';

type ProductMemberPurchasePanelProps = {
  price: string;
  salePrice: string | null;
  summary: string | null;
  options: ProductOption[];
  skus: ProductSku[];
};

export default function ProductMemberPurchasePanel({
  price,
  salePrice,
  summary,
  options,
  skus,
}: ProductMemberPurchasePanelProps) {
  const { isMember } = useMemberSession();

  return (
    <>
      <MemberPrice
        price={price}
        salePrice={salePrice}
        variant="detail"
      />

      {summary && (
        <p className="text-sm leading-relaxed text-neutral-600">
          {summary}
        </p>
      )}

      {isMember ? (
        <AddToCartPanel options={options} skus={skus} />
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">회원 전용 가격</p>
            <p className="mt-1 text-sm text-neutral-500">
              로그인 후 상품 가격과 구매 옵션을 확인할 수 있습니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              disabled
              className="flex h-12 cursor-not-allowed items-center justify-center rounded-xl border border-neutral-300 bg-neutral-50 text-sm font-semibold text-neutral-500"
            >
              장바구니
            </button>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              구매하기
            </Link>
          </div>
        </>
      )}
    </>
  );
}
