// Legacy sources: ask_view.php, ask_delete.php.
// Cache: no-cache. 1:1 inquiry access is per request.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, PencilLine, Trash2 } from 'lucide-react';
import { AppError } from '@/lib/errors';
import { parseBigIntRouteParam } from '@/lib/route-params';
import { auth } from '@/server/auth';
import { getInquiryDetail } from '@/server/services/board.service';
import { deleteInquiryAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '문의 상세',
  description: 'GNG 1:1 문의 상세입니다.',
};

type PageProps = {
  params: { id: string };
  searchParams?: { password?: string };
};

function statusLabel(status: string): string {
  if (status === 'answered') return '답변 완료';
  if (status === 'closed') return '종료';
  return '접수';
}

export default async function InquiryDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  const inquiryId = parseBigIntRouteParam(params.id);
  if (!inquiryId) notFound();

  const inquiry = await getInquiryDetail({
    inquiryId,
    password: searchParams?.password,
    sessionUser: session?.user,
  }).catch((err: unknown) => {
    if (err instanceof AppError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  });

  if (!inquiry) {
    return (
      <div className="mx-auto max-w-screen-sm px-4 py-10">
        <div className="rounded-lg bg-white p-5">
          <Lock className="text-neutral-400" size={28} />
          <h1 className="mt-3 text-lg font-bold text-neutral-900">문의 비밀번호 확인</h1>
          <form className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-neutral-700">
              비밀번호
              <input
                name="password"
                type="password"
                className="min-h-11 rounded-md border border-neutral-200 px-3"
                required
              />
            </label>
            <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
              확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <article className="rounded-lg bg-white p-4">
        <div className="border-b border-neutral-100 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-neutral-900">{inquiry.title}</h1>
              <p className="mt-2 text-xs text-neutral-500">
                {inquiry.name} · {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-700">
              {statusLabel(inquiry.status)}
            </span>
          </div>
        </div>
        <div className="whitespace-pre-wrap py-5 text-sm leading-7 text-neutral-800">
          {inquiry.content}
        </div>
        {inquiry.answer ? (
          <div className="rounded-lg bg-neutral-50 p-4">
            <p className="text-sm font-bold text-neutral-900">답변</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
              {inquiry.answer}
            </p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          <Link
            href="/help/inquiries"
            className="inline-flex min-h-10 items-center rounded-md border border-neutral-200 px-3 text-sm font-bold"
          >
            목록
          </Link>
          {inquiry.canEdit ? (
            <Link
              href={`/help/inquiries/${inquiry.id}/edit${searchParams?.password ? `?password=${encodeURIComponent(searchParams.password)}` : ''}`}
              className="inline-flex min-h-10 items-center gap-1 rounded-md border border-neutral-200 px-3 text-sm font-bold"
            >
              <PencilLine size={15} />
              수정
            </Link>
          ) : null}
          <form action={deleteInquiryAction} className="ml-auto flex gap-2">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <input
              name="password"
              type="password"
              className="min-h-10 w-28 rounded-md border border-neutral-200 px-2 text-sm"
              placeholder="비밀번호"
            />
            <button className="inline-flex min-h-10 items-center gap-1 rounded-md border border-neutral-200 px-3 text-sm font-bold text-red-600">
              <Trash2 size={15} />
              삭제
            </button>
          </form>
        </div>
      </article>
    </div>
  );
}
