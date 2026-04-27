// Legacy sources: wb_admin/product/goods_manage.php, wb_admin/product/goods_total.php, wb_admin/product/goods_excel.php
// Cache: no-store. Admin product list and CSV import must reflect live catalog, display, and stock state.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Download, ImageOff, Plus, RotateCcw, Search, Upload } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { adminProductListQuerySchema } from '@/schemas/admin-product';
import { importAdminProductsCsv } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품 관리',
};

const PAGE_SIZE = 30;

type ProductSearchParams = {
  q?: string;
  status?: string;
  categoryId?: string;
  stock?: string;
  page?: string;
  imported?: string;
  skipped?: string;
};

function getLegacyAdminFlag(attributes: Prisma.JsonValue, key: string): string {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return '';
  const legacyAdmin = (attributes as Record<string, unknown>).legacyAdmin;
  if (!legacyAdmin || typeof legacyAdmin !== 'object' || Array.isArray(legacyAdmin)) return '';
  const value = (legacyAdmin as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function displayLabel(attributes: Prisma.JsonValue): string {
  return getLegacyAdminFlag(attributes, 'display') === '0' ? '미노출' : '노출';
}

function stockLabel(attributes: Prisma.JsonValue): string {
  return getLegacyAdminFlag(attributes, 'useStock') === '2' ? '수량관리' : '무제한';
}

function saleStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '판매 중',
    draft: '임시저장',
    hidden: '숨김',
    sold_out: '일시품절',
  };
  return labels[status] ?? status;
}

function displayBadgeClass(attributes: Prisma.JsonValue): string {
  return getLegacyAdminFlag(attributes, 'display') === '0'
    ? 'bg-amber-50 text-amber-700 ring-amber-100'
    : 'bg-emerald-50 text-emerald-700 ring-emerald-100';
}

function saleStatusBadgeClass(status: string): string {
  const styles: Record<string, string> = {
    active: 'bg-blue-50 text-blue-700 ring-blue-100',
    draft: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
    hidden: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
    sold_out: 'bg-rose-50 text-rose-700 ring-rose-100',
  };
  return styles[status] ?? 'bg-neutral-100 text-neutral-600 ring-neutral-200';
}

function pointRateLabel(attributes: Prisma.JsonValue): string {
  const value = getLegacyAdminFlag(attributes, 'pointRate');
  if (!value) return '0%';
  return `${Number(value).toLocaleString('ko-KR')}%`;
}

