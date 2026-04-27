import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { BoardPostSummary } from '@/server/services/board.service';

type BoardListProps = {
  posts: BoardPostSummary[];
  emptyText: string;
};

export default function BoardList({ posts, emptyText }: BoardListProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg bg-white px-4 py-16 text-center text-sm text-neutral-500">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 rounded-lg bg-white">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/board/${post.boardCode}/${post.id}`} className="block px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
                  {post.isNotice ? <span className="shrink-0 text-red-600">공지</span> : null}
                  {post.isSecret ? (
                    <Lock size={14} className="shrink-0 text-neutral-400" aria-label="비밀글" />
                  ) : null}
                  <span className="line-clamp-1">{post.title}</span>
                  {post.commentCount > 0 ? (
                    <span className="shrink-0 text-xs text-neutral-400">({post.commentCount})</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {post.authorName} · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <span className="shrink-0 text-xs text-neutral-400">
                {post.viewCount.toLocaleString('ko-KR')}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
