'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { formatNumber } from '@/lib/format';

export type AdminUserPointRow = {
  id: string;
  delta: number;
  balance: number;
  reason: string;
  createdAt: string;
};

type Props = {
  userId: string;
  initialBalance: number;
  initialPoints: AdminUserPointRow[];
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminUserPointsClient({ userId, initialBalance, initialPoints }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [points, setPoints] = useState(initialPoints);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const endpoint = useMemo(() => `/api/admin/users/${userId}/points`, [userId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason }),
      });
      const data = (await response.json()) as Partial<AdminUserPointRow> & { message?: string };

      if (!response.ok || typeof data.id !== 'string') {
        throw new Error(data.message ?? '포인트 저장에 실패했습니다.');
      }

      const nextPoint = {
        id: data.id,
        delta: data.delta ?? 0,
        balance: data.balance ?? balance,
        reason: data.reason ?? reason,
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      setBalance(nextPoint.balance);
      setPoints((current) => [nextPoint, ...current].slice(0, 20));
      setDelta('');
      setReason('');
      setMessage('포인트를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '포인트 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">포인트 이력</h2>
          <p className="mt-1 text-sm text-neutral-500">현재 {formatNumber(balance)}원</p>
        </div>
        {message ? <p className="text-sm font-bold text-blue-700">{message}</p> : null}
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
        <input
          name="delta"
          type="number"
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
          placeholder="예: 1000 또는 -1000"
          className="min-h-11 w-full rounded-md border border-neutral-200 px-3"
          required
        />
        <input
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="조정 사유"
          className="min-h-11 w-full rounded-md border border-neutral-200 px-3"
          required
        />
        <button
          type="submit"
          disabled={isSaving}
          className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? '저장 중' : '포인트 저장'}
        </button>
      </form>

      <ul className="mt-3 divide-y divide-neutral-100">
        {points.length === 0 ? (
          <li className="py-3 text-sm text-neutral-500">포인트 이력이 없습니다.</li>
        ) : (
          points.map((point) => (
            <li key={point.id} className="py-3 text-sm">
              <div className="flex justify-between gap-3">
                <p className="font-bold">{point.reason}</p>
                <p>{formatNumber(point.delta)}</p>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                잔액 {formatNumber(point.balance)} / {formatDateTime(point.createdAt)}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
