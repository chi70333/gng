import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { AdminPageHeader, adminSecondaryButtonClass } from '@/components/admin/AdminUI';
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
      <AdminPageHeader
        eyebrow="상품 관리"
        title="상품 등록"
        description="기본 정보와 판매 설정을 한 화면에서 입력합니다."
        actions={
          <Link href="/admin/products" className={adminSecondaryButtonClass}>
            목록으로
          </Link>
        }
      />
      <ProductForm product={null} categories={categories} />
    </div>
  );
}
