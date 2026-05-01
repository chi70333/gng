// Legacy sources: wb_admin/bbs_list.php, wb_admin/bbs_write.php
// Cache: no-store. Board posts are operational admin data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
import { adminGridButtonClass } from '@/components/admin/AdminDataGrid';
import { deleteAdminPost, saveAdminPost } from '../../../actions';
import { BoardAdminNav } from '../BoardAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시글 관리',
};

const BOARD_TYPES = [
  { value: 'free', label: '일반' },
  { value: 'notice', label: '공지' },
  { value: 'event', label: '이벤트' },
  { value: 'faq', label: 'FAQ' },
];

async function getBoardAdminCounts() {
  const [posts, productQna, inquiries] = await prisma.$transaction([
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.productQna.count({ where: { answer: null } }),
    prisma.inquiry.count({ where: { status: 'open' } }),
  ]);

  return { posts, productQna, inquiries };
}

function boardTypeLabel(type: string): string {
  return BOARD_TYPES.find((item) => item.value === type)?.label ?? type;
}

export default async function AdminBoardPostsPage() {
  await requireAdmin('content.read');
  const [boards, posts, counts] = await Promise.all([
    prisma.board.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.post.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { board: { select: { name: true } } },
    }),
    getBoardAdminCounts(),
  ]);

  return (
    <div className="space-y-5">
      <AdminPageHeader title="게시글 관리" description="게시글 등록, 수정, 삭제를 처리합니다." />
      <BoardAdminNav active="posts" counts={counts} />

      <AdminSection title="게시글 등록" description="공지/비밀글 옵션을 함께 등록합니다.">
        <form action={saveAdminPost}>
          <input type="hidden" name="redirectTo" value="/admin/boards/posts" />
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
              <select name="boardId" className={`${adminFieldClass} h-11`} required>
                {boards.map((board) => (
                  <option key={board.id.toString()} value={board.id.toString()}>
                    {board.name} ({boardTypeLabel(board.type)})
                  </option>
                ))}
              </select>
              <input
                name="title"
                placeholder="제목"
                className={`${adminFieldClass} h-11`}
                required
              />
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="isNotice" />
                공지
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="isSecret" />
                비밀
              </label>
            </div>
            <textarea
              name="content"
              rows={5}
              placeholder="내용"
              className={adminTextareaClass}
              required
            />
            <div className="flex justify-end">
              <button className={`${adminPrimaryButtonClass} h-11`}>등록</button>
            </div>
          </div>
        </form>
      </AdminSection>

      <AdminSection title="최근 게시글" description="최근 작성된 게시글을 바로 수정합니다.">
        <ul className="divide-y divide-neutral-100">
          {posts.length === 0 ? (
            <li className="p-4 text-sm text-neutral-500">등록된 게시글이 없습니다.</li>
          ) : (
            posts.map((post) => (
              <li key={post.id.toString()} className="p-4">
                <form action={saveAdminPost} className="grid gap-3">
                  <input type="hidden" name="id" value={post.id.toString()} />
                  <input type="hidden" name="redirectTo" value="/admin/boards/posts" />
                  <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
                    <select
                      name="boardId"
                      defaultValue={post.boardId.toString()}
                      className={adminFieldClass}
                    >
                      {boards.map((board) => (
                        <option key={board.id.toString()} value={board.id.toString()}>
                          {board.name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="title"
                      defaultValue={post.title}
                      className={`${adminFieldClass} font-bold`}
                    />
                    <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
                      <input type="checkbox" name="isNotice" defaultChecked={post.isNotice} />
                      공지
                    </label>
                    <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
                      <input type="checkbox" name="isSecret" defaultChecked={post.isSecret} />
                      비밀
                    </label>
                  </div>
                  <textarea
                    name="content"
                    defaultValue={post.content}
                    rows={3}
                    className={adminTextareaClass}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <span>
                      {post.board.name} / 조회 {post.viewCount} /{' '}
                      {post.createdAt.toLocaleDateString('ko-KR')}
                    </span>
                    <div className="flex gap-2">
                      <button className={adminGridButtonClass}>저장</button>
                      <button
                        formAction={deleteAdminPost}
                        name="postId"
                        value={post.id.toString()}
                        className="min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </form>
              </li>
            ))
          )}
        </ul>
      </AdminSection>
    </div>
  );
}
