// Legacy sources: ask_edit.php.
// Cache: no-cache. Inquiry edit authorization is checked per request.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { parseBigIntRouteParam } from '@/lib/route-params';
import { auth } from '@/server/auth';
import { getInquiryDetail } from '@/server/services/board.service';
import { saveInquiryAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '문의 수정',
  description: 'GNG 1:1 문의를 수정합니다.',
};

type PageProps = {
  params: { id: string };
  searchParams?: { password?: string };
};

export default async function InquiryEditPage({ params, searchParams }: PageProps) {
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
          <h1 className="text-lg font-bold text-neutral-900">수정 비밀번호 확인</h1>
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

  if (!inquiry.canEdit) notFound();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">1:1 문의 수정</h1>
      <form action={saveInquiryAction} className="mt-5 grid gap-3 rounded-lg bg-white p-4">
        <input type="hidden" name="id" value={inquiry.id} />
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          이름
          <input
            name="name"
            defaultValue={inquiry.name}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          이메일
          <input
            name="email"
            type="email"
            defaultValue={inquiry.email}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          연락처
          <input
            name="phone"
            defaultValue={inquiry.phone ?? ''}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          비밀번호
          <input
            name="password"
            type="password"
            defaultValue={searchParams?.password ?? ''}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            placeholder="변경하지 않으려면 비워두세요."
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          제목
          <input
            name="title"
            defaultValue={inquiry.title}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          문의 내용
          <textarea
            name="content"
            rows={10}
            defaultValue={inquiry.content}
            className="rounded-md border border-neutral-200 p-3"
            required
          />
        </label>
        <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
          저장
        </button>
      </form>
    </div>
  );
}
