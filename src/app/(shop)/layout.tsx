import { Suspense } from 'react';
import Header, { HeaderShell } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderShell categories={[]} />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
