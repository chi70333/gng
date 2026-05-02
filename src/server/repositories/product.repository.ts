// 상품 DB 접근 레이어.
// 레거시 PHP: goods_list.php, goods_detail.php, _goods_detail2.php
// N+1 금지: include/select 명시적 사용. Decimal/BigInt → string 직렬화.

import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';

// ============================================================
// 직렬화 타입 (RSC → Client 직렬화 가능)
// ============================================================

export interface ProductSummary {
  id: string;
  sku: string;
  slug: string;
  name: string;
  summary: string | null;
  price: string;        // Prisma.Decimal → string
  salePrice: string | null;
  status: string;
  thumbnail: string | null;
  soldCount: number;
  viewCount: number;
  brand: { id: string; name: string } | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  attributes: unknown;
  images: ProductImage[];
  options: ProductOption[];
  skus: ProductSku[];
  reviewCount: number;
  avgRating: number;
  categories: { id: string; name: string; slug: string }[];
}

export type ProductMetadata = Pick<
  ProductSummary,
  'name' | 'summary' | 'thumbnail'
>;

export type ProductLegacyRoute = {
  slug: string;
};

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isMain: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  sortOrder: number;
  values: unknown; // string[]
}

export interface ProductSku {
  id: string;
  code: string;
  optionValues: unknown; // Record<string, string>
  priceDelta: string;
  stock: number;
  reserved: number;
  isActive: boolean;
}

export type SortOption = 'new' | 'popular' | 'price_asc' | 'price_desc';

export interface ProductListParams {
  categorySlug: string;
  page?: number;
  limit?: number;
  sort?: SortOption;
}

export interface ProductListResult {
  items: ProductSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DashboardCategorySection {
  category: {
    id: string;
    name: string;
    slug: string;
  };
  products: ProductSummary[];
}

export type ProductSearchSortOption =
  | 'relevance'
  | 'new'
  | 'old'
  | 'popular'
  | 'price_asc'
  | 'price_desc'
  | 'sale_count'
  | 'review_count';

export interface ProductSearchParams {
  q: string;
  page?: number;
  limit?: number;
  sort?: ProductSearchSortOption;
}

// ============================================================
// 내부 헬퍼
// ============================================================

type SortOrder = 'asc' | 'desc';
type ProductOrderBy =
  | { createdAt: SortOrder }
  | { soldCount: SortOrder }
  | { price: SortOrder };

const SORT_MAP: Record<SortOption, ProductOrderBy> = {
  new: { createdAt: 'desc' },
  popular: { soldCount: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
};

function searchOrderBy(
  sort: ProductSearchSortOption,
): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === 'new') return [{ createdAt: 'desc' }];
  if (sort === 'old') return [{ createdAt: 'asc' }];
  if (sort === 'popular') return [{ viewCount: 'desc' }, { soldCount: 'desc' }];
  if (sort === 'price_asc') return [{ price: 'asc' }];
  if (sort === 'price_desc') return [{ price: 'desc' }];
  if (sort === 'sale_count') return [{ soldCount: 'desc' }];
  if (sort === 'review_count') return [{ reviews: { _count: 'desc' } }];
  return [{ soldCount: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }];
}

function serializeSummary(p: {
  id: bigint;
  sku: string;
  slug: string;
  name: string;
  summary: string | null;
  price: { toString(): string };
  salePrice: { toString(): string } | null;
  status: string;
  thumbnail: string | null;
  soldCount: number;
  viewCount: number;
  brand: { id: bigint; name: string } | null;
}): ProductSummary {
  return {
    id: p.id.toString(),
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    price: p.price.toString(),
    salePrice: p.salePrice?.toString() ?? null,
    status: p.status,
    thumbnail: p.thumbnail,
    soldCount: p.soldCount,
    viewCount: p.viewCount,
    brand: p.brand ? { id: p.brand.id.toString(), name: p.brand.name } : null,
  };
}

async function getActiveCategoryAndDescendantIds(
  categorySlug: string,
): Promise<bigint[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, parentId: true, slug: true },
  });
  const target = categories.find((category) => category.slug === categorySlug);
  if (!target) return [];

  const childrenByParent = new Map<string, typeof categories>();
  for (const category of categories) {
    const parentKey = category.parentId?.toString();
    if (!parentKey) continue;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  const ids: bigint[] = [];
  const stack = [target];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    ids.push(current.id);
    stack.push(...(childrenByParent.get(current.id.toString()) ?? []));
  }

  return ids;
}

// ============================================================
// 쿼리 함수
// ============================================================

