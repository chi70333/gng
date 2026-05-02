'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { formatKRW } from '@/lib/format';
import CartItemControls from '@/components/shop/CartItemControls';
import type { CartItem } from '@/server/services/cart.service';

type CartSelectionPanelProps = {
  items: CartItem[];
};

function itemTotal(item: CartItem): number {
  return Number(item.unitPrice);
}

function shippingFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= 50000 ? 0 : 3000;
}

function orderHref(items: CartItem[]): string {
  return `/order?items=${encodeURIComponent(items.map((item) => item.skuId).join(','))}`;
}

async function deleteCartItem(skuId: string): Promise<boolean> {
  const res = await fetch('/api/cart', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skuId, quantity: 0 }),
  });
  return res.ok;
}

export default function CartSelectionPanel({ items }: CartSelectionPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectableSkuIds = useMemo(
    () => items.filter((item) => item.isAvailable).map((item) => item.skuId),
    [items],
  );
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(
    () => new Set(selectableSkuIds),
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedSkuIds.has(item.skuId) && item.isAvailable),
    [items, selectedSkuIds],
  );
  const orderableItems = useMemo(() => items.filter((item) => item.isAvailable), [items]);
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + itemTotal(item), 0);
  const selectedShippingFee = shippingFee(selectedSubtotal);
  const selectedTotal = selectedSubtotal + selectedShippingFee;
  const allSelectableSelected =
    selectableSkuIds.length > 0 && selectableSkuIds.every((skuId) => selectedSkuIds.has(skuId));
  const canOrderSelected = selectedItems.length > 0;
  const canOrderAll = orderableItems.length > 0;

  const toggleAll = () => {
    setSelectedSkuIds(allSelectableSelected ? new Set() : new Set(selectableSkuIds));
  };

  const toggleItem = (skuId: string) => {
    setSelectedSkuIds((current) => {
      const next = new Set(current);
      if (next.has(skuId)) {
        next.delete(skuId);
      } else {
        next.add(skuId);
      }
      return next;
    });
  };

  const deleteSelectedItems = () => {
    const targetSkuIds = selectedItems.map((item) => item.skuId);
    if (targetSkuIds.length === 0) return;

    startTransition(async () => {
      const results = await Promise.all(targetSkuIds.map(deleteCartItem));
      if (results.every(Boolean)) {
        setSelectedSkuIds(new Set());
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-10 items-center justify-center gap-2 border border-neutral-900 bg-white px-3 text-sm font-bold text-neutral-900">
            <input
              type="checkbox"
              checked={allSelectableSelected}
              disabled={selectableSkuIds.length === 0 || isPending}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-neutral-300"
              aria-label="주문 가능한 상품 전체 선택"
            />
            <span>전체선택</span>
          </label>
          <button
            type="button"
            disabled={!canOrderSelected || isPending}
            onClick={deleteSelectedItems}
            className="min-h-10 border border-neutral-900 bg-white px-3 text-sm font-bold text-neutral-900 disabled:border-neutral-200 disabled:text-neutral-300"
          >
            삭제하기
          </button>
          <span className="ml-auto text-xs font-medium text-neutral-500">
            선택 {selectedItems.length}개
          </span>
        </div>

        <ul className="space-y-3">
          {items.map((item) => {
            const checked = selectedSkuIds.has(item.skuId) && item.isAvailable;

            return (
              <li key={item.skuId} className="flex gap-3 rounded-lg bg-white p-3">
                <label className="flex min-h-11 w-8 shrink-0 items-start justify-center pt-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!item.isAvailable}
                    onChange={() => toggleItem(item.skuId)}
                    className="h-5 w-5 rounded border-neutral-300 disabled:bg-neutral-100"
                    aria-label={`${item.name} 선택`}
                  />
                </label>
                <Link
                  href={`/goods/${item.slug}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100"
                >
                  {item.thumbnail && (
                    <Image
                      src={item.thumbnail}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/goods/${item.slug}`}
                    className="line-clamp-2 text-sm font-medium text-neutral-900"
                  >
                    {item.name}
                  </Link>
                  {item.optionSummary && (
                    <p className="mt-1 text-xs text-neutral-500">{item.optionSummary}</p>
                  )}
                  {item.stockMessage && (
                    <p className="mt-2 inline-flex rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
                      {item.stockMessage}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">
                      {formatKRW(item.unitPrice)}
                    </span>
                    <span className="text-xs text-neutral-500">1개 단위 구매</span>
                  </div>
                  <div className="mt-3">
                    <CartItemControls skuId={item.skuId} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="h-fit rounded-lg bg-white p-4">
        <div className="border-t-2 border-neutral-900 pt-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-900">총 상품금액</span>
            <span className="font-extrabold text-neutral-950">{formatKRW(selectedSubtotal)}</span>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="font-medium text-neutral-900">총 배송비</span>
            <span className="font-extrabold text-neutral-950">
              {formatKRW(selectedShippingFee)}
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="font-medium text-neutral-900">결제예정금액</span>
            <span className="font-extrabold text-neutral-950">{formatKRW(selectedTotal)}</span>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-1.5">
          {canOrderSelected ? (
            <Link
              href={orderHref(selectedItems)}
              className="flex min-h-12 items-center justify-center border border-neutral-900 bg-white px-2 text-center text-sm font-semibold text-neutral-900"
            >
              선택상품주문
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="flex min-h-12 items-center justify-center border border-neutral-200 bg-white px-2 text-sm font-semibold text-neutral-300"
            >
              선택상품주문
            </button>
          )}
          {canOrderAll ? (
            <Link
              href={orderHref(orderableItems)}
              className="flex min-h-12 items-center justify-center bg-neutral-950 px-2 text-center text-sm font-semibold text-white"
            >
              전체상품주문
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="flex min-h-12 items-center justify-center bg-neutral-200 px-2 text-sm font-semibold text-neutral-500"
            >
              전체상품주문
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
