// Legacy sources: search_post.php
// Cache: public s-maxage 30s. Meilisearch fetch also uses next revalidate 30s.

import { NextRequest, NextResponse } from 'next/server';
import { searchQuerySchema } from '@/schemas/search';
import { searchProducts } from '@/server/services/search.service';

export const revalidate = 30;

export async function GET(req: NextRequest) {
  const parsed = searchQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Invalid search query.',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const data = await searchProducts(parsed.data);
  return NextResponse.json(
    { ok: true, data },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    },
  );
}
