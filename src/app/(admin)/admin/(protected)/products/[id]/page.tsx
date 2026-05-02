import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { parseBigIntRouteParam } from '@/lib/route-params';
import {
  AdminPageHeader,
  adminDangerButtonClass,
  adminSecondaryButtonClass,
} from '@/components/admin/AdminUI';
import { ProductForm } from '../ProductForm';
import { deleteAdminProduct } from '../../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품 수정',
};

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdmin('product.write');
  const id = parseBigIntRouteParam(params.id);
  if (!id) notFound();

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, deletedAt: null },
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
        options: {
          orderBy: { sortOrder: 'asc' },
          select: { name: true, values: true, sortOrder: true },
        },
        skus: {
          orderBy: { id: 'asc' },
          select: { code: true, optionValues: true, priceDelta: true, stock: true, isActive: true },
        },
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
          <>
            <Link href="/admin/products" className={adminSecondaryButtonClass}>
              목록으로
            </Link>
            <form action={deleteAdminProduct}>
              <input type="hidden" name="productId" value={product.id.toString()} />
              <input type="hidden" name="redirectTo" value="/admin/products" />
              <button className={`${adminDangerButtonClass} h-11`}>
                <Trash2 size={17} />
                상품 삭제
              </button>
            </form>
          </>
        }
      />
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
