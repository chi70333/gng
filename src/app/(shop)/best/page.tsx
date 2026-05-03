// Legacy source: product_best.php
// Cache: ISR 5m. Product service wraps DB access with unstable_cache.

import type { Metadata } from 'next';
import ProductGrid from '@/components/shop/ProductGrid';
import { logger } from '@/lib/logger';
import { getCachedBestProducts } from '@/server/services/product.service';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '베스트',
  description: 'GNG 인기 상품입니다.',
};

export default async function BestPage() {
  const products = await getCachedBestProducts(40).catch((err: unknown) => {
    logger.error({ err }, 'BestPage: getCachedBestProducts failed');
    return [];
  });

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold">베스트</h1>
      <p className="mb-6 text-sm text-neutral-500">
        지금 가장 많이 찾는 상품입니다.
      </p>
      <ProductGrid products={products} priorityCount={4} />
    </div>
  );
}
