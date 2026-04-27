const krw = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('ko-KR');

export function formatKRW(value: number | string | bigint): string {
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  return krw.format(n);
}

export function formatNumber(value: number | string | bigint): string {
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  return number.format(n);
}
