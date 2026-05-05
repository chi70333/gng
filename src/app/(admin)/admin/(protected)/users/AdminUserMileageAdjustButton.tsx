'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Coins, History, Loader2, Minus, Plus, RotateCcw, X } from 'lucide-react';
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

type PointDeleteResponse = {
  deletedId: string;
  balance: number;
};

type Props = {
  userId: string;
  userName: string;
  initialBalance: number;
};

const DEFAULT_REASON = '관리자 마일리지 부여';
const DEFAULT_RESET_REASON = '관리자 마일리지 초기화';
const RESET_CONFIRM_TEXT = '초기화';
const MAX_GRANT_AMOUNT = 10000000;
const QUICK_AMOUNTS = [10000, 30000, 50000, 100000];

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

function isPointDeleteResponse(value: unknown): value is PointDeleteResponse {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.deletedId === 'string' && typeof row.balance === 'number';
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

function formatSignedNumber(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}`;
  return '0';
}

function deltaClassName(value: number): string {
  if (value > 0) return 'text-blue-700';
  if (value < 0) return 'text-rose-700';
  return 'text-neutral-700';
}

export function AdminUserMileageAdjustButton({ userId, userName, initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [resetReason, setResetReason] = useState(DEFAULT_RESET_REASON);
  const [resetConfirm, setResetConfirm] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [history, setHistory] = useState<PointHistoryItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [deletingPointId, setDeletingPointId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const endpoint = useMemo(() => `/api/admin/users/${userId}/points`, [userId]);
  const previewAmount = Number(amount);
  const hasValidPreview = Number.isInteger(previewAmount) && previewAmount > 0;
  const nextBalance = hasValidPreview ? balance + previewAmount : balance;
  const canReset = resetConfirm.trim() === RESET_CONFIRM_TEXT;

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setMessage(null);
  }, []);

  const addQuickAmount = useCallback((quickAmount: number) => {
    setAmount((currentAmount) => {
      const current = Number(currentAmount) || 0;
      return String(Math.min(current + quickAmount, MAX_GRANT_AMOUNT));
    });
  }, []);

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal });
        const data: unknown = await response.json();

        if (!response.ok || !isPointHistoryResponse(data)) {
          throw new Error(responseMessage(data) ?? '마일리지 이력을 불러오지 못했습니다.');
        }

        setHistory(data.items);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHistoryError(
          error instanceof Error ? error.message : '마일리지 이력을 불러오지 못했습니다.',
        );
      } finally {
        if (!signal?.aborted) setIsLoadingHistory(false);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    void loadHistory(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isOpen, loadHistory]);

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
      setHistory((items) => [data, ...items.filter((item) => item.id !== data.id)]);
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

  async function onReset() {
    if (!canReset) {
      setMessage({ kind: 'error', text: '초기화하려면 확인란에 초기화를 입력해주세요.' });
      return;
    }
    if (resetReason.trim() === '') {
      setMessage({ kind: 'error', text: '초기화 사유를 입력해주세요.' });
      return;
    }

    setIsResetting(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'reset',
          reason: resetReason,
          confirm: resetConfirm.trim(),
        }),
      });
      const data: unknown = await response.json();

      if (!response.ok || !isPointHistoryItem(data)) {
        throw new Error(responseMessage(data) ?? '마일리지 초기화에 실패했습니다.');
      }

      setBalance(data.balance);
      setHistory((items) => [data, ...items.filter((item) => item.id !== data.id)]);
      setResetConfirm('');
      setResetReason(DEFAULT_RESET_REASON);
      setMessage({ kind: 'success', text: '마일리지를 초기화했습니다.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '마일리지 초기화에 실패했습니다.',
      });
    } finally {
      setIsResetting(false);
    }
  }

  async function onDeleteHistory(pointId: string) {
    const target = history.find((item) => item.id === pointId);
    if (!target) return;
    if (!window.confirm('이 마일리지 이력을 삭제할까요?')) return;

    setDeletingPointId(pointId);
    setMessage(null);

    try {
      const response = await fetch(`${endpoint}?pointId=${encodeURIComponent(pointId)}`, {
        method: 'DELETE',
      });
      const data: unknown = await response.json();

      if (!response.ok || !isPointDeleteResponse(data)) {
        throw new Error(responseMessage(data) ?? '마일리지 이력 삭제에 실패했습니다.');
      }

      setBalance(data.balance);
      setMessage({ kind: 'success', text: '마일리지 이력을 삭제했습니다.' });
      await loadHistory();
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : '마일리지 이력 삭제에 실패했습니다.',
      });
    } finally {
      setDeletingPointId(null);
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
        aria-label={`${userName} 마일리지 부여 및 전체 이력 보기`}
        title="마일리지 부여 및 전체 이력 보기"
      >
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
          <div className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-lg bg-white text-left shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-800 shadow-sm">
                  <Coins size={17} />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`mileage-title-${userId}`}
                    className="text-base font-extrabold text-neutral-950"
                  >
                    마일리지 관리
                  </h2>
                  <p className="mt-0.5 truncate text-xs font-semibold text-neutral-500">
                    {userName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                aria-label="마일리지 팝업 닫기"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto px-4 py-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)] lg:px-5">
              <div className="grid content-start gap-3">
                <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-200 bg-white p-3">
                  <div>
                    <p className="text-xs font-bold text-neutral-500">현재 잔액</p>
                    <p className="mt-1 text-xl font-extrabold text-neutral-950">
                      {formatNumber(balance)} P
                    </p>
                  </div>
                  <div className="border-l border-neutral-100 pl-3">
                    <p className="text-xs font-bold text-neutral-500">부여 적용 후</p>
                    <p className="mt-1 text-xl font-extrabold text-blue-700">
                      {formatNumber(nextBalance)} P
                    </p>
                  </div>
                </div>

                {message ? (
                  <p
                    className={`flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold ${
                      message.kind === 'success'
                        ? 'border-blue-100 bg-blue-50 text-blue-700'
                        : 'border-red-100 bg-red-50 text-red-700'
                    }`}
                    role="status"
                  >
                    {message.kind === 'success' ? <CheckCircle2 size={14} /> : null}
                    {message.text}
                  </p>
                ) : null}

                <form
                  onSubmit={onSubmit}
                  className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="grid gap-2.5">
                    <label className="grid gap-1 text-xs font-bold text-neutral-700">
                      부여 마일리지
                      <FormattedNumberInput
                        name="amount"
                        min="1"
                        max={MAX_GRANT_AMOUNT}
                        value={amount}
                        onValueChange={setAmount}
                        placeholder="예: 1,000"
                        className="h-10 rounded border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-950 outline-none transition placeholder:text-sm placeholder:font-medium placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-neutral-700">
                      부여 사유
                      <input
                        name="reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="h-10 rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {QUICK_AMOUNTS.map((quickAmount) => (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => addQuickAmount(quickAmount)}
                        className="h-9 rounded border border-neutral-200 bg-white px-2 text-xs font-bold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100"
                      >
                        +{formatNumber(quickAmount)}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded bg-neutral-900 px-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {isSaving ? '저장 중' : '마일리지 부여'}
                  </button>
                </form>

                <div className="grid gap-3 rounded-md border border-rose-200 bg-rose-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-rose-800">
                    <RotateCcw size={16} />
                    마일리지 초기화
                  </div>
                  <label className="grid gap-1 text-xs font-bold text-rose-900">
                    초기화 사유
                    <input
                      value={resetReason}
                      onChange={(event) => setResetReason(event.target.value)}
                      className="h-10 rounded border border-rose-200 bg-white px-3 text-sm font-medium text-neutral-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-rose-900">
                    확인 문구
                    <input
                      value={resetConfirm}
                      onChange={(event) => setResetConfirm(event.target.value)}
                      placeholder="초기화"
                      className="h-10 rounded border border-rose-200 bg-white px-3 text-sm font-medium text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onReset}
                    disabled={isResetting}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded bg-rose-700 px-3 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isResetting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    {isResetting ? '초기화 중' : '초기화'}
                  </button>
                </div>
              </div>

              <section className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-neutral-950">
                    <History size={15} className="text-neutral-500" />
                    전체 마일리지 이력
                  </h3>
                  <span className="text-xs font-semibold text-neutral-500">
                    {isLoadingHistory ? '불러오는 중' : `${formatNumber(history.length)}건`}
                  </span>
                </div>

                <div className="mt-2 max-h-[60dvh] overflow-auto rounded-md border border-neutral-200 bg-white lg:max-h-[calc(100dvh-12rem)]">
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
                      마일리지 이력이 없습니다.
                    </p>
                  ) : (
                    <div className="min-w-[680px] text-[13px]">
                      <div className="sticky top-0 z-10 grid grid-cols-[44px_132px_minmax(0,1fr)_112px_112px] border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-extrabold text-neutral-500">
                        <span aria-label="삭제" />
                        <span>일시</span>
                        <span>사유</span>
                        <span className="text-right">변동</span>
                        <span className="text-right">잔액</span>
                      </div>
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[44px_132px_minmax(0,1fr)_112px_112px] items-center border-b border-neutral-100 px-3 py-2.5 last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => void onDeleteHistory(item.id)}
                            disabled={deletingPointId === item.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
                            aria-label={`${formatDateTime(item.createdAt)} 마일리지 이력 삭제`}
                            title="이력 삭제"
                          >
                            {deletingPointId === item.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Minus size={15} />
                            )}
                          </button>
                          <span className="font-mono text-xs font-semibold text-neutral-500">
                            {formatDateTime(item.createdAt)}
                          </span>
                          <span className="min-w-0 break-words font-semibold text-neutral-800">
                            {item.reason}
                          </span>
                          <span
                            className={`text-left font-extrabold sm:text-right ${deltaClassName(
                              item.delta,
                            )}`}
                          >
                            {formatSignedNumber(item.delta)} P
                          </span>
                          <span className="text-right text-xs font-bold text-neutral-500">
                            {formatNumber(item.balance)} P
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
