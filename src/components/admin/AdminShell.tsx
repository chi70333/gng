import Link from 'next/link';
import {
  Boxes,
  ClipboardList,
  FileText,
  Gauge,
  LogOut,
  Settings,
  TicketPercent,
  Tags,
  UsersRound,
} from 'lucide-react';
import { logoutAction } from '@/app/actions';
import type { CurrentAdmin } from '@/server/admin/auth';

const navItems = [
  { href: '/admin', label: '대시보드', icon: Gauge },
  { href: '/admin/products', label: '상품', icon: Boxes },
  { href: '/admin/orders', label: '주문', icon: ClipboardList },
  { href: '/admin/users', label: '회원', icon: UsersRound },
  { href: '/admin/categories', label: '카테고리', icon: Tags },
  { href: '/admin/coupons', label: '쿠폰', icon: TicketPercent },
  { href: '/admin/boards', label: '게시판', icon: FileText },
  { href: '/admin/settings', label: '설정', icon: Settings },
];

export function AdminShell({
  admin,
  children,
}: {
  admin: CurrentAdmin;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-neutral-200 bg-white lg:block">
        <div className="border-b border-neutral-100 px-5 py-5">
          <Link
            href="/admin"
            className="block text-lg font-extrabold hover:text-neutral-700"
            aria-label="관리자 대시보드로 이동"
          >
            GNG Admin
          </Link>
          <p className="mt-1 text-xs text-neutral-500">{admin.name}</p>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
            <Link href="/admin" className="text-base font-extrabold lg:hidden">
              GNG Admin
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-right text-xs text-neutral-500">
                <p className="font-semibold text-neutral-800">{admin.name}</p>
                <p>{admin.role}</p>
              </div>
              <form action={logoutAction}>
                <input type="hidden" name="callbackUrl" value="/admin/login" />
                <button
                  type="submit"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="로그아웃"
                >
                  <LogOut size={18} />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-screen-2xl px-4 py-5 pb-24 lg:px-6">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-neutral-200 bg-white lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-neutral-600"
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
