// 상품 카드 — Server Component.
// 모바일 우선: 360px 기준 2열 그리드. 이미지 next/image 필수.
// docs/06-mobile.md: LCP < 2.5s, 이미지 AVIF/WebP, sizes 필수.

import Image from 'next/image';
import Link from 'next/link';
import MemberPrice, { MemberDiscountBadge } from './MemberPrice';
import type { ProductSummary } from '@/server/repositories/product.repository';

interface ProductCardProps {
  product: ProductSummary;
  /** 이미지 eager loading (LCP 후보일 때 true). */
  priority?: boolean;
}

export default function ProductCard({
  product,
  priority = false,
}: ProductCardProps) {
  const hasDiscount = !!product.salePrice;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg bg-white transition-shadow hover:shadow-md">
      {/* 상품 이미지 */}
      <Link
        href={`/goods/${product.slug}`}
        prefetch={false}
        aria-label={`${product.name} 상품 상세로 이동`}
        className="relative block aspect-square w-full overflow-hidden bg-neutral-100"
      >
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* 할인율 뱃지 */}
        {hasDiscount && (
          <MemberDiscountBadge
            price={product.price}
            salePrice={product.salePrice}
            className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white"
          />
        )}
      </Link>

      {/* 상품 정보 */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand && (
          <span className="block min-h-4 truncate text-xs leading-4 text-neutral-400">
            {product.brand.name}
          </span>
        )}
        <h3 className="min-h-10 text-sm font-medium leading-5 text-neutral-900">
          <Link
            href={`/goods/${product.slug}`}
            prefetch={false}
            className="line-clamp-2 min-h-11"
          >
            {product.name}
          </Link>
        </h3>

        {/* 가격 */}
        <MemberPrice price={product.price} salePrice={product.salePrice} />
      </div>
    </article>
  );
}
