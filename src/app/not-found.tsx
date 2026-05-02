import Link from 'next/link';

export const metadata = {
  title: '페이지를 찾을 수 없습니다',
  description: '요청하신 페이지가 없거나 이동되었습니다.',
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-16">
      <section
        className="w-full max-w-md text-center"
        aria-labelledby="not-found-heading"
      >
        <p className="text-sm font-bold text-neutral-400">404</p>
        <h1
          id="not-found-heading"
          className="mt-3 text-2xl font-extrabold tracking-normal text-neutral-950"
        >
          페이지를 찾을 수 없습니다.
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          주소가 변경되었거나 상품 판매가 종료되었을 수 있습니다.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-950 px-5 text-sm font-bold text-white transition-colors hover:bg-neutral-700"
          >
            홈으로 이동
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-800 transition-colors hover:border-neutral-500"
          >
            상품 검색
          </Link>
        </div>
      </section>
    </main>
  );
}
