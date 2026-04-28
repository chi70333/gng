'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Coins, Save } from 'lucide-react';
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

type MessageState = {
  kind: 'success' | 'error';
  text: string;
} | null;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isPointRow(value: unknown): value is AdminUserPointRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.delta === 'number' &&
    typeof row.balance === 'number' &&
    typeof row.reason === 'string' &&
    typeof row.createdAt === 'string'
  );
}

function responseMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const message = (value as Record<string, unknown>).message;
  return typeof message === 'string' ? message : null;
}

function formatSignedNumber(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}`;
  return '0';
}

function deltaClassName(value: number): string {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-rose-700';
  return 'text-neutral-700';
}

export function AdminUserPointsClient({ userId, initialBalance, initialPoints }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [points, setPoints] = useState(initialPoints);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const endpoint = useMemo(() => `/api/admin/users/${userId}/points`, [userId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDelta = Number(delta);
    if (!Number.isInteger(nextDelta) || nextDelta === 0) {
      setMessage({ kind: 'error', text: '조정 금액은 0이 아닌 정수로 입력해 주세요.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason }),
      });
      const data: unknown = await response.json();

      if (!response.ok || !isPointRow(data)) {
        throw new Error(responseMessage(data) ?? '마일리지 저장에 실패했습니다.');
      }

      const nextPoint = {
        id: data.id,
        delta: data.delta,
        balance: data.balance,
        reason: data.reason,
        createdAt: data.createdAt,
      };
      setBalance(nextPoint.balance);
      setPoints((current) => [nextPoint, ...current].slice(0, 20));
      setDelta('');
      setReason('');
      setMessage({ kind: 'success', text: '마일리지를 저장했습니다.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '마일리지 저장에 실패했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="text-neutral-300" size={20} />
            <h2 className="text-base font-extrabold text-neutral-950">마일리지 내역</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-500">현재 잔액 {formatNumber(balance)} P</p>
        </div>
        {message ? (
          <p
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              message.kind === 'success' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
            }`}
            aria-live="polite"
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={onSubmit}
        className="grid gap-3 p-4 md:grid-cols-[180px_1fr_auto] md:items-end"
      >
        <label className="grid gap-1 text-sm font-bold text-neutral-700">
          조정 금액
          <input
            name="delta"
            type="number"
            value={delta}
            onChange={(event) => setDelta(event.target.value)}
            placeholder="예: 1000 또는 -1000"
            className="min-h-11 w-full rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-neutral-700">
          조정 사유
          <input
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: CS 보상 적립"
            className="min-h-11 w-full rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
            required
          />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
        >
          <Save size={16} />
          {isSaving ? '저장 중' : '저장'}
        </button>
      </form>

      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {points.length === 0 ? (
          <li className="p-4 text-sm text-neutral-500">마일리지 내역이 없습니다.</li>
        ) : (
          points.map((point) => (
            <li
              key={point.id}
              className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_120px_150px] sm:items-center"
            >
              <div className="min-w-0">
                <p className="break-words font-extrabold text-neutral-950">{point.reason}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatDateTime(point.createdAt)}</p>
              </div>
              <p className={`font-extrabold sm:text-right ${deltaClassName(point.delta)}`}>
                {formatSignedNumber(point.delta)}
              </p>
              <p className="text-xs font-bold text-neutral-500 sm:text-right">
                잔액 {formatNumber(point.balance)} P
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
