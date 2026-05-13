import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Suspense } from 'react';
import './globals.css';
import RouteProgressBar from '@/components/layout/RouteProgressBar';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  title: {
    default: 'GNG',
    template: '%s | GNG',
  },
  description: 'GNG 쇼핑몰에서 최신 트렌드 상품을 만나보세요.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'GNG',
    locale: 'ko_KR',
  },
};

// 모바일 우선: 기본 viewport + 확대 허용, theme color. docs/06-mobile.md 참조.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900 antialiased">
        <ToastProvider>
          <Suspense fallback={null}>
            <RouteProgressBar />
          </Suspense>
          {children}
        </ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
