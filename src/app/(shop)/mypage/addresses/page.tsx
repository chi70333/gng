// Legacy sources: mypage_addrs.php, mypage_addrs_ok.php
// Cache: no-store. Address book is private member state.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { createAddressAction, deleteAddressAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '배송지 관리',
  description: '주문에 사용할 배송지를 등록하고 관리합니다.',
};

export default async function MyAddressesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/addresses');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          label: true,
          receiver: true,
          phone: true,
          zipCode: true,
          address1: true,
          address2: true,
          isDefault: true,
        },
      },
    },
  });
  if (!user) redirect('/login?callbackUrl=/mypage/addresses');

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">배송지 관리</h1>
      <p className="mt-1 text-sm text-neutral-500">최근 배송지는 최대 10개까지 보관됩니다.</p>

      <section className="mt-5 rounded-lg bg-white p-4">
        <h2 className="text-base font-bold text-neutral-900">새 배송지 등록</h2>
        <form action={createAddressAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">배송지명</span>
            <input
              name="label"
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">받는 분</span>
            <input
              name="receiver"
              required
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">연락처</span>
            <input
              name="phone"
              type="tel"
              required
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">우편번호</span>
            <input
              name="zipCode"
              required
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-neutral-700">주소</span>
            <input
              name="address1"
              required
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-neutral-700">상세주소</span>
            <input
              name="address2"
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700 md:col-span-2">
            <input name="isDefault" type="checkbox" />
            <span>기본 배송지로 설정합니다.</span>
          </label>
          <button
            type="submit"
            className="flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white md:col-span-2"
          >
            배송지 등록
          </button>
        </form>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-bold text-neutral-900">등록된 배송지</h2>
        {user.addresses.length === 0 ? (
          <div className="mt-3 rounded-lg bg-white p-8 text-center text-sm text-neutral-400">
            등록된 배송지가 없습니다.
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {user.addresses.map((address) => {
              const deleteAction = deleteAddressAction.bind(null, address.id.toString());
              return (
                <li key={address.id.toString()} className="rounded-lg bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-neutral-900">
                          {address.label || address.receiver}
                        </p>
                        {address.isDefault && (
                          <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-white">
                            기본
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-neutral-700">{address.receiver} / {address.phone}</p>
                      <p className="mt-1 text-neutral-500">
                        [{address.zipCode}] {address.address1} {address.address2 ?? ''}
                      </p>
                    </div>
                    <form action={deleteAction}>
                      <button
                        type="submit"
                        className="min-h-11 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-600"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
