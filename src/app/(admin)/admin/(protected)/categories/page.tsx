// Legacy sources: wb_admin/category_manage.php, wb_admin/category_write.php, wb_admin/category_edit.php
// Cache: no-store. Category ordering is operational data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  AdminDataGrid,
  AdminMobileCard,
  AdminMobileField,
  adminGridButtonClass,
  adminGridCellClass,
  adminGridInputClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import {
  compareAdminValues,
  createAdminSortHref,
  parseAdminSort,
} from '@/components/admin/admin-grid-sort';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
} from '@/components/admin/AdminUI';
import { saveAdminCategory } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '카테고리 관리',
};

const CATEGORY_SORT_KEYS = [
  'no',
  'name',
  'code',
  'slug',
  'sortOrder',
  'isActive',
  'products',
] as const;

type CategorySearchParams = {
  sort?: string;
  dir?: string;
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: CategorySearchParams;
}) {
  await requireAdmin('content.read');
  const categories = await prisma.category.findMany({
    orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      parentId: true,
      code: true,
      name: true,
      slug: true,
      depth: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
  const sortState = parseAdminSort(searchParams, CATEGORY_SORT_KEYS);
  const effectiveSort = sortState.sort ?? 'no';
  const sortedCategories = [...categories].sort((a, b) => {
    if (effectiveSort === 'no') return compareAdminValues(a.sortOrder, b.sortOrder, sortState.dir);
    if (effectiveSort === 'name') return compareAdminValues(a.name, b.name, sortState.dir);
    if (effectiveSort === 'code') return compareAdminValues(a.code, b.code, sortState.dir);
    if (effectiveSort === 'slug') return compareAdminValues(a.slug, b.slug, sortState.dir);
    if (effectiveSort === 'sortOrder')
      return compareAdminValues(a.sortOrder, b.sortOrder, sortState.dir);
    if (effectiveSort === 'isActive')
      return compareAdminValues(Number(a.isActive), Number(b.isActive), sortState.dir);
    return compareAdminValues(a._count.products, b._count.products, sortState.dir);
  });
  const params = new URLSearchParams();
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="카테고리 관리"
        description="카테고리를 상단에서 등록하고 목록 행에서 바로 수정합니다."
      />

      <AdminSection title="카테고리 등록" description="상위 분류와 노출 상태를 함께 입력합니다.">
        <form action={saveAdminCategory}>
          <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_1fr_90px_90px_100px_auto]">
            <select name="parentId" className={`${adminFieldClass} h-11`}>
              <option value="">상위 없음</option>
              {categories.map((category) => (
                <option key={category.id.toString()} value={category.id.toString()}>
                  {'-'.repeat(category.depth)} {category.name}
                </option>
              ))}
            </select>
            <input
              name="code"
              placeholder="카테고리 코드"
              className={`${adminFieldClass} h-11`}
              required
            />
            <input
              name="name"
              placeholder="카테고리명"
              className={`${adminFieldClass} h-11`}
              required
            />
            <input name="slug" placeholder="slug" className={`${adminFieldClass} h-11`} required />
            <input
              name="depth"
              type="number"
              min={0}
              defaultValue={0}
              className={`${adminFieldClass} h-11`}
            />
            <input
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={0}
              className={`${adminFieldClass} h-11`}
            />
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="isActive" defaultChecked />
              사용
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button className={`${adminPrimaryButtonClass} h-11`}>등록</button>
          </div>
        </form>
      </AdminSection>

      <AdminSection
        title="카테고리 목록"
        description="행에서 바로 수정할 수 있습니다."
        bodyClassName="p-0"
      >
        <AdminDataGrid
          caption="카테고리 목록"
          columns={[
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-20', sortKey: 'no' },
            {
              key: 'category',
              label: '카테고리',
              widthClassName: 'min-w-[320px]',
              priority: 'primary',
              sortKey: 'name',
            },
            { key: 'code', label: '코드', widthClassName: 'w-40', sortKey: 'code' },
            { key: 'slug', label: '주소', widthClassName: 'w-52', sortKey: 'slug' },
            {
              key: 'sort',
              label: '정렬',
              align: 'right',
              widthClassName: 'w-28',
              sortKey: 'sortOrder',
            },
            {
              key: 'status',
              label: '상태',
              align: 'center',
              widthClassName: 'w-28',
              sortKey: 'isActive',
            },
            {
              key: 'products',
              label: '상품',
              align: 'right',
              widthClassName: 'w-24',
              sortKey: 'products',
            },
            { key: 'save', label: '수정', align: 'right', widthClassName: 'w-28' },
          ]}
          rows={sortedCategories}
          rowKey={(category) => category.id.toString()}
          emptyText="등록된 카테고리가 없습니다."
          minWidthClassName="min-w-[980px]"
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={createAdminSortHref('/admin/categories', params)}
          renderRow={(category, index) => (
            <tr
              key={category.id.toString()}
              className="bg-white align-top transition hover:bg-neutral-50"
            >
              <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                {sortedCategories.length - index}
              </td>
              <td className={adminGridStickyCellClass}>
                <form
                  id={`category-${category.id.toString()}`}
                  action={saveAdminCategory}
                  className="grid gap-2"
                >
                  <input type="hidden" name="id" value={category.id.toString()} />
                  <input type="hidden" name="depth" value={category.depth} />
                  <select
                    name="parentId"
                    defaultValue={category.parentId?.toString() ?? ''}
                    className={adminGridInputClass}
                  >
                    <option value="">상위 없음</option>
                    {categories
                      .filter((item) => item.id !== category.id)
                      .map((item) => (
                        <option key={item.id.toString()} value={item.id.toString()}>
                          {'-'.repeat(item.depth)} {item.name}
                        </option>
                      ))}
                  </select>
                  <input
                    name="name"
                    defaultValue={category.name}
                    className={`${adminGridInputClass} font-bold`}
                  />
                </form>
              </td>
              <td className={adminGridCellClass}>
                <input
                  form={`category-${category.id.toString()}`}
                  name="code"
                  defaultValue={category.code}
                  className={adminGridInputClass}
                />
              </td>
              <td className={adminGridCellClass}>
                <input
                  form={`category-${category.id.toString()}`}
                  name="slug"
                  defaultValue={category.slug}
                  className={adminGridInputClass}
                />
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <input
                  form={`category-${category.id.toString()}`}
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={category.sortOrder}
                  className={`${adminGridInputClass} text-right`}
                />
              </td>
              <td className={`${adminGridCellClass} text-center`}>
                <div className="flex flex-col items-center gap-2">
                  <AdminStatusBadge status={category.isActive ? 'active' : 'hidden'} />
                  <label className="text-xs font-bold text-neutral-500">
                    <input
                      form={`category-${category.id.toString()}`}
                      type="checkbox"
                      name="isActive"
                      defaultChecked={category.isActive}
                      className="mr-1"
                    />
                    사용
                  </label>
                </div>
              </td>
              <td className={`${adminGridCellClass} text-right font-bold`}>
                {category._count.products}
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <button
                  form={`category-${category.id.toString()}`}
                  className={adminGridButtonClass}
                >
                  저장
                </button>
              </td>
            </tr>
          )}
          renderMobileCard={(category) => (
            <AdminMobileCard>
              <form
                id={`category-mobile-${category.id.toString()}`}
                action={saveAdminCategory}
                className="grid gap-3"
              >
                <input type="hidden" name="id" value={category.id.toString()} />
                <input type="hidden" name="depth" value={category.depth} />
                <select
                  name="parentId"
                  defaultValue={category.parentId?.toString() ?? ''}
                  className={adminGridInputClass}
                >
                  <option value="">상위 없음</option>
                  {categories
                    .filter((item) => item.id !== category.id)
                    .map((item) => (
                      <option key={item.id.toString()} value={item.id.toString()}>
                        {'-'.repeat(item.depth)} {item.name}
                      </option>
                    ))}
                </select>
                <input
                  name="name"
                  defaultValue={category.name}
                  className={`${adminGridInputClass} font-bold`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="code"
                    defaultValue={category.code}
                    className={adminGridInputClass}
                    aria-label="카테고리 코드"
                  />
                  <input
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={category.sortOrder}
                    className={`${adminGridInputClass} text-right`}
                    aria-label="정렬"
                  />
                </div>
                <input
                  name="slug"
                  defaultValue={category.slug}
                  className={adminGridInputClass}
                  aria-label="주소"
                />
                <dl className="grid grid-cols-2 gap-2">
                  <AdminMobileField label="상태">
                    <AdminStatusBadge status={category.isActive ? 'active' : 'hidden'} />
                  </AdminMobileField>
                  <AdminMobileField label="상품" align="right">
                    {category._count.products}
                  </AdminMobileField>
                </dl>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-neutral-600">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={category.isActive}
                      className="mr-2"
                    />
                    사용
                  </label>
                  <button className={adminGridButtonClass}>저장</button>
                </div>
              </form>
            </AdminMobileCard>
          )}
        />
      </AdminSection>
    </div>
  );
}
