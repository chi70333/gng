// Legacy source: suggest_search.php
// Cache: public s-maxage 30s. Suggestions are served from Meilisearch.

import { NextRequest, NextResponse } from 'next/server';
import { suggestQuerySchema } from '@/schemas/search';
import { suggestProducts } from '@/server/services/search.service';

export const revalidate = 30;

export async function GET(req: NextRequest) {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = suggestQuerySchema.safeParse(
    query,
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Invalid suggest query.',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const data = await suggestProducts(parsed.data);
  const legacyMode =
    req.nextUrl.searchParams.get('format') === 'legacy' ||
    req.nextUrl.searchParams.get('legacy') === '1';

  if (legacyMode) {
    const words = data.map((item) => item.label);
    return new NextResponse(JSON.stringify(words), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  }

  return NextResponse.json(
    { ok: true, data },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    },
  );
}
