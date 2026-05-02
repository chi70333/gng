'use client';

import Link from 'next/link';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-16">
      <section className="w-full max-w-md text-center" aria-labelledby="error-heading">
        <p className="text-sm font-bold text-red-500">오류</p>
        <h1
          id="error-heading"
          className="mt-3 text-2xl font-extrabold tracking-normal text-neutral-950"
        >
          페이지를 불러오지 못했습니다.
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          잠시 후 다시 시도해 주세요.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-950 px-5 text-sm font-bold text-white transition-colors hover:bg-neutral-700"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-800 transition-colors hover:border-neutral-500"
          >
            홈으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
