'use client';

import { formatKRW } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useMemberSession } from '@/hooks/use-member-session';

type MemberPriceProps = {
  price: string;
  salePrice: string | null;
  variant?: 'card' | 'detail';
};

export function calcDiscountPct(price: string, salePrice: string): number {
  const p = parseFloat(price);
  const s = parseFloat(salePrice);
  if (p <= 0) return 0;
  return Math.round((1 - s / p) * 100);
}

export function MemberDiscountBadge({
  price,
  salePrice,
  className,
  suffix = '',
}: {
  price: string;
  salePrice: string | null;
  className?: string;
  suffix?: string;
}) {
  const { isMember } = useMemberSession();
  if (!isMember || !salePrice) return null;

  const discountPct = calcDiscountPct(price, salePrice);
  if (discountPct <= 0) return null;

  return <span className={className}>{discountPct}%{suffix}</span>;
}

export default function MemberPrice({
  price,
  salePrice,
  variant = 'card',
}: MemberPriceProps) {
  const { isMember } = useMemberSession();
  const displayPrice = salePrice ?? price;
  const hasDiscount = Boolean(salePrice);

  if (!isMember) {
    return (
      <p
        className={cn(
          'font-semibold text-neutral-500',
        variant === 'detail' ? 'text-sm' : 'mt-auto min-h-6 pt-1 text-sm leading-5',
        )}
      >
        회원 전용 가격
      </p>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-1">
        {hasDiscount && (
          <p className="text-sm text-neutral-400 line-through">
            {formatKRW(price)}
          </p>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-neutral-900">
            {formatKRW(displayPrice)}
          </span>
          <MemberDiscountBadge
            price={price}
            salePrice={salePrice}
            className="text-lg font-bold text-red-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto min-h-6 pt-1">
      {hasDiscount && (
        <span className="block text-xs text-neutral-400 line-through">
          {formatKRW(price)}
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
  );
}
