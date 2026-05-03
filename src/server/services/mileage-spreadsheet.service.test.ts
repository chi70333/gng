import { describe, expect, it } from 'vitest';
import { parseMileageSpreadsheet } from './mileage-spreadsheet.service';

function bufferFromText(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
}

describe('parseMileageSpreadsheet', () => {
  it('parses mileage grant rows from CSV uploads', () => {
    const result = parseMileageSpreadsheet(
      'mileage.csv',
      bufferFromText(
        [
          'ID,마일리지,처리방식,사유',
          'kakao-1231212412,"1,500",부여,행사 지급',
        ].join('\n'),
      ),
    );

    expect(result.skipped).toBe(0);
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

  it('parses reset rows from Excel-compatible HTML uploads', () => {
    const result = parseMileageSpreadsheet(
      'mileage.xls',
      bufferFromText(
        [
          '<html><body><table>',
          '<tr><td>ID</td><td>마일리지</td><td>처리방식</td><td>사유</td></tr>',
          '<tr><td>member02</td><td></td><td>초기화</td><td></td></tr>',
          '</table></body></html>',
        ].join(''),
      ),
    );

    expect(result.skipped).toBe(0);
    expect(result.records[0]).toMatchObject({
      rowNumber: 2,
      loginId: 'member02',
      mode: 'reset',
      reason: '관리자 마일리지 엑셀 초기화',
    });
  });

  it('parses rows identified by email when login ID is empty', () => {
    const result = parseMileageSpreadsheet(
      'mileage.csv',
      bufferFromText(
        [
          '이메일,마일리지,처리방식,사유',
          'member@example.com,1000,부여,이메일 기준 지급',
        ].join('\n'),
      ),
    );

    expect(result.skipped).toBe(0);
    expect(result.records[0]).toMatchObject({
      rowNumber: 2,
      email: 'member@example.com',
      amount: 1000,
      mode: 'grant',
      reason: '이메일 기준 지급',
    });
  });

  it('parses mileage uploads with more than 1000 data rows', () => {
    const rows = ['ID,마일리지,처리방식,사유'];
    for (let index = 1; index <= 1005; index += 1) {
      rows.push(`member${index},1000,부여,일괄 지급`);
    }

    const result = parseMileageSpreadsheet('mileage.csv', bufferFromText(rows.join('\n')));

    expect(result.skipped).toBe(0);
    expect(result.records).toHaveLength(1005);
    expect(result.records.at(-1)).toMatchObject({
      rowNumber: 1006,
      loginId: 'member1005',
      amount: 1000,
    });
  });

  it('does not skip rows because of an upload row limit', () => {
    const rows = ['ID,마일리지,처리방식,사유'];
    for (let index = 1; index <= 10001; index += 1) {
      rows.push(`member${index},1000,부여,일괄 지급`);
    }

    const result = parseMileageSpreadsheet('mileage.csv', bufferFromText(rows.join('\n')));

    expect(result.records).toHaveLength(10001);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips rows without a member identifier', () => {
    const result = parseMileageSpreadsheet(
      'mileage.csv',
      bufferFromText(['마일리지,처리방식', '1000,부여'].join('\n')),
    );

    expect(result.records).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('회원 식별자');
  });

  it('returns a user-facing error for unreadable Excel uploads', () => {
    const result = parseMileageSpreadsheet('mileage.xlsx', bufferFromText('not a zip file'));

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toBe(
      '업로드 파일을 읽지 못했습니다. 양식 파일을 다시 내려받아 작성해주세요.',
    );
  });
});
