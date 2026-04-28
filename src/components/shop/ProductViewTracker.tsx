'use client';

import { useEffect } from 'react';

type ProductViewTrackerProps = {
  slug: string;
};

const trackedProductViews = new Set<string>();

export default function ProductViewTracker({ slug }: ProductViewTrackerProps) {
  useEffect(() => {
    if (trackedProductViews.has(slug)) return;
    trackedProductViews.add(slug);

    const endpoint = `/api/goods/${encodeURIComponent(slug)}/view`;

    if (navigator.sendBeacon) {
      const payload = new Blob(['{}'], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, payload)) return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {
      // View counting is best-effort and must never interrupt product browsing.
    });
  }, [slug]);

  return null;
}
