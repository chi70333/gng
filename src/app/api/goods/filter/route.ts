// 상품 필터 패싯 API — Edge cache 60s.
// 레거시: filter_list.php, filter_list_ajax.php, filter_search.php
// GET /api/goods/filter?category=<slug>
// 응답: { brands: [...], priceRange: { min, max } }

import { NextRequest, NextResponse } from 'next/server';
import { getCachedFilterFacets } from '@/server/services/product.service';
import { logger } from '@/lib/logger';

export const revalidate = 60; // Edge cache 60s

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  if (!category) {
    return NextResponse.json(
      { error: 'VALIDATION', message: 'category 파라미터가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    const facets = await getCachedFilterFacets(category);
    return NextResponse.json(facets, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    logger.error({ err, category }, 'GET /api/goods/filter failed');
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
