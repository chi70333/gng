const krw = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('ko-KR');

type DateValue = Date | string | number | null | undefined;
type DateTimePartType = Intl.DateTimeFormatPartTypes;

const KOREA_TIME_ZONE = 'Asia/Seoul';
const koreanDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function toValidDate(value: DateValue): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getKoreanDateTimeParts(date: Date): Record<DateTimePartType, string> {
  return koreanDateTime.formatToParts(date).reduce(
    (acc, part) => {
      acc[part.type] = part.value;
      return acc;
    },
    {} as Record<DateTimePartType, string>,
  );
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
  const parts = getKoreanDateTimeParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatKoreanDateTime(value: DateValue): string {
  const date = toValidDate(value);
  if (!date) return '-';
  const parts = getKoreanDateTimeParts(date);

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
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
