'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Coins, History, Loader2, Plus, X } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { FormattedNumberInput } from '@/components/ui/FormattedNumberInput';

type PointHistoryItem = {
  id: string;
  delta: number;
  balance: number;
  reason: string;
  createdAt: string;
};

type PointHistoryResponse = {
  items: PointHistoryItem[];
};

type Props = {
  userId: string;
  userName: string;
  initialBalance: number;
};

const DEFAULT_REASON = '관리자 마일리지 부여';
const QUICK_AMOUNTS = [1000, 3000, 5000, 10000];

type Message = {
  kind: 'success' | 'error';
  text: string;
};

function isPointHistoryItem(value: unknown): value is PointHistoryItem {
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

function isPointHistoryResponse(value: unknown): value is PointHistoryResponse {
  if (typeof value !== 'object' || value === null) return false;
  const items = (value as Record<string, unknown>).items;
  return Array.isArray(items) && items.every(isPointHistoryItem);
}

function responseMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const message = (value as Record<string, unknown>).message;
  return typeof message === 'string' ? message : null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function messageClassName(kind: Message['kind']): string {
  return kind === 'success' ? 'text-blue-700' : 'text-red-700';
}

export function AdminUserMileageAdjustButton({ userId, userName, initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [message, setMessage] = useState<Message | null>(null);
  const [history, setHistory] = useState<PointHistoryItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const endpoint = useMemo(() => `/api/admin/users/${userId}/points`, [userId]);
  const previewAmount = Number(amount);
  const hasValidPreview = Number.isInteger(previewAmount) && previewAmount > 0;
  const nextBalance = hasValidPreview ? balance + previewAmount : balance;

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function loadHistory() {
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const response = await fetch(`${endpoint}?limit=20`, { cache: 'no-store' });
        const data: unknown = await response.json();

        if (!response.ok || !isPointHistoryResponse(data)) {
          throw new Error(responseMessage(data) ?? '마일리지 부여 이력을 불러오지 못했습니다.');
        }

        if (!ignore) setHistory(data.items);
      } catch (error) {
        if (!ignore) {
          setHistoryError(
            error instanceof Error ? error.message : '마일리지 부여 이력을 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!ignore) setIsLoadingHistory(false);
      }
    }

    void loadHistory();

    return () => {
      ignore = true;
    };
  }, [endpoint, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeModal, isOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pointAmount = Number(amount);
    if (!Number.isInteger(pointAmount) || pointAmount < 1) {
      setMessage({ kind: 'error', text: '부여할 마일리지는 1 이상으로 입력해주세요.' });
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

      if (!response.ok || !isPointHistoryItem(data)) {
        throw new Error(responseMessage(data) ?? '마일리지 부여에 실패했습니다.');
      }

      setBalance(data.balance);
      setHistory((items) => [data, ...items.filter((item) => item.id !== data.id)].slice(0, 20));
      setAmount('');
      setReason(DEFAULT_REASON);
      setMessage({ kind: 'success', text: '마일리지를 부여했습니다.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '마일리지 부여에 실패했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setMessage(null);
        }}
        className="group inline-flex min-h-9 items-center justify-end gap-1.5 rounded-md border border-transparent bg-transparent px-1 text-right font-bold text-blue-700 underline decoration-blue-300 decoration-2 underline-offset-4 transition hover:border-blue-100 hover:bg-blue-50 hover:decoration-blue-700"
        aria-label={`${userName} 마일리지 부여 및 이력 보기`}
        title="마일리지 부여 및 이력 보기"
      >
        <span>마일리지</span>
        <span>{formatNumber(balance)} P</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`mileage-title-${userId}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg bg-white text-left shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-800 shadow-sm">
                  <Coins size={20} />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`mileage-title-${userId}`}
                    className="text-base font-extrabold text-neutral-950"
                  >
                    마일리지 부여
                  </h2>
                  <p className="mt-1 truncate text-sm font-semibold text-neutral-500">
                    {userName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                aria-label="마일리지 팝업 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-white p-3">
                <div>
                  <p className="text-xs font-bold text-neutral-500">현재 잔액</p>
                  <p className="mt-1 text-xl font-extrabold text-neutral-950">
                    {formatNumber(balance)} P
                  </p>
                </div>
                <div className="border-l border-neutral-100 pl-3">
                  <p className="text-xs font-bold text-neutral-500">적용 후</p>
                  <p className="mt-1 text-xl font-extrabold text-blue-700">
                    {formatNumber(nextBalance)} P
                  </p>
                </div>
              </div>

              <form
                onSubmit={onSubmit}
                className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
                  <label className="grid gap-1.5 text-sm font-bold text-neutral-700">
                    부여 마일리지
                    <FormattedNumberInput
                      name="amount"
                      min="1"
                      max="10000000"
                      value={amount}
                      onValueChange={setAmount}
                      placeholder="예: 1,000"
                      className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-base font-extrabold text-neutral-950 outline-none transition placeholder:text-sm placeholder:font-medium placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-neutral-700">
                    부여 사유
                    <input
                      name="reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 font-medium text-neutral-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <button
                      key={quickAmount}
                      type="button"
                      onClick={() => setAmount(String(quickAmount))}
                      className="min-h-9 rounded-md border border-neutral-200 bg-white px-2 text-xs font-extrabold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100"
                    >
                      {formatNumber(quickAmount)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t border-neutral-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-h-5">
                    {message ? (
                      <p
                        className={`flex items-center gap-1.5 text-sm font-bold ${messageClassName(
                          message.kind,
                        )}`}
                        role="status"
                      >
                        {message.kind === 'success' ? <CheckCircle2 size={16} /> : null}
                        {message.text}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                  >
                    {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
                    {isSaving ? '저장 중' : '마일리지 부여'}
                  </button>
                </div>
              </form>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-neutral-950">
                    <History size={16} className="text-neutral-500" />
                    최근 부여 이력
                  </h3>
                  <span className="text-xs font-semibold text-neutral-500">최대 20건</span>
                </div>

                <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  {isLoadingHistory ? (
                    <p className="px-4 py-6 text-center text-sm font-semibold text-neutral-500">
                      이력을 불러오는 중입니다.
                    </p>
                  ) : historyError ? (
                    <p className="px-4 py-6 text-center text-sm font-semibold text-red-700">
                      {historyError}
                    </p>
                  ) : history.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm font-semibold text-neutral-500">
                      부여된 마일리지 이력이 없습니다.
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <span className="font-mono text-xs font-semibold text-neutral-500">
                            {formatDateTime(item.createdAt)}
                          </span>
                          <span className="min-w-0 break-words font-semibold text-neutral-800">
                            {item.reason}
                          </span>
                          <span className="text-left font-extrabold text-blue-700 sm:text-right">
                            +{formatNumber(item.delta)} P
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
