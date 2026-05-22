import { NextResponse, type NextRequest } from 'next/server';

// Edge middleware — 매 요청 통과. 가볍게 유지할 것. (docs/05-vercel.md)
// 현재는 보안 헤더/로케일 힌트만. 인증/rate-limit 확장 예정.

export const config = {
  matcher: [
    // 공개 쇼핑 페이지는 ISR/CDN 캐시를 타야 하므로 관리자 경로만 통과시킨다.
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};

export function middleware(_req: NextRequest) {
  const req = _req;
  if (req.nextUrl.pathname.startsWith('/admin') && req.nextUrl.pathname !== '/admin/login') {
    const hasSession =
      req.cookies.has('authjs.session-token') ||
      req.cookies.has('__Secure-authjs.session-token') ||
      req.cookies.has('next-auth.session-token') ||
      req.cookies.has('__Secure-next-auth.session-token');

    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();
  res.headers.set('X-Request-Id', crypto.randomUUID());
  return res;
}
