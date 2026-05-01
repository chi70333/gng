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

type AdminCategory = {
  id: bigint;
  parentId: bigint | null;
  code: string;
  name: string;
  slug: string;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};

type CategoryTreeItem = {
  category: AdminCategory;
  path: string;
  level: number;
};

function categoryId(category: Pick<AdminCategory, 'id'>): string {
  return category.id.toString();
}

function buildCategoryTreeItems(categories: AdminCategory[]): CategoryTreeItem[] {
  const byId = new Map(categories.map((category) => [categoryId(category), category]));
  const childrenByParent = new Map<string, AdminCategory[]>();
  const roots: AdminCategory[] = [];

  for (const category of categories) {
    const parentKey = category.parentId?.toString() ?? '';
    if (!category.parentId || !byId.has(parentKey)) {
      roots.push(category);
      continue;
    }
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  const sortCategories = (items: AdminCategory[]) =>
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'));

  sortCategories(roots);
  for (const children of childrenByParent.values()) sortCategories(children);

  const result: CategoryTreeItem[] = [];
  const visit = (category: AdminCategory, parentPath: string, level: number) => {
    const path = parentPath ? `${parentPath} > ${category.name}` : category.name;
    result.push({ category, path, level });
    for (const child of childrenByParent.get(categoryId(category)) ?? []) {
      visit(child, path, level + 1);
    }
  };

  for (const root of roots) visit(root, '', 0);
  return result;
}

function getDescendantIdSet(categories: AdminCategory[], rootId: bigint): Set<string> {
  const childrenByParent = new Map<string, AdminCategory[]>();
  for (const category of categories) {
    const parentKey = category.parentId?.toString();
    if (!parentKey) continue;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId.toString()) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const key = categoryId(current);
    descendants.add(key);
    stack.push(...(childrenByParent.get(key) ?? []));
  }
  return descendants;
}

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
  const treeItems = buildCategoryTreeItems(categories);
  const treeItemById = new Map(treeItems.map((item) => [categoryId(item.category), item]));
  const descendantsById = new Map(
    categories.map((category) => [
      categoryId(category),
      getDescendantIdSet(categories, category.id),
    ]),
  );
  const sortState = parseAdminSort(searchParams, CATEGORY_SORT_KEYS);
  const sortedCategories = sortState.sort
    ? [...categories].sort((a, b) => {
        const effectiveSort = sortState.sort;
        if (effectiveSort === 'no')
          return compareAdminValues(a.sortOrder, b.sortOrder, sortState.dir);
        if (effectiveSort === 'name') return compareAdminValues(a.name, b.name, sortState.dir);
        if (effectiveSort === 'code') return compareAdminValues(a.code, b.code, sortState.dir);
        if (effectiveSort === 'slug') return compareAdminValues(a.slug, b.slug, sortState.dir);
        if (effectiveSort === 'sortOrder')
          return compareAdminValues(a.sortOrder, b.sortOrder, sortState.dir);
        if (effectiveSort === 'isActive')
          return compareAdminValues(Number(a.isActive), Number(b.isActive), sortState.dir);
        return compareAdminValues(a._count.products, b._count.products, sortState.dir);
      })
    : treeItems.map((item) => item.category);
  const params = new URLSearchParams();
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="카테고리 관리"
        description="부모 카테고리를 선택하면 깊이는 자동 계산됩니다. 목록에서는 전체 경로를 보고 바로 수정할 수 있습니다."
      />

      <AdminSection title="카테고리 등록" description="상위 분류와 노출 상태를 함께 입력합니다.">
        <form action={saveAdminCategory}>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1.2fr)_1fr_1fr_1fr_110px_100px]">
            <select name="parentId" className={`${adminFieldClass} h-11`}>
              <option value="">상위 없음</option>
              {treeItems.map(({ category, path, level }) => (
                <option key={categoryId(category)} value={categoryId(category)}>
                  {'\u00a0'.repeat(level * 2)}
                  {path}
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
          <p className="mt-2 text-xs font-medium text-neutral-500">
            상위 카테고리를 옮기면 하위 카테고리 깊이도 함께 보정됩니다.
          </p>
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
          rowKey={categoryId}
          emptyText="등록된 카테고리가 없습니다."
          minWidthClassName="min-w-[980px]"
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={createAdminSortHref('/admin/categories', params)}
          renderRow={(category, index) => (
            <tr
              key={categoryId(category)}
              className="bg-white align-top transition hover:bg-neutral-50"
            >
              <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                {sortedCategories.length - index}
              </td>
              <td className={adminGridStickyCellClass}>
                <form
                  id={`category-${categoryId(category)}`}
                  action={saveAdminCategory}
                  className="grid gap-2"
                >
                  <input type="hidden" name="id" value={categoryId(category)} />
                  <select
                    name="parentId"
                    defaultValue={category.parentId?.toString() ?? ''}
                    className={adminGridInputClass}
                    aria-label="상위 카테고리"
                  >
                    <option value="">상위 없음</option>
                    {treeItems
                      .filter((item) => {
                        const descendants = descendantsById.get(categoryId(category)) ?? new Set();
                        const key = categoryId(item.category);
                        return key !== categoryId(category) && !descendants.has(key);
                      })
                      .map(({ category: item, path, level }) => (
                        <option key={categoryId(item)} value={categoryId(item)}>
                          {'\u00a0'.repeat(level * 2)}
                          {path}
                        </option>
                      ))}
                  </select>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-neutral-500">
                      {treeItemById.get(categoryId(category))?.level ?? category.depth}단계
                    </span>
                    <span className="truncate text-xs font-medium text-neutral-500">
                      {treeItemById.get(categoryId(category))?.path ?? category.name}
                    </span>
                  </div>
                  <input
                    name="name"
                    defaultValue={category.name}
                    className={`${adminGridInputClass} font-bold`}
                  />
                </form>
              </td>
              <td className={adminGridCellClass}>
                <input
                  form={`category-${categoryId(category)}`}
                  name="code"
                  defaultValue={category.code}
                  className={adminGridInputClass}
                />
              </td>
              <td className={adminGridCellClass}>
                <input
                  form={`category-${categoryId(category)}`}
                  name="slug"
                  defaultValue={category.slug}
                  className={adminGridInputClass}
                />
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <input
                  form={`category-${categoryId(category)}`}
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
                      form={`category-${categoryId(category)}`}
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
                <button form={`category-${categoryId(category)}`} className={adminGridButtonClass}>
                  저장
                </button>
              </td>
            </tr>
          )}
          renderMobileCard={(category) => (
            <AdminMobileCard>
              <form
                id={`category-mobile-${categoryId(category)}`}
                action={saveAdminCategory}
                className="grid gap-3"
              >
                <input type="hidden" name="id" value={categoryId(category)} />
                <select
                  name="parentId"
                  defaultValue={category.parentId?.toString() ?? ''}
                  className={adminGridInputClass}
                  aria-label="상위 카테고리"
                >
                  <option value="">상위 없음</option>
                  {treeItems
                    .filter((item) => {
                      const descendants = descendantsById.get(categoryId(category)) ?? new Set();
                      const key = categoryId(item.category);
                      return key !== categoryId(category) && !descendants.has(key);
                    })
                    .map(({ category: item, path, level }) => (
                      <option key={categoryId(item)} value={categoryId(item)}>
                        {'\u00a0'.repeat(level * 2)}
                        {path}
                      </option>
                    ))}
                </select>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-neutral-500">
                    {treeItemById.get(categoryId(category))?.level ?? category.depth}단계
                  </span>
                  <span className="text-xs font-medium text-neutral-500">
                    {treeItemById.get(categoryId(category))?.path ?? category.name}
                  </span>
                </div>
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
