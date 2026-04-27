// Legacy source: product_new.php
// Cache: ISR 5m. Product service wraps DB access with unstable_cache.

import type { Metadata } from 'next';
import ProductGrid from '@/components/shop/ProductGrid';
import { logger } from '@/lib/logger';
import { auth } from '@/server/auth';
import { canViewMemberPrice } from '@/server/auth-utils';
import { getCachedNewProducts } from '@/server/services/product.service';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '신상품',
  description: 'GNG 신상품입니다.',
};

export default async function NewPage() {
  const [session, products] = await Promise.all([
    auth(),
    getCachedNewProducts(40).catch((err: unknown) => {
      logger.error({ err }, 'NewPage: getCachedNewProducts failed');
      return [];
    }),
  ]);
  const canShowPrice = canViewMemberPrice(session);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold">신상품</h1>
      <p className="mb-6 text-sm text-neutral-500">
        새로 등록된 상품을 만나보세요.
      </p>
      <ProductGrid products={products} priorityCount={4} canShowPrice={canShowPrice} />
    </div>
  );
}
