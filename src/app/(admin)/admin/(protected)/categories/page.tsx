// Legacy sources: wb_admin/category_manage.php, wb_admin/category_write.php, wb_admin/category_edit.php
// Cache: no-store. Category ordering is operational data.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Eye, EyeOff, PackageSearch, Plus, Save, Tags } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatNumber } from '@/lib/format';
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
  'showOnDashboard',
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
  showOnDashboard: boolean;
  _count: { products: number };
};

type CategoryTreeItem = {
  category: AdminCategory;
  path: string;
  level: number;
};

const categoryFieldLabelClass = 'grid gap-1.5 text-xs font-bold text-neutral-600';

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

function CategoryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon: typeof Tags;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm shadow-neutral-950/[0.025]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold text-neutral-500">{label}</p>
        <Icon size={18} className="text-neutral-400" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-neutral-950">{value}</p>
    </div>
  );
}

function CategoryField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`${categoryFieldLabelClass}${className ? ` ${className}` : ''}`}>
      {label}
      {children}
    </label>
  );
}

function CategoryParentSelect({
  treeItems,
  defaultValue,
  currentCategory,
  descendants,
  className,
  form,
}: {
  treeItems: CategoryTreeItem[];
  defaultValue?: string;
  currentCategory?: AdminCategory;
  descendants?: Set<string>;
  className: string;
  form?: string;
}) {
  const currentId = currentCategory ? categoryId(currentCategory) : null;
  const availableItems = treeItems.filter((item) => {
    const key = categoryId(item.category);
    return key !== currentId && !(descendants?.has(key) ?? false);
  });

  return (
    <select
      name="parentId"
      defaultValue={defaultValue ?? ''}
      className={className}
      aria-label="상위 카테고리"
      form={form}
    >
      <option value="">상위 없음</option>
      {availableItems.map(({ category, path, level }) => (
        <option key={categoryId(category)} value={categoryId(category)}>
          {'\u00a0'.repeat(level * 2)}
          {path}
        </option>
      ))}
    </select>
  );
}

