// Legacy sources: wb_admin/bbs_admin_list.php, wb_admin/bbs_admin_write.php, wb_admin/bbs_list.php, wb_admin/bbs_write.php
// Cache: no-store. Board settings, posts, and unanswered inquiries are operational data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  answerInquiry,
  answerProductQna,
  deleteAdminPost,
  saveAdminBoard,
  saveAdminPost,
} from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시판 관리',
};

const BOARD_TYPES = [
  { value: 'free', label: '일반' },
  { value: 'notice', label: '공지' },
  { value: 'event', label: '이벤트' },
  { value: 'faq', label: 'FAQ' },
];

function boardTypeLabel(type: string): string {
  return BOARD_TYPES.find((item) => item.value === type)?.label ?? type;
}

export default async function AdminBoardsPage() {
  await requireAdmin('content.read');
  const [boards, posts, qnas, inquiries] = await prisma.$transaction([
    prisma.board.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    }),
    prisma.post.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { board: { select: { name: true } } },
    }),
    prisma.productQna.findMany({
      where: { answer: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
    }),
    prisma.inquiry.findMany({
      where: { status: 'open' },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, email: true, phone: true, createdAt: true },
    }),
  ]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_520px]">
      <section className="space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-950">게시판 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            레거시 게시판 설정, 게시글 등록/수정, 상품문의와 1:1 문의 답변을 한 화면에서 처리합니다.
          </p>
        </div>

        <form action={saveAdminBoard} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold">게시판 등록</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_120px_90px_auto]">
            <input name="code" placeholder="게시판 코드" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
            <input name="name" placeholder="게시판명" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
            <select name="type" defaultValue="free" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm">
              {BOARD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="isActive" defaultChecked />
              사용
            </label>
            <button className="min-h-11 rounded-md bg-neutral-900 px-5 text-sm font-extrabold text-white">
              등록
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="text-base font-extrabold">게시판 목록</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">게시판</th>
                  <th className="w-32 px-4 py-3 text-left">코드</th>
                  <th className="w-28 px-4 py-3 text-left">유형</th>
                  <th className="w-24 px-4 py-3 text-center">상태</th>
                  <th className="w-20 px-4 py-3 text-right">글</th>
                  <th className="w-24 px-4 py-3 text-right">수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {boards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 px-4 text-center text-neutral-500">
                      등록된 게시판이 없습니다.
                    </td>
                  </tr>
                ) : (
                  boards.map((board) => (
                    <tr key={board.id.toString()} className="align-top hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <form id={`board-${board.id.toString()}`} action={saveAdminBoard}>
                          <input type="hidden" name="id" value={board.id.toString()} />
                          <input name="name" defaultValue={board.name} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm font-bold" />
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <input form={`board-${board.id.toString()}`} name="code" defaultValue={board.code} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <select form={`board-${board.id.toString()}`} name="type" defaultValue={board.type} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm">
                          {BOARD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AdminStatusBadge status={board.isActive ? 'active' : 'hidden'} />
                          <label className="text-xs font-bold text-neutral-500">
                            <input form={`board-${board.id.toString()}`} type="checkbox" name="isActive" defaultChecked={board.isActive} className="mr-1" />
                            사용
                          </label>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{board._count.posts}</td>
                      <td className="px-4 py-3 text-right">
                        <button form={`board-${board.id.toString()}`} className="min-h-10 rounded-md border border-neutral-200 px-4 text-sm font-bold hover:bg-neutral-100">
                          저장
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form action={saveAdminPost} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold">게시글 등록</h2>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
              <select name="boardId" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required>
                {boards.map((board) => (
                  <option key={board.id.toString()} value={board.id.toString()}>
                    {board.name} ({boardTypeLabel(board.type)})
                  </option>
                ))}
              </select>
              <input name="title" placeholder="제목" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="isNotice" />
                공지
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="isSecret" />
                비밀
              </label>
            </div>
            <textarea name="content" rows={5} placeholder="내용" className="rounded-md border border-neutral-200 px-3 py-2 text-sm" required />
            <div className="flex justify-end">
              <button className="min-h-11 rounded-md bg-neutral-900 px-5 text-sm font-extrabold text-white">
                등록
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="text-base font-extrabold">최근 게시글</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {posts.length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">등록된 게시글이 없습니다.</li>
            ) : (
              posts.map((post) => (
                <li key={post.id.toString()} className="p-4">
                  <form action={saveAdminPost} className="grid gap-3">
                    <input type="hidden" name="id" value={post.id.toString()} />
                    <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
                      <select name="boardId" defaultValue={post.boardId.toString()} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm">
                        {boards.map((board) => (
                          <option key={board.id.toString()} value={board.id.toString()}>
                            {board.name}
                          </option>
                        ))}
                      </select>
                      <input name="title" defaultValue={post.title} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm font-bold" />
                      <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
                        <input type="checkbox" name="isNotice" defaultChecked={post.isNotice} />
                        공지
                      </label>
                      <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
                        <input type="checkbox" name="isSecret" defaultChecked={post.isSecret} />
                        비밀
                      </label>
                    </div>
                    <textarea name="content" defaultValue={post.content} rows={3} className="rounded-md border border-neutral-200 px-3 py-2 text-sm" />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                      <span>
                        {post.board.name} / 조회 {post.viewCount} / {post.createdAt.toLocaleDateString('ko-KR')}
                      </span>
                      <div className="flex gap-2">
                        <button className="min-h-10 rounded-md border border-neutral-200 px-4 text-sm font-bold hover:bg-neutral-100">
                          저장
                        </button>
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
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold">미답변 상품문의</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {qnas.length === 0 ? (
              <li className="py-3 text-sm text-neutral-500">미답변 상품문의가 없습니다.</li>
            ) : (
              qnas.map((qna) => (
                <li key={qna.id.toString()} className="py-3">
                  <p className="line-clamp-1 text-sm font-bold">{qna.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {qna.product.name} / {qna.user?.name ?? '비회원'} / {qna.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{qna.content}</p>
                  <form action={answerProductQna} className="mt-3 grid gap-2">
                    <input type="hidden" name="qnaId" value={qna.id.toString()} />
                    <textarea name="answer" rows={3} placeholder="상품문의 답변" className="rounded-md border border-neutral-200 px-3 py-2 text-sm" required />
                    <button className="min-h-10 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
                      답변 저장
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold">미답변 1:1 문의</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {inquiries.length === 0 ? (
              <li className="py-3 text-sm text-neutral-500">미답변 1:1 문의가 없습니다.</li>
            ) : (
              inquiries.map((inquiry) => (
                <li key={inquiry.id.toString()} className="py-3">
                  <p className="line-clamp-1 text-sm font-bold">{inquiry.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {inquiry.email} / {inquiry.phone ?? '-'} / {inquiry.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{inquiry.content}</p>
                  <form action={answerInquiry} className="mt-3 grid gap-2">
                    <input type="hidden" name="inquiryId" value={inquiry.id.toString()} />
                    <textarea name="answer" rows={3} placeholder="1:1 문의 답변" className="rounded-md border border-neutral-200 px-3 py-2 text-sm" required />
                    <button className="min-h-10 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
                      답변 저장
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </section>
      </aside>
    </div>
  );
}
