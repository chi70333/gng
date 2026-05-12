import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCachedBoardList } from '@/server/services/board.service';
import { getCachedCategoryTree } from '@/server/services/category.service';
import {
  getCachedDashboardCategorySections,
  getCachedProductBySlug,
  getCachedProductMetadataBySlug,
} from '@/server/services/product.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

async function prewarmProduct(slug: string): Promise<boolean> {
  try {
    await getCachedProductMetadataBySlug(slug);
    await getCachedProductBySlug(slug);
    return true;
  } catch (err) {
    logger.warn({ err, slug }, 'prewarm product cache failed');
    return false;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return noStoreJson(
      {
        success: false,
        message: 'CRON_SECRET is not configured.',
      },
      500,
    );
  }

  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return noStoreJson(
      {
        success: false,
        message: 'Unauthorized cron request.',
      },
      401,
    );
  }

  const sections = await getCachedDashboardCategorySections(8);
  await getCachedCategoryTree();

  const slugs = [
    ...new Set(sections.flatMap((section) => section.products.map((product) => product.slug))),
  ].slice(0, 8);

  let warmedProducts = 0;
  for (const slug of slugs) {
    if (await prewarmProduct(slug)) warmedProducts += 1;
  }

  await Promise.allSettled([
    getCachedBoardList('notice', 30),
    getCachedBoardList('faq', 50),
  ]);

  return noStoreJson({
    success: true,
    sections: sections.length,
    products: warmedProducts,
    requestedProducts: slugs.length,
  });
}
