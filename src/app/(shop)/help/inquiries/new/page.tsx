// Legacy sources: ask_write.php.
// Cache: no-cache. Inquiry writes are request scoped.

import type { Metadata } from 'next';
import { auth } from '@/server/auth';
import { saveInquiryAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '문의 작성',
  description: 'GNG 1:1 문의를 작성합니다.',
};

export default async function NewInquiryPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">1:1 문의 작성</h1>
      <form action={saveInquiryAction} className="mt-5 grid gap-3 rounded-lg bg-white p-4">
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          이름
          <input name="name" defaultValue={session?.user?.name ?? ''} className="min-h-11 rounded-md border border-neutral-200 px-3" required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          이메일
          <input name="email" type="email" defaultValue={session?.user?.email ?? ''} className="min-h-11 rounded-md border border-neutral-200 px-3" required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          연락처
          <input name="phone" className="min-h-11 rounded-md border border-neutral-200 px-3" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          비밀번호
          <input
            name="password"
            type="password"
            className="min-h-11 rounded-md border border-neutral-200 px-3"
            placeholder={session ? '비회원 확인용이 필요할 때만 입력' : '비회원 문의 확인에 필요'}
            required={!session}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          제목
          <input name="title" className="min-h-11 rounded-md border border-neutral-200 px-3" required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-neutral-700">
          문의 내용
          <textarea name="content" rows={10} className="rounded-md border border-neutral-200 p-3" required />
        </label>
        <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
          등록
        </button>
      </form>
    </div>
  );
}