function CategoryPathMeta({ item }: { item: CategoryTreeItem | undefined }) {
  if (!item) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="inline-flex min-h-6 items-center rounded bg-neutral-100 px-2 text-[11px] font-extrabold text-neutral-600 ring-1 ring-neutral-200">
        {item.level}단계
      </span>
      <span className="min-w-0 truncate text-xs font-semibold text-neutral-500">{item.path}</span>
    </div>
  );
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
      showOnDashboard: true,
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
        if (effectiveSort === 'showOnDashboard')
          return compareAdminValues(
            Number(a.showOnDashboard),
            Number(b.showOnDashboard),
            sortState.dir,
          );
        return compareAdminValues(a._count.products, b._count.products, sortState.dir);
      })
    : treeItems.map((item) => item.category);
  const activeCount = categories.filter((category) => category.isActive).length;
  const dashboardCount = categories.filter((category) => category.showOnDashboard).length;
  const rootCount = treeItems.filter((item) => item.level === 0).length;
  const maxLevel = treeItems.reduce((max, item) => Math.max(max, item.level), 0);
  const params = new URLSearchParams();
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="카테고리 관리"
        description={`${formatNumber(categories.length)}개 카테고리, 최대 ${formatNumber(maxLevel)}단계`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CategoryMetric label="전체 카테고리" value={formatNumber(categories.length)} icon={Tags} />
        <CategoryMetric label="사용 중" value={formatNumber(activeCount)} icon={Eye} />
        <CategoryMetric
          label="숨김"
          value={formatNumber(categories.length - activeCount)}
          icon={EyeOff}
        />
        <CategoryMetric
          label="대시보드 표시"
          value={formatNumber(dashboardCount)}
          icon={PackageSearch}
        />
      </div>

      <AdminSection
        title="새 카테고리 등록"
        description={`최상위 ${formatNumber(rootCount)}개`}
        icon={Plus}
      >
        <form action={saveAdminCategory} className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.7fr)]">
            <div className="grid gap-3">
              <CategoryField label="상위 카테고리">
                <CategoryParentSelect treeItems={treeItems} className={`${adminFieldClass} h-11`} />
              </CategoryField>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded border border-neutral-200 bg-neutral-50 px-3 text-sm font-bold text-neutral-700">
                쇼핑몰 노출
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked
                  className="h-5 w-5 rounded border-neutral-300 accent-neutral-900"
                />
              </label>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded border border-neutral-200 bg-neutral-50 px-3 text-sm font-bold text-neutral-700">
                대시보드 표시
                <input
                  type="checkbox"
                  name="showOnDashboard"
                  className="h-5 w-5 rounded border-neutral-300 accent-neutral-900"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_120px]">
              <CategoryField label="카테고리 코드">
                <input
                  name="code"
                  placeholder="예: 100100"
                  className={`${adminFieldClass} h-11`}
                  required
                />
              </CategoryField>
              <CategoryField label="카테고리명">
                <input
                  name="name"
                  placeholder="예: 크리스탈"
                  className={`${adminFieldClass} h-11`}
                  required
                />
              </CategoryField>
              <CategoryField label="주소">
                <input
                  name="slug"
                  placeholder="예: crystal"
                  className={`${adminFieldClass} h-11 font-mono`}
                  required
                />
              </CategoryField>
              <CategoryField label="정렬">
                <input
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className={`${adminFieldClass} h-11 text-right`}
                />
              </CategoryField>
            </div>
          </div>
          <div className="flex justify-end">
            <button className={`${adminPrimaryButtonClass} h-11`}>
              <Plus size={17} />
              등록
            </button>
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
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-16', sortKey: 'no' },
            {
              key: 'category',
              label: '카테고리',
              widthClassName: 'min-w-[300px]',
              priority: 'primary',
              sortKey: 'name',
            },
            { key: 'parent', label: '상위', widthClassName: 'w-56' },
            { key: 'code', label: '코드', widthClassName: 'w-28', sortKey: 'code' },
            { key: 'slug', label: '주소', widthClassName: 'w-36', sortKey: 'slug' },
            {
              key: 'sort',
              label: '정렬',
              align: 'right',
              widthClassName: 'w-20',
              sortKey: 'sortOrder',
            },
            {
              key: 'status',
              label: '상태',
              align: 'center',
              widthClassName: 'w-24',
              sortKey: 'isActive',
            },
            {
              key: 'dashboard',
              label: '대시보드',
              align: 'center',
              widthClassName: 'w-28',
              sortKey: 'showOnDashboard',
            },
            {
              key: 'products',
              label: '상품',
              align: 'right',
              widthClassName: 'w-20',
              sortKey: 'products',
            },
            { key: 'save', label: '수정', align: 'right', widthClassName: 'w-20' },
          ]}
          rows={sortedCategories}
          rowKey={categoryId}
          emptyText="등록된 카테고리가 없습니다."
          minWidthClassName="min-w-[1160px]"
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={createAdminSortHref('/admin/categories', params)}
          renderRow={(category, index) => {
            const rowFormId = `category-${categoryId(category)}`;
            const treeItem = treeItemById.get(categoryId(category));
            const descendants = descendantsById.get(categoryId(category)) ?? new Set();

            return (
              <tr
                key={categoryId(category)}
                className="bg-white align-top transition hover:bg-neutral-50"
              >
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(sortedCategories.length - index)}
                </td>
                <td className={adminGridStickyCellClass}>
                  <form id={rowFormId} action={saveAdminCategory} className="grid gap-2">
                    <input type="hidden" name="id" value={categoryId(category)} />
                    <div
                      className="grid gap-1 border-l-2 border-neutral-200 pl-2"
                      style={{ marginLeft: `${(treeItem?.level ?? category.depth) * 10}px` }}
                    >
                      <CategoryPathMeta item={treeItem} />
                      <input
                        name="name"
                        defaultValue={category.name}
                        className={`${adminGridInputClass} font-extrabold text-neutral-950`}
                        required
                      />
                    </div>
                  </form>
                </td>
                <td className={adminGridCellClass}>
                  <CategoryParentSelect
                    treeItems={treeItems}
                    currentCategory={category}
                    descendants={descendants}
                    defaultValue={category.parentId?.toString() ?? ''}
                    className={adminGridInputClass}
                    form={rowFormId}
                  />
                </td>
                <td className={adminGridCellClass}>
                  <input
                    form={rowFormId}
                    name="code"
                    defaultValue={category.code}
                    className={`${adminGridInputClass} font-mono`}
                    required
                  />
                </td>
                <td className={adminGridCellClass}>
                  <input
                    form={rowFormId}
                    name="slug"
                    defaultValue={category.slug}
                    className={`${adminGridInputClass} font-mono`}
                    required
                  />
                </td>
                <td className={`${adminGridCellClass} text-right`}>
                  <input
                    form={rowFormId}
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
                    <label className="inline-flex min-h-7 items-center text-xs font-bold text-neutral-500">
                      <input
                        form={rowFormId}
                        type="checkbox"
                        name="isActive"
                        defaultChecked={category.isActive}
                        className="mr-1 h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                      />
                      사용
                    </label>
                  </div>
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <label className="inline-flex min-h-7 items-center text-xs font-bold text-neutral-500">
                    <input
                      form={rowFormId}
                      type="checkbox"
                      name="showOnDashboard"
                      defaultChecked={category.showOnDashboard}
                      className="mr-1 h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                    />
                    표시
                  </label>
                </td>
                <td className={`${adminGridCellClass} text-right font-bold`}>
                  {formatNumber(category._count.products)}
                </td>
                <td className={`${adminGridCellClass} text-right`}>
                  <button form={rowFormId} className={adminGridButtonClass}>
                    <Save size={14} />
                    저장
                  </button>
                </td>
              </tr>
            );
          }}
          renderMobileCard={(category) => {
            const treeItem = treeItemById.get(categoryId(category));
            const descendants = descendantsById.get(categoryId(category)) ?? new Set();

            return (
              <AdminMobileCard className="overflow-hidden p-0">
                <form
                  id={`category-mobile-${categoryId(category)}`}
                  action={saveAdminCategory}
                  className="grid gap-0"
                >
                  <input type="hidden" name="id" value={categoryId(category)} />
                  <div className="grid gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-3">
                    <CategoryPathMeta item={treeItem} />
                    <input
                      name="name"
                      defaultValue={category.name}
                      className={`${adminGridInputClass} h-10 font-extrabold text-neutral-950`}
                      aria-label="카테고리명"
                      required
                    />
                  </div>
                  <div className="grid gap-3 p-3">
                    <CategoryField label="상위 카테고리">
                      <CategoryParentSelect
                        treeItems={treeItems}
                        currentCategory={category}
                        descendants={descendants}
                        defaultValue={category.parentId?.toString() ?? ''}
                        className={`${adminGridInputClass} h-10`}
                      />
                    </CategoryField>
                    <div className="grid grid-cols-2 gap-2">
                      <CategoryField label="코드">
                        <input
                          name="code"
                          defaultValue={category.code}
                          className={`${adminGridInputClass} h-10 font-mono`}
                          required
                        />
                      </CategoryField>
                      <CategoryField label="정렬">
                        <input
                          name="sortOrder"
                          type="number"
                          min={0}
                          defaultValue={category.sortOrder}
                          className={`${adminGridInputClass} h-10 text-right`}
                        />
                      </CategoryField>
                    </div>
                    <CategoryField label="주소">
                      <input
                        name="slug"
                        defaultValue={category.slug}
                        className={`${adminGridInputClass} h-10 font-mono`}
                        required
                      />
                    </CategoryField>
                    <dl className="grid grid-cols-2 gap-2">
                      <AdminMobileField label="상태">
                        <AdminStatusBadge status={category.isActive ? 'active' : 'hidden'} />
                      </AdminMobileField>
                      <AdminMobileField label="상품" align="right">
                        {formatNumber(category._count.products)}
                      </AdminMobileField>
                    </dl>
                    <div className="grid gap-2">
                      <label className="inline-flex min-h-11 items-center text-sm font-bold text-neutral-700">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={category.isActive}
                          className="mr-2 h-5 w-5 rounded border-neutral-300 accent-neutral-900"
                        />
                        쇼핑몰 노출
                      </label>
                      <label className="inline-flex min-h-11 items-center text-sm font-bold text-neutral-700">
                        <input
                          type="checkbox"
                          name="showOnDashboard"
                          defaultChecked={category.showOnDashboard}
                          className="mr-2 h-5 w-5 rounded border-neutral-300 accent-neutral-900"
                        />
                        대시보드 표시
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button className={`${adminGridButtonClass} h-10 px-3`}>
                        <Save size={15} />
                        저장
                      </button>
                    </div>
                  </div>
                </form>
              </AdminMobileCard>
            );
          }}
        />
      </AdminSection>
    </div>
  );
}
