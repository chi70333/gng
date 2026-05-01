// Legacy source: product inquiry admin flows
// Cache: no-store. Product Q&A answers are operational admin data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  AdminPageHeader,
  AdminSection,
  adminPrimaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
import { answerProductQna } from '../../../actions';
import { BoardAdminNav } from '../BoardAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품문의 관리',
};

async function getBoardAdminCounts() {
  const [posts, productQna, inquiries] = await prisma.$transaction([
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.productQna.count({ where: { answer: null } }),
    prisma.inquiry.count({ where: { status: 'open' } }),
  ]);

  return { posts, productQna, inquiries };
}

export default async function AdminProductQnaPage() {
  await requireAdmin('content.read');
  const [qnas, counts] = await Promise.all([
    prisma.productQna.findMany({
      where: { answer: null },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
    }),
    getBoardAdminCounts(),
  ]);

  return (
    <div className="space-y-5">
      <AdminPageHeader title="상품문의 관리" description="미답변 상품문의에 답변을 남깁니다." />
      <BoardAdminNav active="product-qna" counts={counts} />

      <AdminSection title="상품문의 미답변" description="상품 문의에 답변을 남깁니다.">
        <ul className="divide-y divide-neutral-100">
          {qnas.length === 0 ? (
            <li className="py-3 text-sm text-neutral-500">미답변 상품문의가 없습니다.</li>
          ) : (
            qnas.map((qna) => (
              <li key={qna.id.toString()} className="py-3">
                <p className="line-clamp-1 text-sm font-bold">{qna.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                  {qna.product.name} / {qna.user?.name ?? '비회원'} /{' '}
                  {qna.createdAt.toLocaleDateString('ko-KR')}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{qna.content}</p>
                <form action={answerProductQna} className="mt-3 grid gap-2">
                  <input type="hidden" name="qnaId" value={qna.id.toString()} />
                  <input type="hidden" name="redirectTo" value="/admin/boards/product-qna" />
                  <textarea
                    name="answer"
                    rows={3}
                    placeholder="상품문의 답변"
                    className={adminTextareaClass}
                    required
                  />
                  <button className={adminPrimaryButtonClass}>답변 저장</button>
                </form>
              </li>
            ))
          )}
        </ul>
      </AdminSection>
    </div>
  );
}
