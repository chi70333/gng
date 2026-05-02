import { describe, expect, it } from 'vitest';
import { parseMileageSpreadsheet } from '@/server/services/mileage-spreadsheet.service';
import { createXlsxWorkbook } from './xlsx';

describe('createXlsxWorkbook', () => {
  it('creates an XLSX workbook that the mileage parser can read', () => {
    const workbook = createXlsxWorkbook(
      [
        ['ID', '마일리지', '처리방식', '사유'],
        ['kakao-1231212412', '1500', '부여', '행사 지급'],
      ],
      '마일리지',
    );

    expect(workbook.subarray(0, 2).toString('utf8')).toBe('PK');

    const buffer = workbook.buffer.slice(
      workbook.byteOffset,
      workbook.byteOffset + workbook.byteLength,
    ) as ArrayBuffer;
    const result = parseMileageSpreadsheet('mileage.xlsx', buffer);

    expect(result.records).toEqual([
      {
        rowNumber: 2,
        loginId: 'kakao-1231212412',
        amount: 1500,
        mode: 'grant',
        reason: '행사 지급',
      },
    ]);
  });
});
