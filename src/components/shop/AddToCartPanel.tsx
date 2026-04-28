'use client';

import { useMemo, useState, useTransition } from 'react';
import { CreditCard, ShoppingBag } from 'lucide-react';
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

function findMatchingSku(
  skus: ProductSku[],
  selected: Record<string, string>,
): ProductSku | null {
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
  const [isPending, startTransition] = useTransition();

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
    <div className="space-y-4">
      {options.map((option) => {
        const values = valuesForOption(option.name, skus);
        return (
          <fieldset key={option.id}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">
              {option.name}
            </legend>
            <div className="flex flex-wrap gap-2">
              {values.map(({ value, available }) => {
                const active = selected[option.name] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!available}
                    onClick={() =>
                      setSelected((current) => ({ ...current, [option.name]: value }))
                    }
                    className={cn(
                      'flex h-10 min-w-11 items-center justify-center rounded-lg border px-3 text-sm transition-colors',
                      active
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-800',
                      !available &&
                        'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300 line-through',
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700" htmlFor="quantity">
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
              if (Number.isInteger(next)) setQuantity(Math.min(99, Math.max(1, next)));
            }}
            className="h-full w-12 border-x border-neutral-200 text-center text-sm outline-none"
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

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => submitCartItem()}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
        >
          <ShoppingBag size={18} />
          장바구니 담기
        </button>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => submitCartItem(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          <CreditCard size={18} />
          바로 구매하기
        </button>
      </div>
    </div>
  );
}
