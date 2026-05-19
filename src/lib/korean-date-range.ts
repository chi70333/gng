const KOREA_TIME_ZONE = 'Asia/Seoul';

export type KoreanDateParts = {
  year: number;
  month: number;
  day: number;
};

const koreanDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getKoreanDateParts(date = new Date()): KoreanDateParts {
  const [year, month, day] = koreanDateFormatter.format(date).split('-').map(Number);
  return {
    year: year ?? 1970,
    month: month ?? 1,
    day: day ?? 1,
  };
}

export function getKoreanDateString(date = new Date()): string {
  return koreanDateFormatter.format(date);
}

export function koreanDateRangeUtc(parts: KoreanDateParts): {
  start: Date;
  endExclusive: Date;
} {
  return {
    start: new Date(Date.UTC(parts.year, parts.month - 1, parts.day, -9, 0, 0, 0)),
    endExclusive: new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, -9, 0, 0, 0)),
  };
}
