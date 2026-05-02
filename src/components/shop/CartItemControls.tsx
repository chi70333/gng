'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type CartItemControlsProps = {
  skuId: string;
};

async function deleteCartItem(skuId: string): Promise<boolean> {
  const res = await fetch('/api/cart', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skuId, quantity: 0 }),
  });
  return res.ok;
}

export default function CartItemControls({ skuId }: CartItemControlsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(): void {
    startTransition(async () => {
      const ok = await deleteCartItem(skuId);
      if (ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage('상품을 삭제하지 못했습니다. 다시 시도해 주세요.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="min-h-11 px-2 text-sm text-neutral-500 underline disabled:text-neutral-300"
      >
        삭제
      </button>
      {message && <p className="basis-full text-xs text-red-600">{message}</p>}
    </div>
  );
}
