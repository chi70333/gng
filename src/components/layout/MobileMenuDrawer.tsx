'use client';

// Mobile-only slide drawer. Touch targets stay at least 44px for 360px viewports.

import { useState } from 'react';
import Link from 'next/link';
import { X, Menu } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SerializedCategory } from '@/server/repositories/category.repository';

type MobileMenuDrawerProps = {
  categories: SerializedCategory[];
  isAuthenticated: boolean;
  logoutAction: (formData: FormData) => Promise<void>;
};

export default function MobileMenuDrawer({
  categories,
  isAuthenticated,
  logoutAction,
}: MobileMenuDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200 md:hidden"
        aria-label="메뉴 열기"
        aria-expanded={open}
      >
        <Menu size={22} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="모바일 메뉴"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center text-lg font-bold text-neutral-900"
            aria-label="홈으로 이동"
          >
            GNG
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
            aria-label="메뉴 닫기"
          >
            <X size={20} />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-2">
          {categories.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-400">
              카테고리가 없습니다.
            </li>
          )}
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/category/${category.slug}`}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
              >
                {category.name}
              </Link>
              {category.children.length > 0 && (
                <ul>
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/category/${child.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex min-h-[40px] items-center pl-8 pr-4 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        <div className="shrink-0 space-y-1 border-t px-4 py-4">
          <Link
            href={isAuthenticated ? '/mypage' : '/login'}
            onClick={() => setOpen(false)}
            className="flex h-11 items-center text-sm text-neutral-700 hover:text-neutral-900"
          >
            {isAuthenticated ? '마이페이지' : '로그인'}
          </Link>
          {isAuthenticated ? (
            <form action={logoutAction}>
              <input type="hidden" name="callbackUrl" value="/" />
              <button
                type="submit"
                className="flex h-11 w-full items-center text-left text-sm text-neutral-700 hover:text-neutral-900"
              >
                로그아웃
              </button>
            </form>
          ) : (
            <Link
              href="/join"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center text-sm text-neutral-700 hover:text-neutral-900"
            >
              회원가입
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
