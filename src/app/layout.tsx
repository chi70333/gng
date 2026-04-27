import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Header, { HeaderShell } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import RouteProgressBar from '@/components/layout/RouteProgressBar';

export const metadata: Metadata = {
  title: {
    default: 'GNG',
    template: '%s | GNG',
  },
  description: 'GNG 쇼핑몰 — 최신 트렌드 패션을 만나보세요.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'GNG',
    locale: 'ko_KR',
  },
};

// 모바일 우선: 기본 viewport + 확대 허용, theme color.
// docs/06-mobile.md 참조.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased flex flex-col">
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <Suspense fallback={<HeaderShell categories={[]} isAuthenticated={false} />}>
          <Header />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
