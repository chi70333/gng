'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import type {
  ProductDetail,
  ProductOption,
  ProductSku,
} from '@/server/repositories/product.repository';

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

type OptionChoice = {
  value: string;
  available: boolean;
};

function optionRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, string>>((result, [key, entry]) => {
    if (typeof entry === 'string' && entry.trim() !== '') {
      result[key] = entry;
    }
    return result;
  }, {});
}

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

function skuMatchesSelection(
  sku: ProductSku,
  selected: Record<string, string>,
  ignoredOptionName?: string,
): boolean {
  const optionValues = optionRecord(sku.optionValues);

  return Object.entries(selected).every(([name, value]) => {
    if (name === ignoredOptionName || value === '') return true;
    return optionValues[name] === value;
  });
}

function choicesForOption(
  option: ProductOption,
  skus: ProductSku[],
  selected: Record<string, string>,
): OptionChoice[] {
  const configuredValues = stringValues(option.values);
  const values =
    configuredValues.length > 0
      ? configuredValues
      : Array.from(
          new Set(
            skus
              .map((sku) => optionRecord(sku.optionValues)[option.name])
              .filter((value): value is string => Boolean(value)),
          ),
        );

  return values.map((value) => ({
    value,
    available: skus.some((sku) => {
      const optionValues = optionRecord(sku.optionValues);
      return (
        optionValues[option.name] === value &&
        skuMatchesSelection(sku, selected, option.name) &&
        sku.isActive &&
        sku.stock - sku.reserved > 0
      );
    }),
  }));
}

function findMatchingSku(
  skus: ProductSku[],
  options: ProductDetail['options'],
  selected: Record<string, string>,
): ProductSku | null {
  return (
    skus.find((sku) => {
      const optionValues = optionRecord(sku.optionValues);
      return options.every((option) => optionValues[option.name] === selected[option.name]);
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
  const [isPending, startTransition] = useTransition();
  const quantity = 1;

  const hasRequiredOptions = options.every((option) => Boolean(selected[option.name]));

  const selectedSku = useMemo(() => {
    if (options.length === 0) return skus[0] ?? null;
    if (!hasRequiredOptions) return null;
    return findMatchingSku(skus, options, selected);
  }, [hasRequiredOptions, options, selected, skus]);

  function updateSelectedOption(optionName: string, value: string): void {
    setSelected((current) => {
      const next = { ...current };
      if (value === '') {
        delete next[optionName];
      } else {
        next[optionName] = value;
      }
      return next;
    });
  }

  function showOptionRequiredToast(): void {
    showToast({
      variant: 'info',
      title: options.length > 0 ? '옵션을 선택해주세요.' : '구매 가능한 상품이 없습니다.',
    });
  }

  function submitCartItem(checkout = false): void {
    if (!selectedSku) {
      showOptionRequiredToast();
      return;
    }

    if (!selectedSku.isActive || selectedSku.stock - selectedSku.reserved < quantity) {
      showToast({
        variant: 'error',
        title: '선택한 옵션은 구매할 수 없습니다.',
        description: '다른 옵션을 선택해 주세요.',
      });
      return;
    }

    if (isPending) return;

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
          description: '상품은 1개 단위로만 구매할 수 있습니다.',
          action: {
            label: '장바구니 보기',
            onClick: () => router.push('/cart'),
          },
        });
      })();
    });
  }

  return (
    <div className="space-y-3 pt-2">
      {options.length > 0 && (
        <div className="space-y-2" aria-label="상품 옵션">
          {options.map((option) => {
            const choices = choicesForOption(option, skus, selected);

            return (
              <label key={option.id} className="relative block">
                <span className="sr-only">{option.name}</span>
                <select
                  value={selected[option.name] ?? ''}
                  onChange={(event) => updateSelectedOption(option.name, event.target.value)}
                  aria-label={`${option.name} 옵션 선택`}
                  className={cn(
                    'h-11 w-full appearance-none rounded-md border border-neutral-300 bg-white px-3 pr-10 text-sm text-neutral-900 outline-none transition-colors',
                    'focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10',
                    (selected[option.name] ?? '') === '' && 'text-neutral-500',
                  )}
                >
                  <option value="">{option.name}</option>
                  {choices.map(({ value, available }) => (
                    <option key={value} value={value} disabled={!available}>
                      {available ? value : `${value} (품절)`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
              </label>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => submitCartItem()}
          className={cn(
            'flex h-12 items-center justify-center rounded-md border border-neutral-300 bg-white text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-50',
            isPending && 'opacity-70',
          )}
        >
          장바구니
        </button>
        <button
          type="button"
          onClick={() => submitCartItem(true)}
          className={cn(
            'flex h-12 items-center justify-center rounded-md bg-black text-sm font-bold text-white transition-colors hover:bg-neutral-800',
            isPending && 'opacity-70',
          )}
        >
          구매하기
        </button>
      </div>
    </div>
  );
}
