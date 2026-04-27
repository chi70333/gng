const styles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  shipping: 'bg-sky-50 text-sky-700 ring-sky-200',
  preparing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  draft: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  hidden: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  dormant: 'bg-amber-50 text-amber-700 ring-amber-200',
  blocked: 'bg-rose-50 text-rose-700 ring-rose-200',
  withdrawn: 'bg-rose-50 text-rose-700 ring-rose-200',
  sold_out: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
  refunded: 'bg-rose-50 text-rose-700 ring-rose-200',
  ready: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
};

const labels: Record<string, string> = {
  active: '사용',
  inactive: '중지',
  paid: '결제완료',
  delivered: '배송완료',
  shipping: '배송중',
  preparing: '상품준비중',
  pending: '주문접수',
  draft: '임시저장',
  hidden: '숨김',
  dormant: '휴면',
  blocked: '차단',
  withdrawn: '탈퇴',
  sold_out: '품절',
  cancelled: '주문취소',
  refunded: '환불',
  ready: '배송대기',
};

export function AdminStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1 ${
        styles[status] ?? 'bg-neutral-100 text-neutral-700 ring-neutral-200'
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
