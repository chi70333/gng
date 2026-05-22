import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '사이트 점검중입니다',
  description: '사이트 점검 안내',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-5 py-12 text-white">
      <section className="w-full max-w-lg text-center">
        <p className="text-sm font-bold text-neutral-400">GNG Shopping Mall</p>
        <h1 className="mt-5 text-3xl font-extrabold tracking-normal md:text-5xl">
          사이트 점검중입니다
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-neutral-300">
          안정적인 서비스 제공을 위해 잠시 사이트 접속을 제한하고 있습니다.
          점검이 끝나는 대로 다시 이용하실 수 있습니다.
        </p>
      </section>
    </main>
  );
}
