'use client';

import { useEffect, useState } from 'react';

type MemberSessionStatus = {
  isMember: boolean;
  isLoaded: boolean;
};

type SessionPayload = {
  user?: {
    userKind?: unknown;
  } | null;
} | null;

let memberSessionPromise: Promise<boolean> | null = null;

async function fetchMemberSession(): Promise<boolean> {
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) return false;

  const session = (await response.json()) as SessionPayload;
  return session?.user?.userKind === 'member';
}

function getMemberSessionPromise(): Promise<boolean> {
  memberSessionPromise ??= fetchMemberSession().catch(() => false);
  return memberSessionPromise;
}

export function useMemberSession(): MemberSessionStatus {
  const [status, setStatus] = useState<MemberSessionStatus>({
    isMember: false,
    isLoaded: false,
  });

  useEffect(() => {
    let active = true;

    getMemberSessionPromise().then((isMember) => {
      if (!active) return;
      setStatus({ isMember, isLoaded: true });
    });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
