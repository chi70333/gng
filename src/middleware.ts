import { NextResponse, type NextRequest } from 'next/server';

// Keep admin/API access alive while public storefront traffic is in maintenance mode.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|robots.txt|sitemap.xml|rss.xml).*)',
  ],
};

export function middleware(_req: NextRequest) {
  const req = _req;
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const hasSession =
      req.cookies.has('authjs.session-token') ||
      req.cookies.has('__Secure-authjs.session-token') ||
      req.cookies.has('next-auth.session-token') ||
      req.cookies.has('__Secure-next-auth.session-token');

    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  const isMaintenancePage = pathname === '/maintenance';
  const isAdminPath = pathname.startsWith('/admin');
  const isApiPath = pathname.startsWith('/api/');

  if (!isMaintenancePage && !isAdminPath && !isApiPath) {
    const url = req.nextUrl.clone();
    url.pathname = '/maintenance';
    url.search = '';

    const res = NextResponse.rewrite(url);
    res.headers.set('X-Request-Id', crypto.randomUUID());
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  }

  const res = NextResponse.next();
  res.headers.set('X-Request-Id', crypto.randomUUID());
  return res;
}
