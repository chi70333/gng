// Legacy sources: mypage_addrs.php, mypage_addrs_ok.php
// Cache: no-store. Address book is private member state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { AddressBookModal } from './AddressBookModal';

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
      <Link
        href="/mypage"
        className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700"
        aria-label="마이페이지로 돌아가기"
      >
        <ChevronLeft aria-hidden="true" size={18} />
        마이페이지
      </Link>

      <h1 className="text-xl font-bold text-neutral-900">배송지 관리</h1>
      <p className="mt-1 text-sm text-neutral-500">
        팝업에서 주문에 사용할 배송지를 등록하고 관리할 수 있습니다.
      </p>

      <AddressBookModal
        initialAddresses={user.addresses.map((address) => ({
          ...address,
          id: address.id.toString(),
        }))}
        initiallyOpen
      />
    </div>
  );
}
