'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { adminSecondaryButtonClass } from '@/components/admin/AdminUI';

export function ApiMonitorRefreshControl({
  queriedAt,
  intervalMs = 30000,
}: {
  queriedAt: string;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-9 items-center rounded border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-600 shadow-sm">
        조회 {queriedAt}
      </span>
      <Link href="/admin/api-monitor" className={adminSecondaryButtonClass}>
        <RotateCcw size={18} />
        새로고침
      </Link>
    </div>
  );
}
