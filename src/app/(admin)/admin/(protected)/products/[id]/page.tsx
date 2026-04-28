import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { parseBigIntRouteParam } from '@/lib/route-params';
import { AdminPageHeader, adminSecondaryButtonClass } from '@/components/admin/AdminUI';
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
      <AdminPageHeader
        eyebrow="상품 관리"
        title="상품 수정"
        description={product.name}
        actions={
          <Link href="/admin/products" className={adminSecondaryButtonClass}>
            목록으로
          </Link>
        }
      />
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
