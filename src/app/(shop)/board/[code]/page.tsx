// Legacy sources: board_list.php?boardIndex=1, board_event_list.php?event=1.
// Cache: ISR 5m. Public board list uses cached DB access with board tags.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilLine } from 'lucide-react';
import BoardList from '@/components/shop/BoardList';
import { logger } from '@/lib/logger';
import { getCachedBoardList } from '@/server/services/board.service';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '게시판',
  description: 'GNG 게시판 글 목록입니다.',
};

export default async function BoardPage({ params }: { params: { code: string } }) {
  const result = await getCachedBoardList(params.code, 50).catch((err: unknown) => {
    logger.error({ err, code: params.code }, 'BoardPage: getCachedBoardList failed');
    return null;
  });
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{result.board.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">게시글과 댓글을 확인해 주세요.</p>
        </div>
        <Link
          href={`/board/${result.board.code}/write`}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md bg-neutral-900 px-3 text-sm font-bold text-white"
        >
          <PencilLine size={16} />
          글쓰기
        </Link>
      </div>
      <BoardList posts={result.posts} emptyText="등록된 게시글이 없습니다." />
    </div>
  );
}
