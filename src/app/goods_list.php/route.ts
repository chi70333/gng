// Legacy sources: legacy/www/goods_list.php, legacy/www/_goods_list.php
// Legacy behavior: category.idx=Index로 카테고리를 찾고 part_index 트리 기준 목록을 렌더링.
// Compatibility: CategoryLegacyMap.legacyIndex -> Category.slug 매핑 후 /category/[slug]로 리다이렉트.
// Cache: route revalidate 120s + Redis 5m(category:legacy-index:N), destination category page ISR 10m.

import { NextRequest, NextResponse } from 'next/server';
import {
  legacyGoodsListQuerySchema,
  resolveLegacyGoodsListPage,
  resolveLegacyGoodsListSort,
} from '@/schemas/legacy-category-route';
import { getCachedCategoryByLegacyIndex } from '@/server/services/category.service';
import { logger } from '@/lib/logger';

export const revalidate = 120;

export async function GET(req: NextRequest) {
  const parsed = legacyGoodsListQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return new NextResponse('카테고리 번호가 올바르지 않습니다.', {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const legacyIndex = parsed.data.Index;
  const mapping = await getCachedCategoryByLegacyIndex(legacyIndex);

  if (!mapping) {
    logger.warn({ legacyIndex }, 'legacy category index mapping not found');
    return new NextResponse('카테고리를 찾을 수 없습니다.', {
      status: 404,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  }

  const page = resolveLegacyGoodsListPage(parsed.data);
  const sort = resolveLegacyGoodsListSort(parsed.data);
  const url = req.nextUrl.clone();
  url.pathname = `/category/${mapping.slug}/`;
  url.search = '';

  if (page > 1) url.searchParams.set('page', String(page));
  if (sort !== 'new') url.searchParams.set('sort', sort);

  return NextResponse.redirect(url, {
    status: 308,
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  });
}
