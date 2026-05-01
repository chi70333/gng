import { describe, expect, it } from 'vitest';
import {
  buildMigrationPlan,
  buildMemberDraft,
  buildPointLedger,
  buildSocialDraft,
  detectLegacyPasswordAlgo,
  normalizeEmail,
  normalizePhone,
  parseBackupText,
} from './legacy-member-migration-lib.mjs';

function backupFromRows(tables) {
  return {
    tables: {
      member: [],
      member_withdraw: [],
      social_member: [],
      member_addrs: [],
      point_table: [],
      ...tables,
    },
    meta: [],
  };
}

describe('legacy member migration helpers', () => {
  it('parses NDJSON row events into table buckets', () => {
    const backup = parseBackupText(
      [
        JSON.stringify({ type: 'meta', format: 'gng-legacy-member-ndjson' }),
        JSON.stringify({ type: 'row', table: 'member', data: { idx: '1', name: '홍길동' } }),
        JSON.stringify({ type: 'row', table: 'social_member', data: { uid: '9' } }),
        JSON.stringify({ type: 'complete', tables: { member: 1 } }),
      ].join('\n'),
    );

    expect(backup.tables.member).toEqual([{ idx: '1', name: '홍길동' }]);
    expect(backup.tables.social_member).toEqual([{ uid: '9' }]);
    expect(backup.meta).toHaveLength(2);
  });

  it('normalizes contact fields and detects supported legacy password hashes', () => {
    expect(normalizeEmail(' USER@Example.COM ')).toBe('user@example.com');
    expect(normalizeEmail('bad-email')).toBeUndefined();
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(detectLegacyPasswordAlgo('098f6bcd4621d373cade4e832627b4f6')).toEqual({
      hash: '098f6bcd4621d373cade4e832627b4f6',
      algo: 'md5',
      requiresReset: false,
    });
    expect(detectLegacyPasswordAlgo('not-a-supported-hash')).toEqual({
      hash: 'not-a-supported-hash',
      algo: undefined,
      requiresReset: true,
    });
  });

  it('builds active member drafts with legacy auth and fallback email', () => {
    const result = buildMemberDraft({
      idx: '7',
      userid: 'hong01',
      name: '홍길동',
      hand: '010-1111-2222',
      pwd: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
      point: '1200',
    });

    expect(result.draft).toEqual(
      expect.objectContaining({
        legacyMemberId: 7,
        loginId: 'hong01',
        email: 'hong01@legacy.local',
        phone: '01011112222',
        legacyPasswordAlgo: 'sha1',
        legacyPointBalance: 1200,
        status: 'active',
      }),
    );
  });

  it('anonymizes withdrawn members and skips their private related data', () => {
    const plan = buildMigrationPlan(
      backupFromRows({
        member: [{ idx: '3', userid: 'bye01', name: '기존 이름', email: 'bye@example.com' }],
        member_withdraw: [{ userid: 'bye01' }],
        member_addrs: [{ seq: '1', member_id: 'bye01', zip: '06234', address1: '서울' }],
        social_member: [{ uid: '2', member_id: 'bye01', provider: 'kakao', provider_uid: 'k1' }],
        point_table: [{ member_id: 'bye01', amount: '100' }],
      }),
    );

    expect(plan.members).toHaveLength(1);
    expect(plan.members[0].draft).toEqual(
      expect.objectContaining({
        loginId: null,
        email: 'withdrawn-3@legacy.local',
        name: '탈퇴 회원',
        status: 'withdrawn',
      }),
    );
    expect(plan.members[0].addresses).toEqual([]);
    expect(plan.members[0].socials).toEqual([]);
    expect(plan.members[0].points).toEqual([]);
  });

  it('skips members that conflict with existing unique user fields', () => {
    const plan = buildMigrationPlan(
      backupFromRows({
        member: [
          { idx: '1', userid: 'new01', email: 'new@example.com', name: '신규' },
          { idx: '2', userid: 'taken01', email: 'taken@example.com', name: '충돌' },
        ],
      }),
      [
        {
          id: 10n,
          legacyMemberId: null,
          loginId: 'taken01',
          email: 'other@example.com',
          phone: null,
        },
      ],
    );

    expect(plan.members.map((member) => member.draft.legacyMemberId)).toEqual([1]);
    expect(plan.report.skippedMembers).toEqual([
      expect.objectContaining({
        reason: 'existing_unique_conflict',
        legacyMemberId: 2,
        conflictUserId: '10',
      }),
    ]);
  });

  it('maps social accounts with env column overrides', () => {
    const memberByLegacyId = new Map([[1, {}]]);
    const memberByLoginId = new Map([['hong01', 1]]);
    const result = buildSocialDraft(
      { uid: '9', member_id: 'hong01', channel: 'K', social_key: '123456' },
      {
        LEGACY_MEMBER_SOCIAL_PROVIDER_COLUMN: 'channel',
        LEGACY_MEMBER_SOCIAL_PROVIDER_UID_COLUMN: 'social_key',
      },
      memberByLegacyId,
      memberByLoginId,
    );

    expect(result).toEqual({
      skipped: false,
      legacyMemberId: 1,
      social: {
        legacyUid: 9,
        provider: 'kakao',
        providerUid: '123456',
      },
    });
  });

  it('maps the legacy kakao social_member shape from grade and member_id', () => {
    const memberByLegacyId = new Map([[1, {}]]);
    const memberByLoginId = new Map([['kakao-123456', 1]]);
    const result = buildSocialDraft(
      { uid: '9', grade: 'kakao', member_id: 'kakao-123456' },
      {},
      memberByLegacyId,
      memberByLoginId,
    );

    expect(result).toEqual({
      skipped: false,
      legacyMemberId: 1,
      social: {
        legacyUid: 9,
        provider: 'kakao',
        providerUid: '123456',
      },
    });
  });

  it('creates point ledger entries and adjusts to the member snapshot', () => {
    const ledger = buildPointLedger(
      [
        { delta: 500, reason: '가입 적립', index: 0 },
        { delta: -100, reason: '상품 사용', index: 1 },
      ],
      450,
    );

    expect(ledger).toEqual([
      { delta: 500, balance: 500, reason: '가입 적립', createdAt: undefined },
      { delta: -100, balance: 400, reason: '상품 사용', createdAt: undefined },
      { delta: 50, balance: 450, reason: '레거시 포인트 잔액 보정', createdAt: undefined },
    ]);
  });

  it('attaches social, address, and point rows to active members', () => {
    const plan = buildMigrationPlan(
      backupFromRows({
        member: [{ idx: '11', userid: 'social01', email: 'social@example.com', name: '소셜' }],
        social_member: [
          { uid: '33', member_id: 'social01', provider: 'naver', provider_uid: 'n-1' },
        ],
        member_addrs: [
          {
            seq: '44',
            member_id: 'social01',
            name: '소셜',
            hand: '01022223333',
            zip: '06234',
            address1: '서울',
          },
        ],
        point_table: [{ member_id: 'social01', amount: '300', reason: '적립' }],
      }),
    );

    expect(plan.members[0].socials).toEqual([
      { legacyUid: 33, provider: 'naver', providerUid: 'n-1' },
    ]);
    expect(plan.members[0].addresses).toEqual([
      expect.objectContaining({ legacySeq: 44, zipCode: '06234', address1: '서울' }),
    ]);
    expect(plan.members[0].pointLedger).toEqual([
      { delta: 300, balance: 300, reason: '적립', createdAt: undefined },
    ]);
  });
});
