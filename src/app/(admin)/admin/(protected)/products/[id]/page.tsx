import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { parseBigIntRouteParam } from '@/lib/route-params';
import { ProductForm } from '../ProductForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품 수정',
};

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdmin('product.write');
  const id = parseBigIntRouteParam(params.id);
  if (!id) notFound();

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        slug: true,
        name: true,
        summary: true,
        description: true,
        price: true,
        salePrice: true,
        costPrice: true,
        status: true,
        thumbnail: true,
        attributes: true,
        skus: { select: { stock: true } },
        categories: { select: { categoryId: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { url: true, alt: true, sortOrder: true, isMain: true },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, name: true, depth: true },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-neutral-500">상품 관리</p>
          <h1 className="mt-1 truncate text-2xl font-extrabold text-neutral-950">상품 수정</h1>
          <p className="mt-1 truncate text-sm text-neutral-500">{product.name}</p>
        </div>
        <Link
          href="/admin/products"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-50 md:min-h-10"
        >
          목록으로
        </Link>
      </div>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
