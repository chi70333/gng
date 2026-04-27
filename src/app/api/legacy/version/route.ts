import { NextResponse } from 'next/server';

// legacy/www/api/version.php summary:
// The original endpoint is `<?php phpinfo(); ?>`, and production was confirmed
// to expose phpinfo HTML as well. We intentionally do not preserve that output
// because it leaks server modules, paths, environment, and PHP configuration.
// Cache strategy: no-store. This is a security deprecation response.
// Rewrite: next.config.mjs maps /api/version.php -> /api/legacy/version.

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      result: 'GONE',
      code: 'PHPINFO_DISABLED',
      message: 'phpinfo endpoint was removed for security.',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
