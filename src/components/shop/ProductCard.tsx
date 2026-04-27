// 상품 카드 — Server Component.
// 모바일 우선: 360px 기준 2열 그리드. 이미지 next/image 필수.
// docs/06-mobile.md: LCP < 2.5s, 이미지 AVIF/WebP, sizes 필수.

import Image from 'next/image';
import Link from 'next/link';
import { formatKRW } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/server/repositories/product.repository';

interface ProductCardProps {
  product: ProductSummary;
  /** 이미지 eager loading (LCP 후보일 때 true). */
  priority?: boolean;
  canShowPrice?: boolean;
}

function calcDiscountPct(price: string, salePrice: string): number {
  const p = parseFloat(price);
  const s = parseFloat(salePrice);
  if (p <= 0) return 0;
  return Math.round((1 - s / p) * 100);
}

export default function ProductCard({
  product,
  priority = false,
  canShowPrice = false,
}: ProductCardProps) {
  const hasDiscount = !!product.salePrice;
  const displayPrice = product.salePrice ?? product.price;
  const discountPct = canShowPrice && hasDiscount
    ? calcDiscountPct(product.price, product.salePrice!)
    : 0;

  return (
    <Link
      href={`/goods/${product.slug}`}
      className="group flex flex-col bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* 상품 이미지 */}
      <div className="relative aspect-square w-full bg-neutral-100 overflow-hidden">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10"
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
        {discountPct > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            {discountPct}%
          </span>
        )}
      </div>

      {/* 상품 정보 */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        {product.brand && (
          <span className="text-xs text-neutral-400 truncate">{product.brand.name}</span>
        )}
        <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 leading-snug">
          {product.name}
        </h3>

        {/* 가격 */}
        {canShowPrice ? (
        <div className="mt-auto pt-1">
          {hasDiscount && (
            <span className="block text-xs text-neutral-400 line-through">
              {formatKRW(product.price)}
            </span>
          )}
          <span
            className={cn(
              'text-sm font-bold',
              hasDiscount ? 'text-red-500' : 'text-neutral-900',
            )}
          >
            {formatKRW(displayPrice)}
          </span>
        </div>
        ) : (
          <p className="mt-auto pt-1 text-sm font-semibold text-neutral-500">
            회원 전용 가격
          </p>
        )}
      </div>
    </Link>
  );
}
