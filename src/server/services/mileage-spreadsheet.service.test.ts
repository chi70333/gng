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
          '회원ID,아이디,이메일,마일리지,처리방식,사유',
          '12,member01,member01@example.com,"1,500",부여,행사 지급',
        ].join('\n'),
      ),
    );

    expect(result.skipped).toBe(0);
    expect(result.records).toEqual([
      {
        rowNumber: 2,
        userId: 12n,
        loginId: 'member01',
        email: 'member01@example.com',
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
          '<tr><td>회원ID</td><td>아이디</td><td>이메일</td><td>마일리지</td><td>처리방식</td><td>사유</td></tr>',
          '<tr><td>13</td><td>member02</td><td>member02@example.com</td><td></td><td>초기화</td><td></td></tr>',
          '</table></body></html>',
        ].join(''),
      ),
    );

    expect(result.skipped).toBe(0);
    expect(result.records[0]).toMatchObject({
      rowNumber: 2,
      userId: 13n,
      loginId: 'member02',
      email: 'member02@example.com',
      mode: 'reset',
      reason: '관리자 마일리지 엑셀 초기화',
    });
  });

  it('skips rows without a member identifier', () => {
    const result = parseMileageSpreadsheet(
      'mileage.csv',
      bufferFromText(['마일리지,처리방식', '1000,부여'].join('\n')),
    );

    expect(result.records).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('회원ID, 아이디, 이메일');
  });

  it('returns a user-facing error for unreadable Excel uploads', () => {
    const result = parseMileageSpreadsheet('mileage.xlsx', bufferFromText('not a zip file'));

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toBe(
      '업로드 파일을 읽지 못했습니다. 양식 파일을 다시 내려받아 작성해주세요.',
    );
  });
});
