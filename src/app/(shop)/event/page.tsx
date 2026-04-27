// Legacy sources: board_event_list.php?event=1.
// Cache: ISR 5m. Event board list uses the shared public board cache.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, PencilLine } from 'lucide-react';
import BoardList from '@/components/shop/BoardList';
import { NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getCachedBoardList } from '@/server/services/board.service';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '이벤트',
  description: 'GNG 이벤트 게시판입니다.',
};

export default async function EventPage() {
  const result = await getCachedBoardList('event', 50).catch((err: unknown) => {
    if (err instanceof NotFoundError) return null;

    logger.error({ err }, 'EventPage: getCachedBoardList failed');
    return null;
  });

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gift className="text-red-500" size={22} />
            <h1 className="text-xl font-bold text-neutral-900">이벤트</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            진행 중인 혜택과 특별 안내를 확인해 주세요.
          </p>
        </div>
        <Link
          href="/board/event/write"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md bg-neutral-900 px-3 text-sm font-bold text-white"
        >
          <PencilLine size={16} />
          글쓰기
        </Link>
      </div>
      <BoardList posts={result?.posts ?? []} emptyText="등록된 이벤트가 없습니다." />
    </div>
  );
}