function formatAdminDate(value: Date): string {
  const year = String(value.getFullYear()).slice(2);
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function appendParams(params: URLSearchParams, key: string, value: string | undefined) {
  if (!value) return;
  params.set(key, value);
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: ProductSearchParams;
}) {
  await requireAdmin('product.read');
  const query = adminProductListQuerySchema.parse(searchParams);
  const skuStockWhere: Prisma.ProductSkuWhereInput | undefined =
    query.stock === 'low'
      ? { stock: { lte: 5 }, isActive: true }
      : query.stock === 'managed'
        ? { stock: { lt: 999999 }, isActive: true }
        : query.stock === 'unlimited'
          ? { stock: { gte: 999999 }, isActive: true }
          : undefined;
  const where: Prisma.ProductWhereInput = {
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

  const [products, total, categories] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        sku: true,
        name: true,
        status: true,
        price: true,
        salePrice: true,
        soldCount: true,
        viewCount: true,
        thumbnail: true,
        attributes: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          select: { category: { select: { id: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        skus: { select: { stock: true, reserved: true, isActive: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, depth: true },
    }),
  ]);

  const params = new URLSearchParams();
  appendParams(params, 'q', query.q);
  appendParams(params, 'status', query.status);
  appendParams(params, 'categoryId', query.categoryId?.toString());
  appendParams(params, 'stock', query.stock);
  const baseHref = `/admin/products${params.toString() ? `?${params.toString()}` : ''}`;
  const exportHref = `/api/admin/products/export${params.toString() ? `?${params.toString()}` : ''}`;
  const hasFilters = Boolean(query.q || query.status || query.categoryId || query.stock);

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-neutral-950">상품 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            총 {formatNumber(total)}개 상품을 운영 상태, 카테고리, 재고 기준으로 조회합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={exportHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            <Download size={18} />
            엑셀 다운로드
          </Link>
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-neutral-800"
          >
            <Plus size={18} />
            상품 등록
          </Link>
        </div>
      </div>

      {searchParams.imported ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          CSV 반영 {formatNumber(Number(searchParams.imported) || 0)}건, 건너뜀{' '}
          {formatNumber(Number(searchParams.skipped) || 0)}건
        </div>
      ) : null}

      <details className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-extrabold text-neutral-950">
          상품 CSV 업로드
          <span className="text-xs font-semibold text-neutral-500">레거시 CSV 양식 지원</span>
        </summary>
        <form
          action={importAdminProductsCsv}
          className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-100 p-4"
        >
          <p className="max-w-xl text-sm text-neutral-500">
            레거시 goods_excel.php 양식의 CSV를 그대로 업로드합니다.
          </p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input
              type="file"
              name="csvFile"
              accept=".csv,text/csv"
              required
              className="min-h-11 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-80"
            />
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800">
              <Upload size={18} />
              업로드
            </button>
          </div>
        </form>
      </details>

      <form className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_190px_160px_auto_auto]">
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            검색어
            <input
              name="q"
              defaultValue={query.q}
              placeholder="상품명, 상품코드, slug 검색"
              className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-900"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            상태
            <select
              name="status"
              defaultValue={query.status ?? ''}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-900"
            >
              <option value="">전체 상태</option>
              <option value="draft">임시저장</option>
              <option value="active">판매중</option>
              <option value="sold_out">품절</option>
              <option value="hidden">숨김</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            카테고리
            <select
              name="categoryId"
              defaultValue={query.categoryId?.toString() ?? ''}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-900"
            >
              <option value="">전체 카테고리</option>
              {categories.map((category) => (
                <option key={category.id.toString()} value={category.id.toString()}>
                  {'-'.repeat(category.depth)} {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            재고
            <select
              name="stock"
              defaultValue={query.stock ?? ''}
              className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-900"
            >
              <option value="">전체 재고</option>
              <option value="low">재고 5개 이하</option>
              <option value="managed">수량관리 상품</option>
              <option value="unlimited">무제한 상품</option>
            </select>
          </label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800">
            <Search size={17} />
            검색
          </button>
          {hasFilters ? (
            <Link
              href="/admin/products"
              className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
            >
              <RotateCcw size={16} />
              초기화
            </Link>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-extrabold text-neutral-950">상품 목록</p>
          <p className="text-xs font-semibold text-neutral-500">
            현재 페이지 {formatNumber(products.length)}개
          </p>
        </div>
        <div className="overflow-x-auto">
        <table className="min-w-[1500px] border-separate border-spacing-0 text-xs text-neutral-700">
          <thead>
            <tr className="bg-neutral-50 text-center text-[11px] font-extrabold uppercase text-neutral-500">
              <th className="sticky top-0 w-[50px] border-b border-r border-neutral-200 px-2 py-3">NO</th>
              <th className="sticky top-0 w-[48px] border-b border-r border-neutral-200 px-2 py-3">
                <input type="checkbox" aria-label="전체 상품 선택" className="h-4 w-4 rounded border-neutral-300 accent-neutral-900" />
              </th>
              <th className="sticky top-0 w-[120px] border-b border-r border-neutral-200 px-2 py-3">이미지</th>
              <th className="sticky top-0 min-w-[360px] border-b border-r border-neutral-200 px-3 py-3">상품명</th>
              <th className="sticky top-0 w-[90px] border-b border-r border-neutral-200 px-2 py-3">적립금</th>
              <th className="sticky top-0 w-[120px] border-b border-r border-neutral-200 px-2 py-3">기본가격</th>
              <th className="sticky top-0 w-[130px] border-b border-r border-neutral-200 px-2 py-3">등록일/수정일</th>
              <th className="sticky top-0 w-[110px] border-b border-r border-neutral-200 px-2 py-3">노출상태</th>
              <th className="sticky top-0 w-[110px] border-b border-r border-neutral-200 px-2 py-3">일시품절</th>
              <th className="sticky top-0 w-[120px] border-b border-r border-neutral-200 px-2 py-3">재고수량</th>
              <th className="sticky top-0 w-[190px] border-b border-r border-neutral-200 px-2 py-3">카테고리</th>
              <th className="sticky top-0 w-[90px] border-b border-neutral-200 px-2 py-3">조회수</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={12} className="h-24 px-4 text-center text-sm text-neutral-500">
                  조회된 상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product, index) => {
                const stock = product.skus.reduce(
                  (sum, sku) => sum + (sku.isActive ? Math.max(0, sku.stock - sku.reserved) : 0),
                  0,
                );
                const categoryNames = product.categories.map((item) => item.category.name).join(' > ');
                const rowNo = total - (query.page - 1) * PAGE_SIZE - index;

                return (
                  <tr key={product.id.toString()} className="h-[58px] text-center odd:bg-white even:bg-neutral-50/40 hover:bg-blue-50/70">
                    <td className="border-b border-r border-neutral-100 px-2 py-2 font-semibold text-neutral-500">
                      {formatNumber(rowNo)}
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2">
                      <input
                        type="checkbox"
                        name="productId"
                        value={product.id.toString()}
                        aria-label={`${product.name} 선택`}
                        className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                      />
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2">
                      <div className="relative mx-auto flex h-12 w-14 items-center justify-center overflow-hidden rounded-md border border-neutral-100 bg-neutral-50 text-neutral-300 shadow-sm">
                        {product.thumbnail ? (
                          <Image
                            src={product.thumbnail}
                            alt={product.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <ImageOff size={18} />
                        )}
                      </div>
                    </td>
                    <td className="border-b border-r border-neutral-100 px-4 py-2 text-left">
                      <Link
                        href={`/admin/products/${product.id.toString()}`}
                        className="line-clamp-1 font-extrabold text-neutral-950 hover:text-blue-700 hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 text-[11px] font-semibold text-neutral-400">{product.sku}</p>
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2">{pointRateLabel(product.attributes)}</td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2 font-bold text-neutral-900">
                      {formatKRW(product.price.toString())}
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2 leading-5 text-neutral-500">
                      <span className="block">{formatAdminDate(product.createdAt)}</span>
                      <span className="block">{formatAdminDate(product.updatedAt)}</span>
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2">
                      <span
                        className={`inline-flex min-h-7 items-center rounded-full px-3 font-bold ring-1 ${displayBadgeClass(
                          product.attributes,
                        )}`}
                      >
                        {displayLabel(product.attributes)}
                      </span>
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2">
                      <span
                        className={`inline-flex min-h-7 items-center rounded-full px-3 font-bold ring-1 ${saleStatusBadgeClass(
                          product.status,
                        )}`}
                      >
                        {saleStatusLabel(product.status)}
                      </span>
                    </td>
                    <td className="border-b border-r border-neutral-100 px-2 py-2 font-bold text-neutral-900">
                      {stockLabel(product.attributes) === '무제한' ? (
                        <span className="text-neutral-500">무제한</span>
                      ) : (
                        formatNumber(stock)
                      )}
                    </td>
                    <td className="border-b border-r border-neutral-100 px-3 py-2 text-neutral-600">
                      {categoryNames || '카테고리 없음'}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-2 text-right font-semibold text-neutral-600">
                      {formatNumber(product.viewCount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
      <AdminPagination
        baseHref={baseHref}
        page={query.page}
        hasNext={query.page * PAGE_SIZE < total}
      />
    </div>
  );
}
