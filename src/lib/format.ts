const krw = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('ko-KR');

type DateValue = Date | string | number | null | undefined;

function toValidDate(value: DateValue): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatKRW(value: number | string | bigint): string {
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  return krw.format(n);
}

export function formatNumber(value: number | string | bigint): string {
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  return number.format(n);
}

export function formatKoreanDate(value: DateValue): string {
  const date = toValidDate(value);
  if (!date) return '-';

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

export function formatKoreanDateTime(value: DateValue): string {
  const date = toValidDate(value);
  if (!date) return '-';

  return `${formatKoreanDate(date)} ${[
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
    padDatePart(date.getSeconds()),
  ].join(':')}`;
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
