// Legacy sources: notice.php, bbs_list.php.
// Cache: ISR 5m. Public notice list uses cached DB access.

import type { Metadata } from 'next';
import { Megaphone } from 'lucide-react';
import BoardList from '@/components/shop/BoardList';
import { logger } from '@/lib/logger';
import { getCachedBoardPosts } from '@/server/services/board.service';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '공지사항',
  description: 'GNG 공지사항입니다.',
};

export default async function NoticePage() {
  const posts = await getCachedBoardPosts('notice', 50).catch((err: unknown) => {
    logger.error({ err }, 'NoticePage: getCachedBoardPosts failed');
    return [];
  });

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">공지사항</h1>
          <p className="mt-1 text-sm text-neutral-500">GNG 쇼핑몰 안내입니다.</p>
        </div>
        <Megaphone className="text-neutral-300" size={28} />
      </div>
      <BoardList posts={posts} emptyText="등록된 공지사항이 없습니다." />
    </div>
  );
}
