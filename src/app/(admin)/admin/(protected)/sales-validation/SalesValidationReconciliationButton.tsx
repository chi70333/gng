'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Search, X } from 'lucide-react';

type ReconciliationRow = {
  userid: string;
  linkedMileageUsed: string;
  matchedUserId: string | null;
  matchedName: string | null;
  matchedLoginId: string | null;
  matchedEmail: string | null;
  orderAmountTotal: string;
  paymentDiff: string;
  reason: string;
};

type ReconciliationResponse = {
  totals: {
    paymentDiffTotal: string;
    candidatePaymentDiffTotal: string;
    unmatchedLinkedMileageTotal: string;
    matchedWithoutPointHistoryTotal: string;
  };
  rows: ReconciliationRow[];
};

function formatNumber(value: string | number | bigint): string {
  const raw = String(value);
  if (!raw) return '0';
  const [integer, decimal] = raw.split('.');
  const formatted = BigInt(integer || '0').toLocaleString('ko-KR');
  return decimal && Number(decimal) > 0 ? `${formatted}.${decimal}` : formatted;
}

function signed(value: string): string {
  return `${value.startsWith('-') ? '' : '+'}${formatNumber(value)}`;
}

export function SalesValidationReconciliationButton({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/sales-validation/reconciliation?date=${date}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('차액추적 조회에 실패했습니다.');
      setData((await response.json()) as ReconciliationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : '차액추적 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-extrabold text-amber-900 shadow-sm transition hover:bg-amber-100"
      >
        <Search size={18} />
        차액추적 조회
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4">
          <section className="max-h-[92dvh] w-full overflow-hidden rounded-t-lg bg-white shadow-xl sm:max-w-5xl sm:rounded-lg">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-neutral-500">{date}</p>
                <h2 className="text-base font-extrabold text-neutral-950">차액추적</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92dvh-62px)] overflow-auto p-4">
              {loading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-bold text-neutral-600">
                  <Loader2 size={18} className="animate-spin" />
                  조회 중
                </div>
              ) : null}

              {error ? (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                  <AlertTriangle size={17} />
                  {error}
                </div>
              ) : null}

              {data ? (
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-md border border-neutral-200 p-3">
                      <p className="text-xs font-bold text-neutral-500">전체 결제차액</p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-amber-700">
                        {signed(data.totals.paymentDiffTotal)}
                      </p>
                    </div>
                    <div className="rounded-md border border-neutral-200 p-3">
                      <p className="text-xs font-bold text-neutral-500">회원별 표시 차액</p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-neutral-950">
                        {signed(data.totals.candidatePaymentDiffTotal)}
                      </p>
                    </div>
                    <div className="rounded-md border border-neutral-200 p-3">
                      <p className="text-xs font-bold text-neutral-500">회원매칭 없는 연동액</p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-rose-700">
                        {formatNumber(data.totals.unmatchedLinkedMileageTotal)}
                      </p>
                    </div>
                    <div className="rounded-md border border-neutral-200 p-3">
                      <p className="text-xs font-bold text-neutral-500">포인트이력 없는 연동액</p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-blue-700">
                        {formatNumber(data.totals.matchedWithoutPointHistoryTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-neutral-200">
                    <table className="min-w-[940px] w-full divide-y divide-neutral-200 text-sm">
                      <thead className="bg-neutral-50 text-xs font-extrabold text-neutral-500">
                        <tr>
                          <th className="px-3 py-2 text-left">구분</th>
                          <th className="px-3 py-2 text-left">연동 userid</th>
                          <th className="px-3 py-2 text-left">매칭회원</th>
                          <th className="px-3 py-2 text-right">연동마일리지</th>
                          <th className="px-3 py-2 text-right">총결제금액</th>
                          <th className="px-3 py-2 text-right">차액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {data.rows.length > 0 ? (
                          data.rows.map((row) => (
                            <tr key={`${row.reason}-${row.userid}`} className="align-top">
                              <td className="px-3 py-2 font-extrabold text-amber-700">
                                {row.reason}
                              </td>
                              <td className="px-3 py-2 font-mono">{row.userid || '-'}</td>
                              <td className="px-3 py-2">
                                {row.matchedUserId ? (
                                  <div className="grid gap-0.5">
                                    <span className="font-extrabold text-neutral-950">
                                      {row.matchedName ?? '-'}
                                    </span>
                                    <span className="font-mono text-xs text-neutral-500">
                                      {row.matchedLoginId ?? row.matchedEmail ?? row.matchedUserId}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-rose-700">매칭 없음</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">
                                {formatNumber(row.linkedMileageUsed)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold">
                                {formatNumber(row.orderAmountTotal)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-extrabold text-amber-700">
                                {signed(row.paymentDiff)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-8 text-center font-bold text-neutral-500" colSpan={6}>
                              추가로 추적할 차액 후보가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
