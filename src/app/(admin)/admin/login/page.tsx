import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '관리자 로그인',
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const callbackUrl =
    searchParams.callbackUrl?.startsWith('/') && !searchParams.callbackUrl.startsWith('//')
      ? searchParams.callbackUrl
      : '/admin';

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-10">
      <section className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-neutral-500">GNG Shopping Mall</p>
        <h1 className="mt-2 text-2xl font-extrabold text-neutral-950">관리자 로그인</h1>
        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