/** 카테고리 slug 기준 상품 목록 (페이지네이션 + 정렬). */
export async function getProductsByCategory(
  params: ProductListParams,
): Promise<ProductListResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const sort = params.sort ?? 'new';
  const skip = (page - 1) * limit;
  const categoryIds = await getActiveCategoryAndDescendantIds(params.categorySlug);

  if (categoryIds.length === 0) {
    return { items: [], total: 0, page, totalPages: 0 };
  }

  const where: Prisma.ProductWhereInput = {
    status: 'active' as const,
    deletedAt: null as null,
    categories: { some: { categoryId: { in: categoryIds } } },
  };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: SORT_MAP[sort],
      skip,
      take: limit,
      select: {
        id: true,
        sku: true,
        slug: true,
        name: true,
        summary: true,
        price: true,
        salePrice: true,
        status: true,
        thumbnail: true,
        soldCount: true,
        viewCount: true,
        brand: { select: { id: true, name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(serializeSummary),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/** Meilisearch unavailable fallback. Cached by the service layer for 30s; backed by pg_trgm indexes. */
export async function searchProductsByKeyword(
  params: ProductSearchParams,
): Promise<ProductListResult> {
  const q = params.q.trim();
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const sort = params.sort ?? 'relevance';
  const skip = (page - 1) * limit;

  if (!q) {
    return { items: [], total: 0, page, totalPages: 0 };
  }

  const where: Prisma.ProductWhereInput = {
    status: 'active',
    deletedAt: null,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { brand: { name: { contains: q, mode: 'insensitive' } } },
    ],
  };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: searchOrderBy(sort),
      skip,
      take: limit,
      select: {
        id: true,
        sku: true,
        slug: true,
        name: true,
        summary: true,
        price: true,
        salePrice: true,
        status: true,
        thumbnail: true,
        soldCount: true,
        viewCount: true,
        brand: { select: { id: true, name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(serializeSummary),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/** slug 기준 상품 상세. 옵션/SKU/이미지/카테고리 N+1 없이 include. */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const p = await prisma.product.findFirst({
    where: { slug, status: 'active', deletedAt: null },
    include: {
      brand: { select: { id: true, name: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      options: { orderBy: { sortOrder: 'asc' } },
      skus: { where: { isActive: true }, orderBy: { id: 'asc' } },
      categories: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
      _count: { select: { reviews: { where: { isHidden: false } } } },
    },
  });
  if (!p) return null;

  const avgResult = await prisma.productReview.aggregate({
    where: { productId: p.id, isHidden: false },
    _avg: { rating: true },
  });

  return {
    id: p.id.toString(),
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    description: p.description,
    price: p.price.toString(),
    salePrice: p.salePrice?.toString() ?? null,
    status: p.status,
    thumbnail: p.thumbnail,
    soldCount: p.soldCount,
    viewCount: p.viewCount,
    attributes: p.attributes,
    brand: p.brand ? { id: p.brand.id.toString(), name: p.brand.name } : null,
    images: p.images.map((img: { id: bigint; url: string; alt: string | null; sortOrder: number; isMain: boolean }) => ({
      id: img.id.toString(),
      url: img.url,
      alt: img.alt,
      sortOrder: img.sortOrder,
      isMain: img.isMain,
    })),
    options: p.options.map((opt: { id: bigint; name: string; sortOrder: number; values: unknown }) => ({
      id: opt.id.toString(),
      name: opt.name,
      sortOrder: opt.sortOrder,
      values: opt.values,
    })),
    skus: p.skus.map((s: { id: bigint; code: string; optionValues: unknown; priceDelta: { toString(): string }; stock: number; reserved: number; isActive: boolean }) => ({
      id: s.id.toString(),
      code: s.code,
      optionValues: s.optionValues,
      priceDelta: s.priceDelta.toString(),
      stock: s.stock,
      reserved: s.reserved,
      isActive: s.isActive,
    })),
    reviewCount: p._count.reviews,
    avgRating: avgResult._avg.rating ?? 0,
    categories: p.categories.map((c: { category: { id: bigint; name: string; slug: string } }) => ({
      id: c.category.id.toString(),
      name: c.category.name,
      slug: c.category.slug,
    })),
  };
}

/** slug 湲곗? metadata ?꾩슜 理쒖냼 ?곹뭹 ?뺣낫. */
export async function getProductMetadataBySlug(
  slug: string,
): Promise<ProductMetadata | null> {
  return prisma.product.findFirst({
    where: { slug, status: 'active', deletedAt: null },
    select: {
      name: true,
      summary: true,
      thumbnail: true,
    },
  });
}

/** Product detail view counter. Called from the no-store tracking API after Redis de-dupe. */
export async function incrementProductViewCountBySlug(slug: string): Promise<boolean> {
  const result = await prisma.product.updateMany({
    where: { slug, status: 'active', deletedAt: null },
    data: { viewCount: { increment: 1 } },
  });

  return result.count > 0;
}

/** legacy goods.idx 기준 canonical slug 조회. goods_detail.php?goodsIdx=N 301에 사용. */
export async function getProductRouteByLegacyId(
  legacyId: number,
): Promise<ProductLegacyRoute | null> {
  return prisma.product.findFirst({
    where: { legacyId, status: 'active', deletedAt: null },
    select: { slug: true },
  });
}

/** 베스트 상품 (soldCount 내림차순). */
export async function getBestProducts(limit = 8): Promise<ProductSummary[]> {
  const rows = await prisma.product.findMany({
    where: { status: 'active', deletedAt: null },
    orderBy: { soldCount: 'desc' },
    take: limit,
    select: {
      id: true,
      sku: true,
      slug: true,
      name: true,
      summary: true,
      price: true,
      salePrice: true,
      status: true,
      thumbnail: true,
      soldCount: true,
      viewCount: true,
      brand: { select: { id: true, name: true } },
    },
  });
  return rows.map(serializeSummary);
}

/** 신상품 (createdAt 내림차순). */
export async function getNewProducts(limit = 8): Promise<ProductSummary[]> {
  const rows = await prisma.product.findMany({
    where: { status: 'active', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      sku: true,
      slug: true,
      name: true,
      summary: true,
      price: true,
      salePrice: true,
      status: true,
      thumbnail: true,
      soldCount: true,
      viewCount: true,
      brand: { select: { id: true, name: true } },
    },
  });
  return rows.map(serializeSummary);
}

/** 메인 대시보드 표시 카테고리별 상품 섹션. CategoryOnProduct include로 N+1을 피한다. */
export async function getDashboardCategorySections(
  limitPerCategory = 8,
): Promise<DashboardCategorySection[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true, showOnDashboard: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      products: {
        where: { product: { status: 'active', deletedAt: null } },
        orderBy: [{ sortOrder: 'asc' }, { productId: 'desc' }],
        take: limitPerCategory,
        select: {
          product: {
            select: {
              id: true,
              sku: true,
              slug: true,
              name: true,
              summary: true,
              price: true,
              salePrice: true,
              status: true,
              thumbnail: true,
              soldCount: true,
              viewCount: true,
              brand: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return categories.map((category) => ({
    category: {
      id: category.id.toString(),
      name: category.name,
      slug: category.slug,
    },
    products: category.products.map((relation) => serializeSummary(relation.product)),
  }));
}

/** 상품 ID 기준 활성 SKU 목록. options API 에서 사용. */
export async function getProductSkusByProductId(productId: string): Promise<ProductSku[]> {
  const skus = await prisma.productSku.findMany({
    where: { productId: BigInt(productId), isActive: true },
    orderBy: { id: 'asc' },
  });
  return skus.map((s: { id: bigint; code: string; optionValues: unknown; priceDelta: { toString(): string }; stock: number; reserved: number; isActive: boolean }) => ({
    id: s.id.toString(),
    code: s.code,
    optionValues: s.optionValues,
    priceDelta: s.priceDelta.toString(),
    stock: s.stock,
    reserved: s.reserved,
    isActive: s.isActive,
  }));
}

/** 카테고리 필터 패싯 (브랜드 목록 + 가격 범위). */
export async function getFilterFacets(categorySlug: string) {
  const categoryIds = await getActiveCategoryAndDescendantIds(categorySlug);

  if (categoryIds.length === 0) {
    return {
      brands: [],
      priceRange: { min: '0', max: '0' },
    };
  }

  const where: Prisma.ProductWhereInput = {
    status: 'active' as const,
    deletedAt: null as null,
    categories: { some: { categoryId: { in: categoryIds } } },
  };

  const [brands, priceAgg] = await prisma.$transaction([
    prisma.brand.findMany({
      where: { products: { some: where } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
  ]);

  return {
    brands: brands.map((b: { id: bigint; name: string }) => ({ id: b.id.toString(), name: b.name })),
    priceRange: {
      min: priceAgg._min.price?.toString() ?? '0',
      max: priceAgg._max.price?.toString() ?? '0',
    },
  };
}
