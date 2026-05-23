'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type HistoryItem = {
  id: string;
  delta: number;
  balance: number;
  reason: string;
  createdAt: string;
};

type LinkedLogItem = {
  id: string;
  service: string;
  userid: string;
  amount: string;
  reason: string;
  createdAt: string;
};

type SalesValidationStatusButtonProps = {
  label: string;
  className: string;
  memberName: string;
  linkedMileageUsed: string;
  orderMileageUsed: string;
  orderAmountTotal: string;
  histories: HistoryItem[];
  linkedLogs: LinkedLogItem[];
};

function formatNumber(value: string | number | bigint): string {
  const raw = String(value);
  if (!raw) return '0';
  const [integer, decimal] = raw.split('.');
  const formatted = BigInt(integer || '0').toLocaleString('ko-KR');
  return decimal && Number(decimal) > 0 ? `${formatted}.${decimal}` : formatted;
}

function signed(value: string | number | bigint): string {
  const raw = String(value);
  return `${raw.startsWith('-') ? '' : '+'}${formatNumber(raw)}`;
}

export function SalesValidationStatusButton({
  label,
  className,
  memberName,
  linkedMileageUsed,
  orderMileageUsed,
  orderAmountTotal,
  histories,
  linkedLogs,
}: SalesValidationStatusButtonProps) {
  const [open, setOpen] = useState(false);
  const mileageDiff = BigInt(linkedMileageUsed) - BigInt(orderMileageUsed);
  const paymentDiff = BigInt(linkedMileageUsed) - BigInt(orderAmountTotal.split('.')[0] || '0');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1 ${className}`}
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4">
          <section className="max-h-[92dvh] w-full overflow-hidden rounded-t-lg bg-white shadow-xl sm:max-w-3xl sm:rounded-lg">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-neutral-500">마일리지 변동내역</p>
                <h2 className="text-base font-extrabold text-neutral-950">{memberName}</h2>
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs font-bold text-neutral-500">연동마일리지사용</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-rose-700">
                    {formatNumber(linkedMileageUsed)}
                  </p>
                </div>
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs font-bold text-neutral-500">주문마일리지사용</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-rose-700">
                    {formatNumber(orderMileageUsed)}
                  </p>
                </div>
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
                  <p className="text-xs font-bold text-neutral-500">총결제금액</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-neutral-950">
                    {formatNumber(orderAmountTotal)}
                  </p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-bold text-amber-700">차액</p>
                  <p className="mt-1 font-mono text-base font-extrabold text-amber-800">
                    {signed(mileageDiff)}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-amber-700">
                    결제 {signed(paymentDiff)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section>
                  <h3 className="text-sm font-extrabold text-neutral-950">연동 로그</h3>
                  <div className="mt-2 grid gap-1.5">
                    {linkedLogs.length > 0 ? (
                      linkedLogs.map((log) => (
                        <div
                          key={log.id}
                          className="grid gap-1 rounded border border-amber-100 bg-amber-50/70 px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-xs font-extrabold text-amber-800">
                              +{formatNumber(log.amount)}
                            </span>
                            <span className="text-[11px] font-semibold uppercase text-amber-700">
                              {log.service}
                            </span>
                          </div>
                          <p className="break-all font-mono text-[11px] text-neutral-500">
                            {log.userid}
                          </p>
                          <p className="break-words text-xs font-semibold text-neutral-700">
                            {log.reason || '외부 연동'}
                          </p>
                          <p className="font-mono text-[11px] text-neutral-500">{log.createdAt}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded border border-neutral-100 bg-neutral-50 px-3 py-6 text-center text-xs font-semibold text-neutral-500">
                        매칭된 외부 연동 지급 로그가 없습니다.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-extrabold text-neutral-950">마일리지 변동</h3>
                  <div className="mt-2 grid gap-1.5">
                    {histories.length > 0 ? (
                      histories.map((history) => (
                        <div
                          key={history.id}
                          className="grid gap-1 rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={
                                history.delta >= 0
                                  ? 'font-mono text-xs font-extrabold text-emerald-700'
                                  : 'font-mono text-xs font-extrabold text-rose-700'
                              }
                            >
                              {history.delta >= 0 ? '+' : ''}
                              {formatNumber(history.delta)}
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-neutral-500">
                              잔액 {formatNumber(history.balance)}
                            </span>
                          </div>
                          <p className="break-words text-xs font-semibold text-neutral-700">
                            {history.reason}
                          </p>
                          <p className="font-mono text-[11px] text-neutral-500">
                            {history.createdAt}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded border border-neutral-100 bg-neutral-50 px-3 py-6 text-center text-xs font-semibold text-neutral-500">
                        표시할 마일리지 이력이 없습니다.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
