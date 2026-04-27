// Legacy sources: board_edit.php.
// Cache: no-cache. Edit authorization is checked per request.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { parseBigIntRouteParam } from '@/lib/route-params';
import { auth } from '@/server/auth';
import { getBoardPostDetail } from '@/server/services/board.service';
import { savePostAction } from '../../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시글 수정',
  description: 'GNG 게시판 글을 수정합니다.',
};

type PageProps = {
  params: { code: string; postId: string };
  searchParams?: { password?: string };
};

export default async function BoardEditPage({ params, searchParams }: PageProps) {
  const session = await auth();
  const postId = parseBigIntRouteParam(params.postId);
  if (!postId) notFound();

  const post = await getBoardPostDetail({
    boardCode: params.code,
    postId,
    password: searchParams?.password,
    sessionUser: session?.user,
  }).catch((err: unknown) => {
    if (err instanceof AppError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  });

  if (!post) {
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

  if (!post.canEdit) notFound();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">게시글 수정</h1>
      <form action={savePostAction} className="mt-5 grid gap-3 rounded-lg bg-white p-4">
        <input type="hidden" name="id" value={post.id} />
        <input type="hidden" name="boardCode" value={params.code} />
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          작성자
          <input
            name="authorName"
            defaultValue={post.authorName}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          이메일
          <input
            name="authorEmail"
            type="email"
            defaultValue={session?.user?.email ?? ''}
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
            defaultValue={post.title}
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          내용
          <textarea
            name="content"
            rows={10}
            defaultValue={post.content}
            className="rounded-md border border-neutral-200 p-3"
            required
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="isSecret"
            defaultChecked={post.isSecret}
            className="h-4 w-4"
          />
          비밀글로 등록
        </label>
        <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
          저장
        </button>
      </form>
    </div>
  );
}
