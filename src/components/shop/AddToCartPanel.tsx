'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronUp, CreditCard, ShoppingBag, TicketPercent, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import type { ProductDetail, ProductSku } from '@/server/repositories/product.repository';

type AddToCartPanelProps = {
  options: ProductDetail['options'];
  skus: ProductSku[];
};

type CartResponse = {
  ok: boolean;
  data?: {
    items: unknown[];
  };
  error?: { message?: string };
};

function valuesForOption(
  optionName: string,
  skus: ProductSku[],
): { value: string; available: boolean }[] {
  const values = new Map<string, boolean>();

  for (const sku of skus) {
    const optionValues = sku.optionValues as Record<string, string>;
    const value = optionValues[optionName];
    if (!value) continue;

    const available = sku.isActive && sku.stock - sku.reserved > 0;
    values.set(value, (values.get(value) ?? false) || available);
  }

  return Array.from(values.entries()).map(([value, available]) => ({ value, available }));
}

function findMatchingSku(skus: ProductSku[], selected: Record<string, string>): ProductSku | null {
  return (
    skus.find((sku) => {
      const optionValues = sku.optionValues as Record<string, string>;
      return Object.entries(selected).every(([key, value]) => optionValues[key] === value);
    }) ?? null
  );
}

function cartErrorMessage(message?: string): string {
  if (!message) return '장바구니에 상품을 담지 못했습니다.';
  if (/^\d+$/.test(message)) {
    return `재고가 부족합니다. 현재 구매 가능한 수량은 ${message}개입니다.`;
  }
  return message;
}

export default function AddToCartPanel({ options, skus }: AddToCartPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isSheetOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setIsSheetOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSheetOpen]);

  const selectedSku = useMemo(() => {
    if (options.length === 0) return skus[0] ?? null;
    if (Object.keys(selected).length !== options.length) return null;
    return findMatchingSku(skus, selected);
  }, [options, selected, skus]);

  const canAdd =
    !!selectedSku &&
    selectedSku.isActive &&
    selectedSku.stock - selectedSku.reserved >= quantity &&
    !isPending;

  function submitCartItem(checkout = false): void {
    if (!selectedSku) {
      showToast({
        variant: 'info',
        title: options.length > 0 ? '옵션을 선택해 주세요.' : '구매 가능한 상품이 없습니다.',
      });
      return;
    }

    startTransition(() => {
      void (async () => {
        let res: Response;
        let body: CartResponse;

        try {
          res = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({ skuId: selectedSku.id, quantity }),
          });
          body = (await res.json()) as CartResponse;
        } catch {
          showToast({
            variant: 'error',
            title: '장바구니 담기 실패',
            description: '잠시 후 다시 시도해 주세요.',
          });
          return;
        }

        if (!res.ok || !body.ok) {
          showToast({
            variant: 'error',
            title: '장바구니 담기 실패',
            description: cartErrorMessage(body.error?.message),
          });
          return;
        }

        if (checkout && (!body.data || body.data.items.length === 0)) {
          showToast({
            variant: 'error',
            title: '바로 구매 실패',
            description: '결제로 이동할 상품이 없습니다. 다시 시도해 주세요.',
          });
          return;
        }

        if (checkout) {
          window.location.assign('/order');
          return;
        }

        setIsSheetOpen(false);
        router.refresh();
        showToast({
          variant: 'success',
          title: '장바구니에 담았습니다.',
          description: '수량 변경과 주문은 장바구니에서 이어서 할 수 있습니다.',
          action: {
            label: '장바구니 보기',
            onClick: () => router.push('/cart'),
          },
        });
      })();
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
        >
          <ShoppingBag size={18} />
          장바구니
        </button>
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          <CreditCard size={18} />
          구매하기
        </button>
      </div>

      {isSheetOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-neutral-950/55 sm:items-center sm:justify-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-label="상품 옵션 선택"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="옵션 선택 닫기"
            onClick={() => setIsSheetOpen(false)}
          />
          <div className="relative max-h-[82dvh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-md sm:rounded-xl">
            <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white px-5 pb-3 pt-3">
              <div className="mx-auto h-1.5 w-14 rounded-full bg-neutral-200" aria-hidden="true" />
              <button
                type="button"
                aria-label="옵션 선택 닫기"
                onClick={() => setIsSheetOpen(false)}
                className="absolute right-3 top-2 flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="flex min-h-14 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">
                <TicketPercent size={18} className="shrink-0" />
                장바구니에서 1% 추가 할인 쿠폰을 확인해보세요!
              </div>

              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                {options.length > 0 ? (
                  options.map((option) => {
                    const values = valuesForOption(option.name, skus);
                    return (
                      <fieldset
                        key={option.id}
                        className="border-b border-neutral-100 last:border-b-0"
                      >
                        <legend className="sr-only">{option.name}</legend>
                        <div className="flex h-14 items-center justify-between border-b border-neutral-100 px-3">
                          <span className="text-base text-neutral-500">{option.name}</span>
                          <ChevronUp size={20} className="text-neutral-400" aria-hidden="true" />
                        </div>
                        <div className="divide-y divide-neutral-100">
                          {values.map(({ value, available }) => {
                            const active = selected[option.name] === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                disabled={!available}
                                onClick={() =>
                                  setSelected((current) => ({
                                    ...current,
                                    [option.name]: value,
                                  }))
                                }
                                className={cn(
                                  'flex min-h-[102px] w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors',
                                  active
                                    ? 'bg-neutral-950 text-white'
                                    : 'bg-white text-neutral-950',
                                  available && !active && 'hover:bg-neutral-50',
                                  !available &&
                                    'cursor-not-allowed bg-neutral-50 text-neutral-300 line-through',
                                )}
                              >
                                <span>
                                  <span className="block text-lg font-semibold">{value}</span>
                                  <span
                                    className={cn(
                                      'mt-2 flex flex-wrap items-center gap-2 text-sm',
                                      active ? 'text-neutral-200' : 'text-neutral-500',
                                    )}
                                  >
                                    주문 후 순차 발송 예정
                                    <span
                                      className={cn(
                                        'rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold',
                                        active ? 'bg-white/15 text-white' : 'text-neutral-600',
                                      )}
                                    >
                                      예약배송
                                    </span>
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })
                ) : (
                  <div className="px-4 py-5 text-sm text-neutral-700">
                    별도 옵션 없이 바로 구매할 수 있는 상품입니다.
                  </div>
                )}
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium text-neutral-700"
                  htmlFor="quantity"
                >
                  수량
                </label>
                <div className="flex h-11 w-32 items-center rounded-lg border border-neutral-300 bg-white">
                  <button
                    type="button"
                    aria-label="수량 줄이기"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="flex h-full w-10 items-center justify-center text-lg"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isInteger(next)) {
                        setQuantity(Math.min(99, Math.max(1, next)));
                      }
                    }}
                    className="h-full w-12 border-x border-neutral-200 text-center text-base outline-none"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    aria-label="수량 늘리기"
                    onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                    className="flex h-full w-10 items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-neutral-100 bg-white px-5 py-4">
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => submitCartItem()}
                className="flex h-14 items-center justify-center rounded-lg border border-neutral-300 bg-white text-base font-bold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
              >
                장바구니
              </button>
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => submitCartItem(true)}
                className="flex h-14 items-center justify-center rounded-lg bg-black text-base font-bold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                구매하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
