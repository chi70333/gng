// Legacy sources: faq.php, bbs_list.php.
// Cache: ISR 5m. Public FAQ list uses cached DB access.

import type { Metadata } from 'next';
import { CircleHelp } from 'lucide-react';
import BoardList from '@/components/shop/BoardList';
import { logger } from '@/lib/logger';
import { getCachedBoardPosts } from '@/server/services/board.service';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: 'GNG 자주 묻는 질문입니다.',
};

export default async function FaqPage() {
  const posts = await getCachedBoardPosts('faq', 50).catch((err: unknown) => {
    logger.error({ err }, 'FaqPage: getCachedBoardPosts failed');
    return [];
  });

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">자주 묻는 질문</h1>
          <p className="mt-1 text-sm text-neutral-500">궁금한 내용을 빠르게 확인해 주세요.</p>
        </div>
        <CircleHelp className="text-neutral-300" size={28} />
      </div>
      <BoardList posts={posts} emptyText="등록된 질문이 없습니다." />
    </div>
  );
}
