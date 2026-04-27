'use client';

import { useState, useTransition } from 'react';

type ProductQnaFormProps = {
  productId: string;
};

type ProductQnaResponse = {
  ok: boolean;
  error?: { message?: string };
};

export default function ProductQnaForm({ productId }: ProductQnaFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(): void {
    startTransition(async () => {
      const res = await fetch('/api/product-qna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, title, content, isPrivate }),
      });
      const body = (await res.json()) as ProductQnaResponse;

      if (!body.ok) {
        setMessage(body.error?.message ?? '문의 등록에 실패했습니다.');
        return;
      }

      setTitle('');
      setContent('');
      setIsPrivate(false);
      setMessage('문의가 등록되었습니다.');
    });
  }

  return (
    <div className="space-y-3 rounded-lg bg-neutral-50 p-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="제목"
        className="h-11 w-full rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-900"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="문의 내용을 입력하세요."
        rows={4}
        className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-3 text-sm outline-none focus:border-neutral-900"
      />
      <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(event) => setIsPrivate(event.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        비공개 문의
      </label>
      {message && <p className="text-sm text-neutral-500">{message}</p>}
      <button
        type="button"
        disabled={isPending}
        onClick={submit}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        문의 등록
      </button>
    </div>
  );
}
