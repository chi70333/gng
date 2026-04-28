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
import {
  AdminDataGrid,
  type AdminSortDirection,
  AdminMobileCard,
  AdminMobileField,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminGridSelectAll } from '@/components/admin/AdminGridSelectAll';
import { AdminPageSizeSelect } from '@/components/admin/AdminPageSizeSelect';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from '@/components/admin/AdminUI';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { adminProductListQuerySchema } from '@/schemas/admin-product';
import { importAdminProductsCsv } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품 관리',
};

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [20, 30, 50, 100, 200];

type ProductSearchParams = {
  q?: string;
  status?: string;
  categoryId?: string;
  stock?: string;
  page?: string;
  imported?: string;
  skipped?: string;
  sort?: string;
  dir?: string;
  pageSize?: string;
};

const PRODUCT_SORT_KEYS = [
  'no',
  'name',
  'sku',
  'price',
  'status',
  'createdAt',
  'updatedAt',
  'viewCount',
] as const;
type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

function parseProductSort(searchParams: ProductSearchParams): {
  sort?: ProductSortKey;
  dir: AdminSortDirection;
} {
  const sort = PRODUCT_SORT_KEYS.includes(searchParams.sort as ProductSortKey)
    ? (searchParams.sort as ProductSortKey)
    : undefined;
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  return { sort, dir };
}

