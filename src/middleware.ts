import { NextResponse, type NextRequest } from 'next/server';

// Edge middleware — 매 요청 통과. 가볍게 유지할 것. (docs/05-vercel.md)
// 현재는 보안 헤더/로케일 힌트만. 인증/rate-limit 확장 예정.

export const config = {
  matcher: [
    // 정적 자산, 이미지, next 내부 경로 제외
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
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
