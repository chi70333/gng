'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Coins, X } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { FormattedNumberInput } from '@/components/ui/FormattedNumberInput';

type PointResponse = {
  id: string;
  delta: number;
  balance: number;
  reason: string;
  createdAt: string;
};

type Props = {
  userId: string;
  userName: string;
  initialBalance: number;
};

function isPointResponse(value: unknown): value is PointResponse {
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

export function AdminUserMileageAdjustButton({ userId, userName, initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('관리자 마일리지 추가');
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const endpoint = useMemo(() => `/api/admin/users/${userId}/points`, [userId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pointAmount = Number(amount);
    if (!Number.isInteger(pointAmount) || pointAmount < 1) {
      setMessage('추가할 마일리지는 1 이상으로 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: pointAmount, reason }),
      });
      const data: unknown = await response.json();

      if (!response.ok || !isPointResponse(data)) {
        throw new Error(responseMessage(data) ?? '마일리지 추가에 실패했습니다.');
      }

      setBalance(data.balance);
      setAmount('');
      setReason('관리자 마일리지 추가');
      setMessage('마일리지를 추가했습니다.');
      setIsOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '마일리지 추가에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <span>{formatNumber(balance)}</span>
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setMessage(null);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          aria-label={`${userName} 마일리지 추가`}
          title="마일리지 추가"
        >
          <Coins size={17} />
        </button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`mileage-title-${userId}`}
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-5 text-left shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`mileage-title-${userId}`} className="text-base font-extrabold text-neutral-950">
                  마일리지 추가
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {userName} / 현재 {formatNumber(balance)}P
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                aria-label="마일리지 추가 팝업 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                추가 마일리지
                <FormattedNumberInput
                  name="amount"
                  min="1"
                  max="10000000"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="예: 1000"
                  className="min-h-11 rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                추가 사유
                <input
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-11 rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
                  required
                />
              </label>
              {message ? <p className="text-sm font-bold text-blue-700">{message}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-11 rounded-md border border-neutral-200 px-4 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {isSaving ? '저장 중' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
