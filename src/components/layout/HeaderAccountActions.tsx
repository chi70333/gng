'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';
import { useMemberSession } from '@/hooks/use-member-session';

export default function HeaderAccountActions() {
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
        <form
          className="hidden md:block"
          onSubmit={(event) => {
            event.preventDefault();
            void signOut({ callbackUrl: '/' });
          }}
        >
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
