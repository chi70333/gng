// Legacy sources: wb_admin/product/total_goods_list_excel.php
// Cache: no-store. Admin export must reflect the filtered live catalog.

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { adminProductListQuerySchema } from '@/schemas/admin-product';

export const dynamic = 'force-dynamic';

const LEGACY_PRODUCT_EXCEL_COLUMNS = [
  '상품코드',
  '카테고리',
  '상품명',
  '모델명',
  '제조사',
  '원산지',
  '재고상태',
  '매입가',
  '부가세',
  '배송비',
  'PG수수료',
  '매입원가',
  '판매가',
  '마진율',
  '상품이미지1',
  '상품이미지2',
  '상품이미지3',
  '확대이미지1',
  '확대이미지2',
  '확대이미지3',
  '확대이미지4',
  '확대이미지5',
  '상세이미지1',
  '상세이미지2',
  '상세이미지3',
  '상세이미지4',
  '상세설명',
  '등록일',
  '비고',
];

function escapeCell(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function legacyText(attributes: Prisma.JsonValue, key: string): string {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return '';
  const record = attributes as Record<string, unknown>;
  const legacyAdmin = record.legacyAdmin;
  const value =
    record[key] ??
    (legacyAdmin && typeof legacyAdmin === 'object' && !Array.isArray(legacyAdmin)
      ? (legacyAdmin as Record<string, unknown>)[key]
      : undefined);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function stockState(attributes: Prisma.JsonValue, status: string): string {
  if (status === 'sold_out') return '품절';
  const useStock = legacyText(attributes, 'useStock');
  if (useStock === '2') return '제한';
  return '무제한';
}

function buildProductWhere(query: ReturnType<typeof adminProductListQuerySchema.parse>): Prisma.ProductWhereInput {
  const skuStockWhere: Prisma.ProductSkuWhereInput | undefined =
    query.stock === 'low'
      ? { stock: { lte: 5 }, isActive: true }
      : query.stock === 'managed'
        ? { stock: { lt: 999999 }, isActive: true }
        : query.stock === 'unlimited'
          ? { stock: { gte: 999999 }, isActive: true }
          : undefined;

  return {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
    ...(skuStockWhere ? { skus: { some: skuStockWhere } } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { sku: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { summary: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function GET(request: Request) {
  await requireAdmin('product.read');
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const query = adminProductListQuerySchema.parse(searchParams);
  const products = await prisma.product.findMany({
    where: buildProductWhere(query),
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      sku: true,
      name: true,
      description: true,
      price: true,
      salePrice: true,
      costPrice: true,
      status: true,
      attributes: true,
      createdAt: true,
      categories: {
        select: { category: { select: { name: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      images: {
        select: { url: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      },
    },
  });

  const header = `<tr>${LEGACY_PRODUCT_EXCEL_COLUMNS.map((column) => `<td>${escapeCell(column)}</td>`).join('')}</tr>`;
  const rows = products
    .map((product) => {
      const images = product.images.map((image) => image.url);
      const salePrice = product.salePrice ?? product.price;
      const costPrice = product.costPrice?.toString() ?? '0';
      const values = [
        product.sku,
        product.categories.map((item) => item.category.name).join(', '),
        product.name,
        legacyText(product.attributes, 'model'),
        legacyText(product.attributes, 'company'),
        legacyText(product.attributes, 'origin'),
        stockState(product.attributes, product.status),
        costPrice,
        '0',
        '0',
        legacyText(product.attributes, 'pgRate') || '0',
        costPrice,
        salePrice.toString(),
        legacyText(product.attributes, 'margin'),
        images[0],
        images[1],
        images[2],
        images[3],
        images[4],
        images[5],
        images[6],
        images[7],
        '',
        '',
        '',
        '',
        product.description ?? '',
        product.createdAt.toISOString().slice(0, 10),
        '',
      ];
      return `<tr>${values.map((value) => `<td>${escapeCell(value)}</td>`).join('')}</tr>`;
    })
    .join('');
  const html = `<html><head><meta charset="utf-8" /></head><body><table>${header}${rows}</table></body></html>`;
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="goods${stamp}.xls"`,
      'Cache-Control': 'no-store',
    },
  });
}
