'use client';

import { useMemo, useState, useTransition } from 'react';
import { CreditCard, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { ProductDetail, ProductSku } from '@/server/repositories/product.repository';

type AddToCartPanelProps = {
  options: ProductDetail['options'];
  skus: ProductSku[];
};

type CartResponse = {
  ok: boolean;
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

export default function AddToCartPanel({ options, skus }: AddToCartPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
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

  function submitCartItem(nextPath?: '/order'): void {
    if (!selectedSku) {
      setMessage(options.length > 0 ? '옵션을 모두 선택해 주세요.' : '구매 가능한 상품이 없습니다.');
      return;
    }

    startTransition(async () => {
      setMessage(null);

      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ skuId: selectedSku.id, quantity }),
      });
      const body = (await res.json()) as CartResponse;

      if (!res.ok || !body.ok) {
        setMessage(body.error?.message ?? '장바구니에 상품을 담지 못했습니다.');
        return;
      }

      router.refresh();

      if (nextPath) {
        router.push(nextPath);
        return;
      }

      setMessage('장바구니에 담았습니다.');
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

      {message && <p className="text-sm text-neutral-500">{message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          onClick={() => submitCartItem('/order')}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          <CreditCard size={18} />
          바로 구매하기
        </button>
      </div>
    </div>
  );
}
