'use client';

import Link from 'next/link';
import { LogOut, User } from 'lucide-react';
import { useMemberSession } from '@/hooks/use-member-session';

type HeaderAccountActionsProps = {
  logoutAction: (formData: FormData) => Promise<void>;
};

export default function HeaderAccountActions({
  logoutAction,
}: HeaderAccountActionsProps) {
  const { isMember } = useMemberSession();

  return (
    <>
      <Link
        href={isMember ? '/mypage' : '/login'}
        aria-label={isMember ? '마이페이지' : '로그인'}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
      >
        <User size={20} />
      </Link>

      {isMember ? (
        <form action={logoutAction} className="hidden md:block">
          <input type="hidden" name="callbackUrl" value="/" />
          <button
            type="submit"
            aria-label="로그아웃"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
          >
            <LogOut size={20} />
          </button>
        </form>
      ) : null}
    </>
  );
}
