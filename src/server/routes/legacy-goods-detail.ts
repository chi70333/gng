// Legacy source: goods_detail.php reads goodsIdx (= goods.idx) and shows product detail.
// Redirect policy: 301 to canonical /goods/[slug] because goodsIdx -> Product.legacyId is stable.
// Cache: legacyId lookup uses unstable_cache + Redis read-through for 60s.

import { NextRequest, NextResponse } from 'next/server';
import { legacyGoodsDetailQuerySchema } from '@/schemas/legacy-api';
import { logger } from '@/lib/logger';
import { getCachedProductRouteByLegacyId } from '@/server/services/product.service';

export async function redirectLegacyGoodsDetail(req: NextRequest) {
  const parsed = legacyGoodsDetailQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: '상품 번호가 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  try {
    const product = await getCachedProductRouteByLegacyId(parsed.data.goodsIdx);

    if (!product) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '상품을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const url = req.nextUrl.clone();
    url.pathname = `/goods/${product.slug}`;
    url.search = '';

    const response = NextResponse.redirect(url, 301);
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    return response;
  } catch (err) {
    logger.error(
      { err, goodsIdx: parsed.data.goodsIdx },
      'legacy goods_detail.php redirect failed',
    );
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
