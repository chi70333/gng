'use client';

import Link from 'next/link';
import { User } from 'lucide-react';

export default function HeaderAccountActions() {
  return (
    <Link
      href="/login"
      aria-label="로그인"
      className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
    >
      <User size={20} />
    </Link>
  );
}
