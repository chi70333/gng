// Legacy sources: board_view.php, board_lock.php, board_comment_ajax.php.
// Cache: no-cache. Secret checks, comments, and view counts are request scoped.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, PencilLine, Trash2 } from 'lucide-react';
import { AppError } from '@/lib/errors';
import { parseBigIntRouteParam } from '@/lib/route-params';
import { auth } from '@/server/auth';
import { getBoardPostDetail } from '@/server/services/board.service';
import { createCommentAction, deleteCommentAction, deletePostAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시글',
  description: 'GNG 게시판 글 상세입니다.',
};

type PageProps = {
  params: { code: string; postId: string };
  searchParams?: { password?: string };
};

export default async function BoardPostPage({ params, searchParams }: PageProps) {
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
          <Lock className="text-neutral-400" size={28} />
          <h1 className="mt-3 text-lg font-bold text-neutral-900">비밀글입니다</h1>
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

  if (post.boardCode !== params.code) notFound();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <article className="rounded-lg bg-white p-4">
        <div className="border-b border-neutral-100 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-neutral-900">{post.title}</h1>
              <p className="mt-2 text-xs text-neutral-500">
                {post.authorName} · {new Date(post.createdAt).toLocaleDateString('ko-KR')} · 조회{' '}
                {post.viewCount.toLocaleString('ko-KR')}
              </p>
            </div>
            {post.isSecret ? (
              <Lock size={18} className="shrink-0 text-neutral-400" aria-label="비밀글" />
            ) : null}
          </div>
        </div>
        <div className="whitespace-pre-wrap py-5 text-sm leading-7 text-neutral-800">
          {post.content}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          <Link
            href={`/board/${params.code}`}
            className="inline-flex min-h-10 items-center rounded-md border border-neutral-200 px-3 text-sm font-bold"
          >
            목록
          </Link>
          {post.canEdit ? (
            <Link
              href={`/board/${params.code}/${post.id}/edit${searchParams?.password ? `?password=${encodeURIComponent(searchParams.password)}` : ''}`}
              className="inline-flex min-h-10 items-center gap-1 rounded-md border border-neutral-200 px-3 text-sm font-bold"
            >
              <PencilLine size={15} />
              수정
            </Link>
          ) : null}
          <form action={deletePostAction} className="ml-auto flex gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="boardCode" value={params.code} />
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

      <section className="mt-4 rounded-lg bg-white p-4">
        <h2 className="text-base font-bold text-neutral-900">
          댓글 {post.commentCount.toLocaleString('ko-KR')}
        </h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          {post.comments.map((comment) => (
            <li key={comment.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-neutral-900">{comment.authorName}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                    {comment.content}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(comment.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <form action={deleteCommentAction} className="flex shrink-0 gap-1">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="boardCode" value={params.code} />
                  <input
                    name="password"
                    type="password"
                    className="min-h-9 w-20 rounded-md border border-neutral-200 px-2 text-xs"
                    placeholder="비밀번호"
                  />
                  <button className="min-h-9 rounded-md border border-neutral-200 px-2 text-xs font-bold">
                    삭제
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <form
          action={createCommentAction}
          className="mt-4 grid gap-2 border-t border-neutral-100 pt-4"
        >
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="boardCode" value={params.code} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              name="authorName"
              defaultValue={session?.user?.name ?? ''}
              className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm"
              placeholder="작성자"
              required
            />
            <input
              name="password"
              type="password"
              className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm"
              placeholder={session ? '댓글 삭제용 비밀번호' : '비밀번호'}
              required={!session}
            />
          </div>
          <textarea
            name="content"
            rows={3}
            className="rounded-md border border-neutral-200 p-3 text-sm"
            placeholder="댓글을 입력해 주세요."
            required
          />
          <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
            댓글 등록
          </button>
        </form>
      </section>
    </div>
  );
}
