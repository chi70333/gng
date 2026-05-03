// 상품 그리드 — Server Component.
// 모바일: 2열, 태블릿: 3열, 데스크톱: 4열. docs/06-mobile.md

import ProductCard from './ProductCard';
import type { ProductSummary } from '@/server/repositories/product.repository';

interface ProductGridProps {
  products: ProductSummary[];
  /** 첫 두 장 이미지를 eager load (LCP 최적화). */
  priorityCount?: number;
}

export default function ProductGrid({
  products,
  priorityCount = 2,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-400">
        <p className="text-sm">상품이 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            priority={i < priorityCount}
          />
        </li>
      ))}
    </ul>
  );
}
