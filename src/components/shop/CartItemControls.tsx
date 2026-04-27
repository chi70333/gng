'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type CartItemControlsProps = {
  skuId: string;
  quantity: number;
};

async function updateQuantity(skuId: string, quantity: number): Promise<boolean> {
  const res = await fetch('/api/cart', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skuId, quantity }),
  });
  return res.ok;
}

export default function CartItemControls({ skuId, quantity }: CartItemControlsProps) {
  const router = useRouter();
  const [value, setValue] = useState(quantity);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function commit(nextValue: number): void {
    const normalized = Math.min(99, Math.max(0, nextValue));
    setValue(normalized);
    startTransition(async () => {
      const ok = await updateQuantity(skuId, normalized);
      if (ok) {
        setMessage(null);
        router.refresh();
      } else {
        setValue(quantity);
        setMessage('재고 상태가 변경되었습니다. 다시 확인해 주세요.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-10 items-center rounded-lg border border-neutral-300 bg-white">
        <button
          type="button"
          disabled={isPending}
          aria-label="수량 줄이기"
          onClick={() => commit(value - 1)}
          className="flex h-full w-9 items-center justify-center text-lg disabled:text-neutral-300"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          disabled={isPending}
          aria-label="수량"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next)) setValue(Math.min(99, Math.max(1, next)));
          }}
          onBlur={() => commit(value)}
          className="h-full w-11 border-x border-neutral-200 text-center text-sm outline-none disabled:text-neutral-300"
          inputMode="numeric"
        />
        <button
          type="button"
          disabled={isPending}
          aria-label="수량 늘리기"
          onClick={() => commit(value + 1)}
          className="flex h-full w-9 items-center justify-center text-lg disabled:text-neutral-300"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => commit(0)}
        className="h-10 px-2 text-sm text-neutral-500 underline disabled:text-neutral-300"
      >
        삭제
      </button>
      {message && <p className="basis-full text-xs text-red-600">{message}</p>}
    </div>
  );
}
