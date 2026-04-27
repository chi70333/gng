// Legacy sources: wb_admin/category_manage.php, wb_admin/category_write.php, wb_admin/category_edit.php
// Cache: no-store. Category ordering is operational data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { saveAdminCategory } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '카테고리 관리',
};

export default async function AdminCategoriesPage() {
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-neutral-950">카테고리 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">
          레거시 카테고리 등록/수정 동선처럼 상단에서 등록하고 목록 행에서 바로 수정합니다.
        </p>
      </div>

      <form action={saveAdminCategory} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-extrabold">카테고리 등록</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_1fr_90px_90px_100px_auto]">
          <select name="parentId" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm">
            <option value="">상위 없음</option>
            {categories.map((category) => (
              <option key={category.id.toString()} value={category.id.toString()}>
                {'-'.repeat(category.depth)} {category.name}
              </option>
            ))}
          </select>
          <input name="code" placeholder="카테고리 코드" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <input name="name" placeholder="카테고리명" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <input name="slug" placeholder="slug" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <input name="depth" type="number" min={0} defaultValue={0} className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" />
          <input name="sortOrder" type="number" min={0} defaultValue={0} className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" />
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="isActive" defaultChecked />
            사용
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="min-h-11 rounded-md bg-neutral-900 px-5 text-sm font-extrabold text-white">
            등록
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">카테고리</th>
              <th className="w-36 px-4 py-3 text-left">코드</th>
              <th className="w-44 px-4 py-3 text-left">주소</th>
              <th className="w-20 px-4 py-3 text-right">정렬</th>
              <th className="w-24 px-4 py-3 text-center">상태</th>
              <th className="w-24 px-4 py-3 text-right">상품</th>
              <th className="w-24 px-4 py-3 text-right">수정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {categories.map((category) => (
              <tr key={category.id.toString()} className="align-top hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <form id={`category-${category.id.toString()}`} action={saveAdminCategory} className="grid gap-2">
                    <input type="hidden" name="id" value={category.id.toString()} />
                    <input type="hidden" name="depth" value={category.depth} />
                    <select name="parentId" defaultValue={category.parentId?.toString() ?? ''} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm">
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
                      className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm font-bold"
                    />
                  </form>
                </td>
                <td className="px-4 py-3">
                  <input form={`category-${category.id.toString()}`} name="code" defaultValue={category.code} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm" />
                </td>
                <td className="px-4 py-3">
                  <input form={`category-${category.id.toString()}`} name="slug" defaultValue={category.slug} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm" />
                </td>
                <td className="px-4 py-3 text-right">
                  <input form={`category-${category.id.toString()}`} name="sortOrder" type="number" min={0} defaultValue={category.sortOrder} className="min-h-10 w-20 rounded-md border border-neutral-200 px-3 text-right text-sm" />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AdminStatusBadge status={category.isActive ? 'active' : 'hidden'} />
                    <label className="text-xs font-bold text-neutral-500">
                      <input form={`category-${category.id.toString()}`} type="checkbox" name="isActive" defaultChecked={category.isActive} className="mr-1" />
                      사용
                    </label>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{category._count.products}</td>
                <td className="px-4 py-3 text-right">
                  <button form={`category-${category.id.toString()}`} className="min-h-10 rounded-md border border-neutral-200 px-4 text-sm font-bold hover:bg-neutral-100">
                    저장
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