function productOrderBy(
  sort: ProductSortKey,
  dir: AdminSortDirection,
): Prisma.ProductOrderByWithRelationInput {
  if (sort === 'no') return { createdAt: dir };
  if (sort === 'name') return { name: dir };
  if (sort === 'sku') return { sku: dir };
  if (sort === 'price') return { price: dir };
  if (sort === 'status') return { status: dir };
  if (sort === 'updatedAt') return { updatedAt: dir };
  if (sort === 'viewCount') return { viewCount: dir };
  return { createdAt: dir };
}

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
  const pageSize = PAGE_SIZE_OPTIONS.includes(query.pageSize) ? query.pageSize : DEFAULT_PAGE_SIZE;
  const sortState = parseProductSort(searchParams);
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
      orderBy: productOrderBy(sortState.sort ?? 'no', sortState.dir),
      skip: (query.page - 1) * pageSize,
      take: pageSize,
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
  params.set('pageSize', String(pageSize));
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }
  const baseHref = `/admin/products${params.toString() ? `?${params.toString()}` : ''}`;
  const exportHref = `/api/admin/products/export${params.toString() ? `?${params.toString()}` : ''}`;
  const hasFilters = Boolean(query.q || query.status || query.categoryId || query.stock);
  const getSortHref = (sort: string, dir: AdminSortDirection) => {
    const nextParams = new URLSearchParams(params);
    if (nextParams.get('sort') === sort) {
      nextParams.delete('sort');
      nextParams.delete('dir');
    } else {
      nextParams.set('sort', sort);
      nextParams.set('dir', dir);
    }
    nextParams.delete('page');
    const nextQuery = nextParams.toString();
    return nextQuery ? `/admin/products?${nextQuery}` : '/admin/products';
  };

  return (
    <div className="min-w-0 space-y-4">
      <AdminPageHeader
        title="상품 관리"
        description={`총 ${formatNumber(total)}개 상품을 운영 상태, 카테고리, 재고 기준으로 조회합니다.`}
        actions={
          <>
            <Link href={exportHref} className={adminSecondaryButtonClass}>
              <Download size={18} />
              엑셀 다운로드
            </Link>
            <Link href="/admin/products/new" className={adminPrimaryButtonClass}>
              <Plus size={18} />
              상품 등록
            </Link>
          </>
        }
      />

      {searchParams.imported ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          CSV 반영 {formatNumber(Number(searchParams.imported) || 0)}건, 건너뜀{' '}
          {formatNumber(Number(searchParams.skipped) || 0)}건
        </div>
      ) : null}

      <details className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-extrabold text-neutral-950">
          상품 CSV 업로드
          <span className="text-xs font-semibold text-neutral-500">CSV 일괄 등록</span>
        </summary>
        <form
          action={importAdminProductsCsv}
          className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-100 p-4"
        >
          <p className="max-w-xl text-sm text-neutral-500">
            상품 CSV 파일을 업로드해 상품 정보를 일괄 등록합니다.
          </p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input
              type="file"
              name="csvFile"
              accept=".csv,text/csv"
              required
              className={`${adminFieldClass} h-11 flex-1 py-2 sm:w-80`}
            />
            <button className={`${adminPrimaryButtonClass} h-11`}>
              <Upload size={18} />
              업로드
            </button>
          </div>
        </form>
      </details>

      <form className="rounded-lg border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_190px_160px_auto_auto]">
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            검색어
            <input
              name="q"
              defaultValue={query.q}
              placeholder="상품명, 상품코드, slug 검색"
              className={`${adminFieldClass} h-11`}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            상태
            <select
              name="status"
              defaultValue={query.status ?? ''}
              className={`${adminFieldClass} h-11`}
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
              className={`${adminFieldClass} h-11`}
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
              className={`${adminFieldClass} h-11`}
            >
              <option value="">전체 재고</option>
              <option value="low">재고 5개 이하</option>
              <option value="managed">수량관리 상품</option>
              <option value="unlimited">무제한 상품</option>
            </select>
          </label>
          <input type="hidden" name="pageSize" value={pageSize} />
          <button className={`${adminPrimaryButtonClass} h-11 self-end`}>
            <Search size={17} />
            검색
          </button>
          {hasFilters ? (
            <Link href="/admin/products" className={`${adminSecondaryButtonClass} h-11 self-end`}>
              <RotateCcw size={16} />
              초기화
            </Link>
          ) : null}
        </div>
      </form>

      <AdminSection
        title="상품 목록"
        description={`현재 페이지 ${formatNumber(products.length)}개`}
        bodyClassName="p-0"
      >
        <AdminDataGrid
          caption="상품 목록"
          columns={[
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-20', sortKey: 'no' },
            { key: 'select', label: <AdminGridSelectAll name="productId" />, align: 'center', widthClassName: 'w-16' },
            { key: 'image', label: '이미지', align: 'center', widthClassName: 'w-24' },
            {
              key: 'name',
              label: '상품명',
              widthClassName: 'min-w-[320px]',
              priority: 'primary',
              sortKey: 'name',
            },
            { key: 'sku', label: '상품코드', widthClassName: 'w-44', sortKey: 'sku' },
            {
              key: 'price',
              label: '가격',
              align: 'right',
              widthClassName: 'w-32',
              sortKey: 'price',
            },
            { key: 'display', label: '노출', align: 'center', widthClassName: 'w-28' },
            {
              key: 'status',
              label: '판매상태',
              align: 'center',
              widthClassName: 'w-32',
              sortKey: 'status',
            },
            { key: 'stock', label: '재고', align: 'right', widthClassName: 'w-28' },
            { key: 'point', label: '적립금', align: 'right', widthClassName: 'w-24' },
            { key: 'category', label: '카테고리', widthClassName: 'w-64' },
            {
              key: 'createdAt',
              label: '등록일',
              align: 'right',
              widthClassName: 'w-40',
              sortKey: 'createdAt',
            },
            {
              key: 'updatedAt',
              label: '수정일',
              align: 'right',
              widthClassName: 'w-40',
              sortKey: 'updatedAt',
            },
            {
              key: 'views',
              label: '조회수',
              align: 'right',
              widthClassName: 'w-24',
              sortKey: 'viewCount',
            },
          ]}
          rows={products}
          rowKey={(product) => product.id.toString()}
          emptyText="조회된 상품이 없습니다."
          minWidthClassName="min-w-[1240px]"
          toolbarEnd={
            <AdminPageSizeSelect
              action="/admin/products"
              name="pageSize"
              value={pageSize}
              options={PAGE_SIZE_OPTIONS}
              hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
            />
          }
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={getSortHref}
          renderRow={(product, index) => {
            const stock = product.skus.reduce(
              (sum, sku) => sum + (sku.isActive ? Math.max(0, sku.stock - sku.reserved) : 0),
              0,
            );
            const categoryNames = product.categories.map((item) => item.category.name).join(' > ');
            const rowNo = total - (query.page - 1) * pageSize - index;

            return (
              <tr key={product.id.toString()} className="bg-white transition hover:bg-neutral-50">
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <input
                    type="checkbox"
                    name="productId"
                    value={product.id.toString()}
                    aria-label={`${product.name} 선택`}
                    className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                  />
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <div className="relative mx-auto flex h-14 w-16 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-white text-neutral-300">
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={product.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageOff size={18} />
                    )}
                  </div>
                </td>
                <td className={adminGridStickyCellClass}>
                  <Link
                    href={`/admin/products/${product.id.toString()}`}
                    className="line-clamp-1 font-extrabold text-neutral-950 hover:text-blue-700 hover:underline"
                  >
                    {product.name}
                  </Link>
                </td>
                <td
                  className={`${adminGridCellClass} font-mono text-xs font-semibold text-neutral-600`}
                >
                  {product.sku}
                </td>
                <td className={`${adminGridCellClass} text-right font-extrabold text-neutral-950`}>
                  {formatKRW(product.price.toString())}
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1 ${displayBadgeClass(product.attributes)}`}
                  >
                    {displayLabel(product.attributes)}
                  </span>
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1 ${saleStatusBadgeClass(product.status)}`}
                  >
                    {saleStatusLabel(product.status)}
                  </span>
                </td>
                <td className={`${adminGridCellClass} text-right`}>
                  {stockLabel(product.attributes) === '무제한' ? '무제한' : formatNumber(stock)}
                </td>
                <td className={`${adminGridCellClass} text-right`}>
                  {pointRateLabel(product.attributes)}
                </td>
                <td className={`${adminGridCellClass} text-neutral-600`}>
                  <span className="line-clamp-1">{categoryNames || '카테고리 없음'}</span>
                </td>
                <td className={`${adminGridCellClass} text-right text-xs text-neutral-500`}>
                  {formatAdminDate(product.createdAt)}
                </td>
                <td className={`${adminGridCellClass} text-right text-xs text-neutral-500`}>
                  {formatAdminDate(product.updatedAt)}
                </td>
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-700`}>
                  {formatNumber(product.viewCount)}
                </td>
              </tr>
            );
          }}
          renderMobileCard={(product, index) => {
            const stock = product.skus.reduce(
              (sum, sku) => sum + (sku.isActive ? Math.max(0, sku.stock - sku.reserved) : 0),
              0,
            );
            const categoryNames = product.categories.map((item) => item.category.name).join(' > ');
            const rowNo = total - (query.page - 1) * pageSize - index;

            return (
              <AdminMobileCard>
                <div className="flex gap-3">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-100 bg-neutral-50 text-neutral-300">
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={product.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageOff size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/products/${product.id.toString()}`}
                        className="line-clamp-2 font-extrabold text-neutral-950"
                      >
                        {product.name}
                      </Link>
                      <input
                        type="checkbox"
                        name="productId"
                        value={product.id.toString()}
                        aria-label={`${product.name} 선택`}
                        className="mt-1 h-5 w-5 shrink-0 rounded border-neutral-300 accent-neutral-900"
                      />
                    </div>
                    <p className="mt-1 font-mono text-xs font-semibold text-neutral-500">
                      NO {formatNumber(rowNo)} / {product.sku}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <AdminMobileField label="가격" align="right">
                    {formatKRW(product.price.toString())}
                  </AdminMobileField>
                  <AdminMobileField label="재고" align="right">
                    {stockLabel(product.attributes) === '무제한' ? '무제한' : formatNumber(stock)}
                  </AdminMobileField>
                  <AdminMobileField label="노출">
                    {displayLabel(product.attributes)} / {saleStatusLabel(product.status)}
                  </AdminMobileField>
                  <AdminMobileField label="조회수" align="right">
                    {formatNumber(product.viewCount)}
                  </AdminMobileField>
                  <div className="col-span-2">
                    <AdminMobileField label="카테고리">
                      {categoryNames || '카테고리 없음'}
                    </AdminMobileField>
                  </div>
                </dl>
              </AdminMobileCard>
            );
          }}
        />
      </AdminSection>
      <AdminPagination
        baseHref={baseHref}
        page={query.page}
        hasNext={query.page * pageSize < total}
      />
    </div>
  );
}
