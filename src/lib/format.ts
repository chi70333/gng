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

export function formatPhone(value: string | null | undefined): string {
  if (!value) return '-';

  const digits = value.replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value;
}
