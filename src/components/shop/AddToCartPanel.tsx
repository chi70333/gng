'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
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

type CartResponseItem = {
  skuId: string;
  quantity: number;
};

type OptionChoice = {
  value: string;
  available: boolean;
};

type PurchaseMode = 'selected';

type PurchasePrompt = {
  type: 'duplicate';
  skuId: string;
  existingQuantity: number;
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
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
  const configuredValues = uniqueStrings(stringValues(option.values));
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

function isCartResponseItem(value: unknown): value is CartResponseItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.skuId === 'string' && typeof item.quantity === 'number';
}

function cartItemsFromResponse(body: CartResponse): CartResponseItem[] {
  return body.data?.items.filter(isCartResponseItem) ?? [];
}

function cartOrderHref(skuId: string): string {
  return `/order?items=${encodeURIComponent(skuId)}`;
}

function directOrderHref(skuId: string): string {
  return `/order?directSkuId=${encodeURIComponent(skuId)}&quantity=1`;
}

export default function AddToCartPanel({ options, skus }: AddToCartPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [openOptionName, setOpenOptionName] = useState<string | null>(null);
  const [purchasePrompt, setPurchasePrompt] = useState<PurchasePrompt | null>(null);
  const [isPending, startTransition] = useTransition();
  const optionDropdownRef = useRef<HTMLDivElement>(null);
  const quantity = 1;

  const hasRequiredOptions = options.every((option) => Boolean(selected[option.name]));

  const selectedSku = useMemo(() => {
    if (options.length === 0) return skus[0] ?? null;
    if (!hasRequiredOptions) return null;
    return findMatchingSku(skus, options, selected);
  }, [hasRequiredOptions, options, selected, skus]);

  useEffect(() => {
    if (!openOptionName) return;

    function closeOnOutsideClick(event: MouseEvent): void {
      if (event.target instanceof Node && !optionDropdownRef.current?.contains(event.target)) {
        setOpenOptionName(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpenOptionName(null);
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openOptionName]);

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
    setOpenOptionName(null);
  }

  function showOptionRequiredToast(): void {
    showToast({
      variant: 'info',
      title: options.length > 0 ? '옵션을 선택해주세요.' : '구매 가능한 상품이 없습니다.',
    });
  }

  async function getCurrentCartItems(): Promise<CartResponseItem[] | null> {
    try {
      const res = await fetch('/api/cart', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = (await res.json()) as CartResponse;
      if (!res.ok || !body.ok) return null;
      return cartItemsFromResponse(body);
    } catch {
      return null;
    }
  }

  async function addCartItem(skuId: string, purchaseMode?: PurchaseMode): Promise<void> {
    let res: Response;
    let body: CartResponse;

    try {
      res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ skuId, quantity }),
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

    if (purchaseMode && cartItemsFromResponse(body).length === 0) {
      showToast({
        variant: 'error',
        title: '바로 구매 실패',
        description: '결제로 이동할 상품이 없습니다. 다시 시도해 주세요.',
      });
      return;
    }

    if (purchaseMode) {
      window.location.assign(cartOrderHref(skuId));
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

    const skuId = selectedSku.id;

    startTransition(() => {
      void (async () => {
        if (checkout) {
          const currentItems = await getCurrentCartItems();
          if (!currentItems) {
            showToast({
              variant: 'error',
              title: '장바구니 확인 실패',
              description: '잠시 후 다시 시도해 주세요.',
            });
            return;
          }

          const sameItem = currentItems.find((item) => item.skuId === skuId);
          if (sameItem && sameItem.quantity > 0) {
            setPurchasePrompt({
              type: 'duplicate',
              skuId,
              existingQuantity: sameItem.quantity,
            });
            return;
          }

          window.location.assign(directOrderHref(skuId));
          return;
        }

        await addCartItem(skuId, checkout ? 'selected' : undefined);
      })();
    });
  }

  function continuePurchase(mode: PurchaseMode): void {
    if (!purchasePrompt || isPending) return;

    const skuId = purchasePrompt.skuId;
    setPurchasePrompt(null);

    startTransition(() => {
      void addCartItem(skuId, mode);
    });
  }

  function purchaseSingleItem(): void {
    if (!purchasePrompt || isPending) return;

    const skuId = purchasePrompt.skuId;
    setPurchasePrompt(null);
    window.location.assign(directOrderHref(skuId));
  }

  return (
    <div className="space-y-3 pt-2">
      {options.length > 0 && (
        <div ref={optionDropdownRef} className="space-y-2" aria-label="상품 옵션">
          {options.map((option) => {
            const choices = choicesForOption(option, skus, selected);
            const selectedValue = selected[option.name] ?? '';
            const isOpen = openOptionName === option.name;
            const triggerId = `product-option-${option.id}-trigger`;
            const listboxId = `product-option-${option.id}-listbox`;

            return (
              <div key={option.id} className="relative">
                <button
                  id={triggerId}
                  type="button"
                  onClick={() => setOpenOptionName(isOpen ? null : option.name)}
                  aria-haspopup="listbox"
                  aria-expanded={isOpen}
                  aria-controls={listboxId}
                  aria-label={`${option.name} 옵션 선택`}
                  style={isOpen ? { borderColor: '#111111' } : undefined}
                  className={cn(
                    'flex h-11 w-full items-center justify-between rounded-sm border bg-white px-3 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900',
                    isOpen
                      ? 'border-neutral-900 text-neutral-950'
                      : 'border-neutral-300 text-neutral-600 hover:border-neutral-500',
                  )}
                >
                  <span className="min-w-0 truncate">{selectedValue || option.name}</span>
                  {isOpen ? (
                    <ChevronUp
                      className="ml-3 shrink-0 text-neutral-400"
                      size={18}
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="ml-3 shrink-0 text-neutral-400"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {isOpen && (
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-labelledby={triggerId}
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-sm border border-neutral-300 bg-white shadow-sm"
                  >
                    <div className="flex min-h-10 items-center px-3 text-sm text-neutral-300">
                      {option.name}
                    </div>
                    {choices.map(({ value, available }) => {
                      const isSelected = selectedValue === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateSelectedOption(option.name, isSelected ? '' : value)}
                          disabled={!available}
                          role="option"
                          aria-selected={isSelected}
                          aria-label={`${option.name} ${value} 옵션 ${available ? '선택' : '품절'}`}
                          className={cn(
                            'flex min-h-10 w-full items-center px-3 text-left text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900 disabled:cursor-not-allowed',
                            isSelected
                              ? 'bg-neutral-950 text-white'
                              : 'bg-white text-neutral-950 hover:bg-neutral-50 active:bg-neutral-100',
                            !available && 'bg-white text-neutral-300 line-through hover:bg-white',
                          )}
                        >
                          <span className="truncate">
                            {value}
                            {!available && ' 품절'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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

      {purchasePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 px-0 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-label="함께 구매 확인"
        >
          <div className="w-full rounded-t-lg bg-white p-4 shadow-xl sm:mx-auto sm:max-w-sm sm:rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-neutral-950">
                  동일 상품이 장바구니에 {purchasePrompt.existingQuantity}개 있습니다.
                </h2>
                <p className="mt-2 text-sm leading-5 text-neutral-600">함께 구매하시겠습니까?</p>
              </div>
              <button
                type="button"
                onClick={() => setPurchasePrompt(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-100"
                aria-label="함께 구매 확인 닫기"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => continuePurchase('selected')}
                disabled={isPending}
                className="flex min-h-12 items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                함께 구매하기
              </button>
              <button
                type="button"
                onClick={purchaseSingleItem}
                disabled={isPending}
                className="flex min-h-12 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-900 disabled:opacity-60"
              >
                아니오, 이 상품만 구매
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
