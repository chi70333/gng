'use client';

import { useEffect } from 'react';

export function OrderDetailScrollTop({ orderNo }: { orderNo: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [orderNo]);

  return null;
}
