// Cache: ISR 5m. Public RSS for recent products.

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCachedNewProducts } from '@/server/services/product.service';

export const revalidate = 300;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const products = await getCachedNewProducts(30).catch((err: unknown) => {
    logger.error({ err }, 'RSS: getCachedNewProducts failed');
    return [];
  });

  const items = products
    .map((product) => {
      const url = `${siteUrl}/goods/${product.slug}`;
      return `<item><title>${escapeXml(product.name)}</title><link>${escapeXml(
        url,
      )}</link><guid>${escapeXml(url)}</guid><description>${escapeXml(
        product.summary ?? product.name,
      )}</description></item>`;
    })
    .join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>GNG New Products</title><link>${escapeXml(
    siteUrl,
  )}</link><description>GNG new products</description>${items}</channel></rss>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
