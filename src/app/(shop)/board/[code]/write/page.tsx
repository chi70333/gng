// Legacy sources: board_write.php.
// Cache: no-cache. Public write form posts directly through a server action.

import type { Metadata } from 'next';
import { auth } from '@/server/auth';
import { savePostAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시글 작성',
  description: 'GNG 게시판에 글을 작성합니다.',
};

export default async function BoardWritePage({ params }: { params: { code: string } }) {
  const session = await auth();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">게시글 작성</h1>
      <form action={savePostAction} className="mt-5 grid gap-3 rounded-lg bg-white p-4">
        <input type="hidden" name="boardCode" value={params.code} />
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          작성자
          <input
            name="authorName"
            defaultValue={session?.user?.name ?? ''}
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
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            placeholder={session ? '수정용 비밀번호를 따로 둘 때만 입력' : '비회원 글 수정과 삭제에 필요'}
            required={!session}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          제목
          <input name="title" className="min-h-11 rounded-md border border-neutral-200 px-3" required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          내용
          <textarea name="content" rows={10} className="rounded-md border border-neutral-200 p-3" required />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="isSecret" className="h-4 w-4" />
          비밀글로 등록
        </label>
        <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
          등록
        </button>
      </form>
    </div>
  );
}
