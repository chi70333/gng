// Legacy sources: ask_list.php.
// Cache: no-cache. 1:1 inquiries are per-user operational data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
import { auth } from '@/server/auth';
import { getMyInquiries } from '@/server/services/board.service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '1:1 문의',
  description: 'GNG 1:1 문의 목록입니다.',
};

function statusLabel(status: string): string {
  if (status === 'answered') return '답변 완료';
  if (status === 'closed') return '종료';
  return '접수';
}

export default async function InquiriesPage() {
  const session = await auth();
  const inquiries = await getMyInquiries(session?.user);

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">1:1 문의</h1>
          <p className="mt-1 text-sm text-neutral-500">로그인한 계정의 문의 내역을 확인합니다.</p>
        </div>
        <Link
          href="/help/inquiries/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md bg-neutral-900 px-3 text-sm font-bold text-white"
        >
          <MessageSquarePlus size={16} />
          문의하기
        </Link>
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-lg bg-white px-4 py-16 text-center text-sm text-neutral-500">
          등록된 문의가 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg bg-white">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id}>
              <Link href={`/help/inquiries/${inquiry.id}`} className="block px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-bold text-neutral-900">{inquiry.title}</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-700">
                    {statusLabel(inquiry.status)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
