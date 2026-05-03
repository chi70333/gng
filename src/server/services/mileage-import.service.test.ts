import { describe, expect, it } from 'vitest';
import { resolveMileageImportOperations } from './mileage-import.service';
import type { MileageUploadRecord } from './mileage-spreadsheet.service';

describe('resolveMileageImportOperations', () => {
  it('keeps duplicate grant rows for the same member as separate ledger operations', () => {
    const records: MileageUploadRecord[] = [
      {
        rowNumber: 2,
        loginId: 'member01',
        amount: 1000,
        mode: 'grant',
        reason: '첫 번째 지급',
      },
      {
        rowNumber: 3,
        loginId: 'member01',
        amount: 500,
        mode: 'grant',
        reason: '두 번째 지급',
      },
    ];

    const result = resolveMileageImportOperations(records, [
      {
        id: 10n,
        loginId: 'member01',
        email: 'member01@example.com',
        socialAccounts: [],
      },
    ]);

    expect(result.skipped).toBe(0);
    expect(result.operations).toHaveLength(2);
    expect(result.operations.map((operation) => operation.record.rowNumber)).toEqual([2, 3]);
    expect(result.operations.map((operation) => operation.record.amount)).toEqual([1000, 500]);
  });

  it('resolves social login IDs and email-only rows', () => {
    const records: MileageUploadRecord[] = [
      {
        rowNumber: 2,
        loginId: 'kakao-12345',
        amount: 1000,
        mode: 'grant',
        reason: '소셜 지급',
      },
      {
        rowNumber: 3,
        email: 'member02@example.com',
        amount: 700,
        mode: 'grant',
        reason: '이메일 지급',
      },
    ];

    const result = resolveMileageImportOperations(records, [
      {
        id: 20n,
        loginId: null,
        email: 'social@example.com',
        socialAccounts: [{ provider: 'kakao', providerUid: '12345' }],
      },
      {
        id: 30n,
        loginId: null,
        email: 'member02@example.com',
        socialAccounts: [],
      },
    ]);

    expect(result.skipped).toBe(0);
    expect(result.operations.map((operation) => operation.userId)).toEqual([20n, 30n]);
  });
});
