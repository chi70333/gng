// 상품 옵션/SKU 조회 API — Edge cache 30s.
// 레거시: option_ajax.php, option_ajax2.php
// 사용: 상품 상세 페이지의 클라이언트 옵션 선택기 (P1)
// GET /api/goods/[id]/options
//   id = product slug
// 응답: { options: [...], skus: [...] }

import { NextRequest, NextResponse } from 'next/server';
import { getCachedProductSkus } from '@/server/services/product.service';
import { getCachedProductBySlug } from '@/server/services/product.service';
import { logger } from '@/lib/logger';

// Edge runtime: 가볍고 빠름, 전역 캐시 가능.
export const runtime = 'nodejs'; // argon2 없으므로 nodejs OK; edge는 P1 인증 추가 시 검토
export const revalidate = 30; // Edge cache 30s

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const product = await getCachedProductBySlug(params.id);

    if (!product) {
      return NextResponse.json({ error: 'NOT_FOUND', message: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const skus = await getCachedProductSkus(product.id);

    return NextResponse.json(
      {
        options: product.options,
        skus,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (err) {
    logger.error({ err, slug: params.id }, 'GET /api/goods/[id]/options failed');
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
