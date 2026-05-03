// Legacy sources: goods_detail.php, _goods_detail2.php
// Cache: ISR 60s + product:<slug> service cache tag.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star, ChevronRight } from 'lucide-react';
import BreadcrumbNav from '@/components/shop/BreadcrumbNav';
import ProductQnaForm from '@/components/shop/ProductQnaForm';
import ProductImageGallery from '@/components/shop/ProductImageGallery';
import ProductMemberPurchasePanel from '@/components/shop/ProductMemberPurchasePanel';
import ProductViewTracker from '@/components/shop/ProductViewTracker';
import {
  getCachedProductBySlug,
  getCachedProductMetadataBySlug,
} from '@/server/services/product.service';
import { cn } from '@/lib/cn';

export const revalidate = 60; // ISR 60s
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const product = await getCachedProductMetadataBySlug(params.id);
  if (!product) return {};
  return {
    title: product.name,
    description: product.summary ?? product.name,
    openGraph: {
      title: product.name,
      description: product.summary ?? undefined,
      images: product.thumbnail ? [{ url: product.thumbnail }] : [],
      type: 'website',
    },
  };
}

function calcDiscountPct(price: string, salePrice: string): number {
  const p = parseFloat(price);
  const s = parseFloat(salePrice);
  return p > 0 ? Math.round((1 - s / p) * 100) : 0;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((score) => (
          <Star
            key={score}
            size={14}
            className={cn(
              score <= Math.round(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-neutral-200',
            )}
          />
        ))}
      </div>
      <span className="text-sm text-neutral-500">
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
}

export default async function GoodsDetailPage({ params }: { params: { id: string } }) {
  const product = await getCachedProductBySlug(params.id);
  if (!product) notFound();

  const breadcrumbs = [
    ...product.categories.slice(0, 1).map((category) => ({
      label: category.name,
      href: `/category/${category.slug}`,
    })),
    { label: product.name },
  ];

  const displayPrice = product.salePrice ?? product.price;
  const discountPct = product.salePrice
    ? calcDiscountPct(product.price, product.salePrice)
    : 0;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary ?? product.description ?? undefined,
    sku: product.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    offers: {
      '@type': 'Offer',
      price: displayPrice,
      priceCurrency: 'KRW',
      availability:
        product.skus.some((sku) => sku.stock - sku.reserved > 0) || product.skus.length === 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
    },
    aggregateRating:
      product.reviewCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.avgRating.toFixed(1),
            reviewCount: product.reviewCount,
          }
        : undefined,
    image: product.images.map((image) => image.url),
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ProductViewTracker slug={product.slug} />

      <BreadcrumbNav items={breadcrumbs} />

      <div className="mt-4 flex flex-col gap-8 md:flex-row">
        <ProductImageGallery
          key={product.id}
          productName={product.name}
          thumbnail={product.thumbnail}
          images={product.images}
          discountPct={discountPct}
        />

        <div className="min-w-0 flex-1 space-y-5">
          {product.brand && (
            <span className="text-sm font-medium text-neutral-500">
              {product.brand.name}
            </span>
          )}

          <h1 className="text-2xl font-bold leading-snug text-neutral-900">
            {product.name}
          </h1>

          {product.reviewCount > 0 && (
            <StarRating rating={product.avgRating} count={product.reviewCount} />
          )}

          <ProductMemberPurchasePanel
            price={product.price}
            salePrice={product.salePrice}
            summary={product.summary}
            options={product.options}
            skus={product.skus}
          />

          <ul className="space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
            <li>무료배송 (일부 상품 제외)</li>
            <li>오후 2시 이전 주문 시 당일 출고</li>
            <li>
              교환/반품 안내는{' '}
              <Link
                href="/guide/return"
                className="inline-flex min-h-11 min-w-11 items-center justify-center underline"
              >
                여기
              </Link>
              에서 확인해 주세요.
            </li>
          </ul>
        </div>
      </div>

      {product.description && (
        <section className="mt-12 border-t border-neutral-200 pt-8" aria-labelledby="desc-heading">
          <h2 id="desc-heading" className="mb-6 text-lg font-bold">
            상품 설명
          </h2>
          <div
            className="space-y-4 text-sm leading-relaxed text-neutral-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </section>
      )}

      <section className="mt-12 border-t border-neutral-200 pt-8" aria-labelledby="review-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="review-heading" className="text-lg font-bold">
            리뷰 <span className="text-base font-normal text-neutral-400">({product.reviewCount})</span>
          </h2>
          {product.reviewCount > 0 && (
            <Link
              href={`/goods/${product.slug}/reviews`}
              className="flex items-center text-sm text-neutral-500 transition-colors hover:text-neutral-800"
            >
              전체보기 <ChevronRight size={14} />
            </Link>
          )}
        </div>
        {product.reviewCount === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">
            아직 리뷰가 없습니다. 첫 번째 리뷰를 남겨보세요.
          </p>
        ) : (
          <div className="flex items-center gap-4 rounded-xl bg-neutral-50 px-6 py-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold">{product.avgRating.toFixed(1)}</p>
              <StarRating rating={product.avgRating} count={product.reviewCount} />
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 border-t border-neutral-200 pt-8" aria-labelledby="qna-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="qna-heading" className="text-lg font-bold">상품 문의</h2>
          <Link
            href={`/goods/${product.slug}/qna`}
            className="inline-flex min-h-11 items-center text-sm text-neutral-500 transition-colors hover:text-neutral-800"
          >
            문의하기
          </Link>
        </div>
        <p className="py-6 text-center text-sm text-neutral-400">
          상품 관련 문의사항을 남겨주세요.
        </p>
        <ProductQnaForm productId={product.id} />
      </section>
    </div>
  );
}
