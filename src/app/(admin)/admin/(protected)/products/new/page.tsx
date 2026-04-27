import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { ProductForm } from '../ProductForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품 등록',
};

export default async function NewProductPage() {
  await requireAdmin('product.write');
  const categories = await prisma.category.findMany({
    orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, name: true, depth: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-neutral-500">상품 관리</p>
          <h1 className="mt-1 text-2xl font-extrabold text-neutral-950">상품 등록</h1>
          <p className="mt-1 text-sm text-neutral-500">
            기본 정보와 판매 설정을 한 화면에서 입력합니다.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-50 md:min-h-10"
        >
          목록으로
        </Link>
      </div>
      <ProductForm product={null} categories={categories} />
    </div>
  );
}
