'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type ProgressState = 'idle' | 'running' | 'finishing';

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function shouldStartForAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  const current = `${window.location.pathname}${window.location.search}`;
  const next = `${url.pathname}${url.search}`;
  return current !== next;
}

function shouldStartForForm(form: HTMLFormElement): boolean {
  const method = (form.getAttribute('method') ?? 'get').toLowerCase();
  if (method !== 'get') return false;

  const action = form.getAttribute('action');
  if (action?.startsWith('javascript:')) return false;

  const url = new URL(form.action || window.location.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  return `${url.pathname}${url.search}` !== `${window.location.pathname}${window.location.search}`;
}

export default function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ProgressState>('idle');
  const [progress, setProgress] = useState(0);
  const routePendingRef = useRef(false);
  const fetchCountRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const routeFallbackTimerRef = useRef<number | null>(null);

  function clearTimers(): void {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (routeFallbackTimerRef.current) {
      window.clearTimeout(routeFallbackTimerRef.current);
      routeFallbackTimerRef.current = null;
    }
  }

  function start(): void {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }

    setState((current) => (current === 'idle' ? 'running' : current));
    setProgress((current) => (current < 8 ? 8 : current));

    if (!intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 92) return current;
          const step = current < 35 ? 8 : current < 70 ? 4 : 1.5;
          return Math.min(92, current + step);
        });
      }, 180);
    }
  }

  function finish(): void {
    if (routePendingRef.current || fetchCountRef.current > 0) return;

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState('finishing');
    setProgress(100);
    finishTimerRef.current = window.setTimeout(() => {
      setState('idle');
      setProgress(0);
      finishTimerRef.current = null;
    }, 260);
  }

  useEffect(() => {
    routePendingRef.current = false;
    if (routeFallbackTimerRef.current) {
      window.clearTimeout(routeFallbackTimerRef.current);
      routeFallbackTimerRef.current = null;
    }
    finish();
    // searchParams string is intentional: App Router returns a stable object per URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  useEffect(() => {
    function startRoute(): void {
      routePendingRef.current = true;
      start();
      if (routeFallbackTimerRef.current) {
        window.clearTimeout(routeFallbackTimerRef.current);
      }
      routeFallbackTimerRef.current = window.setTimeout(() => {
        routePendingRef.current = false;
        routeFallbackTimerRef.current = null;
        finish();
      }, 15000);
    }

    function handleClick(event: MouseEvent): void {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a');
      if (anchor instanceof HTMLAnchorElement && shouldStartForAnchor(anchor)) {
        startRoute();
      }
    }

    function handleSubmit(event: SubmitEvent): void {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (shouldStartForForm(form)) {
        startRoute();
      }
    }

    function handlePopState(): void {
      startRoute();
    }

    function handleStartEvent(): void {
      startRoute();
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      fetchCountRef.current += 1;
      start();

      try {
        return await originalFetch(...args);
      } finally {
        fetchCountRef.current = Math.max(0, fetchCountRef.current - 1);
        finish();
      }
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('gng:navigation-start', handleStartEvent);

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('gng:navigation-start', handleStartEvent);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'idle') return null;

  return (
    <div
      className="fixed left-0 top-0 z-[100] h-1 w-full bg-transparent"
      role="progressbar"
      aria-label="페이지 이동 진행 상태"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full bg-[#caaf7b] shadow-[0_0_12px_rgba(202,175,123,0.45)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: state === 'finishing' ? 0 : 1,
        }}
      />
    </div>
  );
}
