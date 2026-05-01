import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const memberBackupTables = [
  'member',
  'member_withdraw',
  'social_member',
  'member_addrs',
  'point_table',
];

const generatedEmailDomain = 'legacy.local';
const legacyPointReasonPrefix = '레거시 포인트';

function compact(value) {
  if (value == null) return undefined;
  const normalized = String(value)
    .replace(/\u0000/g, '')
    .trim();
  return normalized === '' ? undefined : normalized;
}

function compactLower(value) {
  return compact(value)?.toLowerCase();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function rowValue(row, key) {
  if (!key) return undefined;
  if (hasOwn(row, key)) return compact(row[key]);
  const match = Object.keys(row).find((rowKey) => rowKey.toLowerCase() === key.toLowerCase());
  return match ? compact(row[match]) : undefined;
}

function firstValue(row, aliases, override) {
  const candidates = [override, ...aliases].filter(Boolean);
  for (const candidate of candidates) {
    const value = rowValue(row, candidate);
    if (value != null) return value;
  }
  return undefined;
}

function toInteger(value) {
  const normalized = compact(value)?.replace(/[^\d-]/g, '');
  if (!normalized || normalized === '-') return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function toPointInteger(value) {
  const normalized = compact(value)?.replace(/,/g, '');
  if (!normalized) return undefined;
  const parsed = Number.parseInt(normalized.replace(/[^\d-]/g, ''), 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function isZeroDate(value) {
  const normalized = compact(value);
  return !normalized || /^0{4}[-/.]?0{2}[-/.]?0{2}/.test(normalized);
}

export function parseLegacyDate(value) {
  const normalized = compact(value);
  if (!normalized || isZeroDate(normalized)) return undefined;

  const numeric = normalized.replace(/[^\d]/g, '');
  if (/^\d{8}$/.test(numeric)) {
    const year = numeric.slice(0, 4);
    const month = numeric.slice(4, 6);
    const day = numeric.slice(6, 8);
    const date = new Date(`${year}-${month}-${day}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const spaced = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(spaced) ? spaced : `${spaced}+09:00`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizePhone(phone) {
  const normalized = compact(phone)?.replace(/[^0-9]/g, '');
  return normalized || undefined;
}

export function normalizeEmail(email) {
  const normalized = compactLower(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return undefined;
  return normalized;
}

export function detectLegacyPasswordAlgo(hash) {
  const normalized = compact(hash);
  if (!normalized) return { hash: undefined, algo: undefined, requiresReset: false };
  if (/^[a-f0-9]{32}$/i.test(normalized)) {
    return { hash: normalized.toLowerCase(), algo: 'md5', requiresReset: false };
  }
  if (/^[a-f0-9]{40}$/i.test(normalized)) {
    return { hash: normalized.toLowerCase(), algo: 'sha1', requiresReset: false };
  }
  return { hash: normalized, algo: undefined, requiresReset: true };
}

export function normalizeProvider(value) {
  const normalized = compactLower(value);
  if (!normalized) return undefined;
  if (normalized.includes('kakao') || normalized === 'ka' || normalized === 'k') return 'kakao';
  if (normalized.includes('naver') || normalized === 'nv' || normalized === 'n') return 'naver';
  return undefined;
}

function normalizeGender(value) {
  const normalized = compactLower(value);
  if (!normalized) return undefined;
  if (['m', 'male', 'man', '1', '남', '남자'].includes(normalized)) return 'M';
  if (['f', 'female', 'woman', '2', '여', '여자'].includes(normalized)) return 'F';
  return 'X';
}

function isTruthyLegacy(value) {
  const normalized = compactLower(value);
  return normalized === 'y' || normalized === 'yes' || normalized === '1' || normalized === 'true';
}

function syntheticEmail(legacyMemberId, loginId, prefix = 'legacy') {
  const localPart = (loginId ?? `${prefix}-${legacyMemberId}`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${localPart || `${prefix}-${legacyMemberId}`}@${generatedEmailDomain}`;
}

function dateFromFields(row, aliases) {
  for (const alias of aliases) {
    const date = parseLegacyDate(rowValue(row, alias));
    if (date) return date;
  }
  return undefined;
}

function pickLegacyMemberId(row) {
  return toInteger(firstValue(row, ['idx', 'member_idx', 'member_no', 'midx', 'seq']));
}

function pickMemberLoginId(row) {
  return firstValue(row, ['userid', 'user_id', 'loginid', 'login_id', 'member_id', 'mb_id']);
}

function pickRelatedMemberReference(row) {
  return {
    legacyMemberId: toInteger(
      firstValue(row, ['member_idx', 'member_no', 'member_seq', 'midx', 'user_idx']),
    ),
    loginId: firstValue(row, ['userid', 'user_id', 'loginid', 'login_id', 'member_id', 'mb_id']),
  };
}

function stripProviderPrefix(provider, providerUid) {
  const normalized = compact(providerUid);
  if (!provider || !normalized) return normalized;
  const prefixPattern = new RegExp(`^${provider}[-_:]`, 'i');
  return normalized.replace(prefixPattern, '');
}

function memberTypeFrom(row) {
  return firstValue(row, ['part', 'member_type', 'type']) ?? 'M';
}

function isWithdrawnMember(row, withdrawnRefs, legacyMemberId, loginId) {
  if (withdrawnRefs.legacyMemberIds.has(legacyMemberId)) return true;
  if (loginId && withdrawnRefs.loginIds.has(loginId)) return true;
  if (dateFromFields(row, ['mb_leave_date', 'leave_date', 'withdraw_date', 'withdrawn_at']))
    return true;
  const part = compactLower(firstValue(row, ['part', 'member_type', 'status']));
  return part === 'w' || part === 'withdrawn' || part === '탈퇴';
}

function memberStatusFrom(row, withdrawnRefs, legacyMemberId, loginId) {
  if (isWithdrawnMember(row, withdrawnRefs, legacyMemberId, loginId)) return 'withdrawn';
  const blocked = compactLower(firstValue(row, ['bDeal', 'blocked', 'block_yn', 'is_blocked']));
  if (blocked === '1' || blocked === 'y' || blocked === 'true') return 'blocked';
  const part = compactLower(firstValue(row, ['part', 'member_type', 'status']));
  if (part === 'b' || part === 'blocked' || part === '차단') return 'blocked';
  return 'active';
}

function buildBusinessProfile(row) {
  const profile = {
    companyName: firstValue(row, ['companyname', 'company_name', 'company']),
    ceoName: firstValue(row, ['ceoname', 'ceo_name']),
    businessType: firstValue(row, ['upjongtype', 'business_type']),
    businessItem: firstValue(row, ['jongmok', 'business_item']),
    businessNumber: firstValue(row, ['ceonum', 'business_number']),
    zipCode: firstValue(row, ['ceo_zip', 'business_zip', 'business_zipcode']),
    address1: firstValue(row, ['ceo_address1', 'business_address1']),
    address2: firstValue(row, ['ceo_address2', 'business_address2']),
  };
  return Object.values(profile).some(Boolean) ? profile : undefined;
}

function buildRefundAccount(row) {
  const bankName = firstValue(row, ['refund_bank', 'bank_name', 'bank']);
  const accountHolder = firstValue(row, ['refund_name', 'account_holder']);
  const accountNumber = firstValue(row, ['refund_account', 'account_number']);
  if (!bankName || !accountHolder || !accountNumber) return undefined;
  return { bankName, accountHolder, accountNumber };
}

function buildDefaultAddress(row, legacyMemberId, loginId, name, phone) {
  const zipCode = firstValue(row, ['zip', 'zipcode', 'post', 'postcode']);
  const address1 = firstValue(row, ['address1', 'addr1', 'address', 'addr']);
  const address2 = firstValue(row, ['address2', 'addr2', 'address_detail']);
  if (!zipCode || !address1) return undefined;
  return {
    legacyMemberId: `member:${legacyMemberId}`,
    label: '기본 배송지',
    receiver: name,
    phone: phone ?? '',
    zipCode,
    address1,
    address2: address2 ?? null,
    isDefault: true,
    sourceLoginId: loginId,
  };
}

export function buildMemberDraft(row, withdrawnRefs = emptyWithdrawnRefs()) {
  const legacyMemberId = pickLegacyMemberId(row);
  if (!legacyMemberId) return { skipped: true, reason: 'missing_legacy_member_id' };

  const loginId = pickMemberLoginId(row);
  const status = memberStatusFrom(row, withdrawnRefs, legacyMemberId, loginId);
  if (status === 'withdrawn') {
    return {
      skipped: false,
      requiresReset: false,
      draft: {
        legacyMemberId,
        loginId: null,
        email: `withdrawn-${legacyMemberId}@${generatedEmailDomain}`,
        phone: null,
        name: '탈퇴 회원',
        nickname: null,
        birth: null,
        gender: null,
        passwordHash: null,
        legacyPasswordHash: null,
        legacyPasswordAlgo: null,
        status: 'withdrawn',
        memberType: memberTypeFrom(row),
        marketingAgreedAt: null,
        smsAgreedAt: null,
        legacyPointBalance: null,
        lastLoginAt: null,
        lastLoginIp: null,
        loginCount: 0,
        createdAt: dateFromFields(row, ['regdate', 'reg_date', 'wdate', 'created_at']),
      },
      defaultAddress: undefined,
      businessProfile: undefined,
      refundAccount: undefined,
    };
  }

  const name = firstValue(row, ['name', 'username', 'user_name', 'member_name']) ?? '레거시 회원';
  const phone = normalizePhone(firstValue(row, ['hand', 'hp', 'phone', 'mobile', 'tel']));
  const email =
    normalizeEmail(firstValue(row, ['email', 'mail', 'email_addr'])) ??
    syntheticEmail(legacyMemberId, loginId);
  const password = detectLegacyPasswordAlgo(
    firstValue(row, ['pwd', 'password', 'passwd', 'userpwd']),
  );
  const createdAt = dateFromFields(row, [
    'regdate',
    'reg_date',
    'wdate',
    'join_date',
    'created_at',
  ]);

  const draft = {
    legacyMemberId,
    loginId: loginId ?? null,
    email,
    phone: phone ?? null,
    name,
    nickname: firstValue(row, ['nickname', 'nick']) ?? null,
    birth: dateFromFields(row, ['birth', 'birthday', 'birthdate']) ?? null,
    gender: normalizeGender(firstValue(row, ['sex', 'gender'])) ?? null,
    passwordHash: null,
    legacyPasswordHash: password.hash ?? null,
    legacyPasswordAlgo: password.algo ?? null,
    status,
    memberType: memberTypeFrom(row),
    marketingAgreedAt: isTruthyLegacy(firstValue(row, ['bMail', 'mail_ok', 'email_yn']))
      ? (createdAt ?? new Date())
      : null,
    smsAgreedAt: isTruthyLegacy(firstValue(row, ['bSms', 'sms_ok', 'sms_yn']))
      ? (createdAt ?? new Date())
      : null,
    legacyPointBalance: toPointInteger(firstValue(row, ['point', 'mileage', 'emoney'])) ?? null,
    lastLoginAt: dateFromFields(row, ['nearDay', 'last_login', 'lastlogin', 'login_date']) ?? null,
    lastLoginIp: firstValue(row, ['login_ip', 'last_ip', 'ip']) ?? null,
    loginCount: toInteger(firstValue(row, ['login_count', 'logincnt', 'cnt_login'])) ?? 0,
    createdAt,
  };

  return {
    skipped: false,
    requiresReset: password.requiresReset,
    draft,
    defaultAddress: buildDefaultAddress(row, legacyMemberId, loginId, name, phone),
    businessProfile: buildBusinessProfile(row),
    refundAccount: buildRefundAccount(row),
  };
}

function emptyWithdrawnRefs() {
  return {
    legacyMemberIds: new Set(),
    loginIds: new Set(),
  };
}

function buildWithdrawnRefs(rows) {
  const refs = emptyWithdrawnRefs();
  for (const row of rows) {
    const id = toInteger(
      firstValue(row, [
        'legacyMemberId',
        'member_idx',
        'member_no',
        'member_seq',
        'midx',
        'user_idx',
      ]),
    );
    const loginId = firstValue(row, [
      'userid',
      'user_id',
      'loginid',
      'login_id',
      'member_id',
      'mb_id',
    ]);
    if (id) refs.legacyMemberIds.add(id);
    if (loginId) refs.loginIds.add(loginId);
  }
  return refs;
}

function resolveLegacyMemberId(reference, memberByLegacyId, memberByLoginId) {
  if (reference.legacyMemberId && memberByLegacyId.has(reference.legacyMemberId)) {
    return reference.legacyMemberId;
  }
  if (reference.loginId) return memberByLoginId.get(reference.loginId);
  return undefined;
}

function buildAddressDraft(row, memberByLegacyId, memberByLoginId) {
  const reference = pickRelatedMemberReference(row);
  const legacyMemberId = resolveLegacyMemberId(reference, memberByLegacyId, memberByLoginId);
  const legacySeq = toInteger(firstValue(row, ['seq', 'idx', 'uid', 'no']));
  const zipCode = firstValue(row, ['zip', 'zipcode', 'post', 'postcode', 'addr_zonecode']);
  const address1 = firstValue(row, ['address1', 'addr1', 'address', 'addr', 'addr_addr01']);
  if (!legacyMemberId || !legacySeq || !zipCode || !address1) {
    return {
      skipped: true,
      reason: !legacyMemberId
        ? 'orphan_address'
        : !legacySeq
          ? 'missing_legacy_seq'
          : 'missing_address',
      row,
    };
  }

  return {
    skipped: false,
    legacyMemberId,
    address: {
      legacySeq,
      legacyMemberId: reference.loginId ?? String(reference.legacyMemberId ?? legacyMemberId),
      label: firstValue(row, ['title', 'label', 'subject', 'addr_name']) ?? '배송지',
      receiver:
        firstValue(row, ['name', 'receiver', 'rname', 'recipient', 'addr_name']) ?? '수령인',
      phone:
        normalizePhone(
          firstValue(row, ['hand', 'hp', 'phone', 'mobile', 'tel', 'addr_phone1', 'addr_phone2']),
        ) ?? '',
      zipCode,
      address1,
      address2: firstValue(row, ['address2', 'addr2', 'address_detail', 'addr_addr02']) ?? null,
      isDefault: isTruthyLegacy(firstValue(row, ['default_yn', 'is_default', 'basic', 'bdefault'])),
    },
  };
}

function providerFromSpecificUid(row) {
  const kakao = firstValue(row, ['kakao_id', 'kakao_uid', 'kakaoid']);
  if (kakao) return { provider: 'kakao', providerUid: kakao };
  const naver = firstValue(row, ['naver_id', 'naver_uid', 'naverid']);
  if (naver) return { provider: 'naver', providerUid: naver };
  return undefined;
}

export function buildSocialDraft(
  row,
  env = {},
  memberByLegacyId = new Set(),
  memberByLoginId = new Map(),
) {
  const reference = pickRelatedMemberReference(row);
  const legacyMemberId = resolveLegacyMemberId(reference, memberByLegacyId, memberByLoginId);
  const specific = providerFromSpecificUid(row);
  const provider =
    normalizeProvider(
      firstValue(
        row,
        [
          'provider',
          'sns',
          'sns_type',
          'social',
          'social_type',
          'login_type',
          'site',
          'type',
          'grade',
        ],
        env.LEGACY_MEMBER_SOCIAL_PROVIDER_COLUMN,
      ),
    ) ?? specific?.provider;
  const providerUid = stripProviderPrefix(
    provider,
    firstValue(
      row,
      [
        'provider_uid',
        'provideruid',
        'provider_id',
        'social_id',
        'socialid',
        'sns_id',
        'oauth_id',
        'account_id',
        'user_key',
        'member_id',
      ],
      env.LEGACY_MEMBER_SOCIAL_PROVIDER_UID_COLUMN,
    ) ?? specific?.providerUid,
  );
  const legacyUid = toInteger(firstValue(row, ['uid', 'idx', 'seq', 'no']));

  if (!legacyMemberId) return { skipped: true, reason: 'orphan_social', row };
  if (!provider || !providerUid) return { skipped: true, reason: 'unknown_social_provider', row };

  return {
    skipped: false,
    legacyMemberId,
    social: {
      legacyUid: legacyUid ?? null,
      provider,
      providerUid,
    },
  };
}

function pointReason(row) {
  return (
    firstValue(row, ['reason', 'memo', 'content', 'comment', 'subject', 'title']) ??
    '레거시 포인트 이관'
  );
}

function pointDate(row) {
  return dateFromFields(row, [
    'regdate',
    'reg_date',
    'wdate',
    'created_at',
    'date',
    'datetime',
    'indate',
  ]);
}

function signedPointDelta(row) {
  const rawDelta = toPointInteger(
    firstValue(row, ['delta', 'amount', 'mileage', 'point_amount', 'po_point', 'point']),
  );
  if (rawDelta == null) return undefined;
  const type = compactLower(firstValue(row, ['type', 'gubun', 'kind', 'point_type', 'state']));
  const reason = compactLower(pointReason(row)) ?? '';
  const negative =
    type != null &&
    ['minus', 'use', 'used', '사용', '차감', '회수', '소멸', '출금'].some((word) =>
      type.includes(word),
    );
  const negativeReason = ['사용', '차감', '회수', '소멸', '취소'].some((word) =>
    reason.includes(word),
  );
  if ((negative || negativeReason) && rawDelta > 0) return -rawDelta;
  return rawDelta;
}

function buildPointDraft(row, memberByLegacyId, memberByLoginId, index) {
  const reference = pickRelatedMemberReference(row);
  const legacyMemberId = resolveLegacyMemberId(reference, memberByLegacyId, memberByLoginId);
  if (!legacyMemberId) return { skipped: true, reason: 'orphan_point', row };

  const delta = signedPointDelta(row);
  const balance = toPointInteger(
    firstValue(row, ['balance', 'remain', 'remaining', 'total', 'point_total']),
  );
  if (delta == null && balance == null) {
    return { skipped: true, reason: 'unreadable_point', row };
  }

  return {
    skipped: false,
    legacyMemberId,
    point: {
      delta,
      balance,
      reason: pointReason(row),
      createdAt: pointDate(row),
      index,
    },
  };
}

export function buildPointLedger(points, targetBalance) {
  const sorted = [...points].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return aTime === bTime ? a.index - b.index : aTime - bTime;
  });

  const entries = [];
  let balance = 0;
  for (const point of sorted) {
    const nextBalance = point.balance ?? balance + (point.delta ?? 0);
    const delta = point.delta ?? nextBalance - balance;
    entries.push({
      delta,
      balance: nextBalance,
      reason: point.reason || '레거시 포인트 이관',
      createdAt: point.createdAt,
    });
    balance = nextBalance;
  }

  if (targetBalance != null && entries.length === 0 && targetBalance !== 0) {
    entries.push({
      delta: targetBalance,
      balance: targetBalance,
      reason: '레거시 포인트 잔액 이관',
      createdAt: undefined,
    });
  } else if (targetBalance != null && entries.length > 0 && balance !== targetBalance) {
    entries.push({
      delta: targetBalance - balance,
      balance: targetBalance,
      reason: '레거시 포인트 잔액 보정',
      createdAt: undefined,
    });
  } else if (targetBalance != null && entries.length > 0) {
    entries.push({
      delta: 0,
      balance: targetBalance,
      reason: '레거시 포인트 최종 잔액 확인',
      createdAt: undefined,
    });
  }

  return entries;
}

export function parseBackupText(text) {
  const tables = Object.fromEntries(memberBackupTables.map((table) => [table, []]));
  const meta = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;

    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid NDJSON at line ${index + 1}: ${error.message}`);
    }

    if (event.type === 'row' && typeof event.table === 'string' && event.data) {
      if (!tables[event.table]) tables[event.table] = [];
      tables[event.table].push(event.data);
    } else if (event.type) {
      meta.push(event);
    }
  }

  return { tables, meta };
}

export async function loadBackupFile(filePath) {
  return parseBackupText(await readFile(filePath, 'utf8'));
}

function buildExistingIndexes(existingUsers) {
  const indexes = {
    byLegacyMemberId: new Map(),
    byLoginId: new Map(),
    byEmail: new Map(),
    byPhone: new Map(),
  };

  for (const user of existingUsers) {
    const normalized = {
      id: user.id?.toString?.() ?? String(user.id ?? ''),
      legacyMemberId: user.legacyMemberId ?? undefined,
      loginId: user.loginId ?? undefined,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
    };
    if (normalized.legacyMemberId)
      indexes.byLegacyMemberId.set(normalized.legacyMemberId, normalized);
    if (normalized.loginId) indexes.byLoginId.set(normalized.loginId, normalized);
    if (normalized.email) indexes.byEmail.set(normalized.email, normalized);
    if (normalized.phone) indexes.byPhone.set(normalized.phone, normalized);
  }

  return indexes;
}

function conflictingExistingUser(draft, existingIndexes) {
  const owner = existingIndexes.byLegacyMemberId.get(draft.legacyMemberId);
  const candidates = [
    draft.loginId ? existingIndexes.byLoginId.get(draft.loginId) : undefined,
    draft.email ? existingIndexes.byEmail.get(draft.email) : undefined,
    draft.phone ? existingIndexes.byPhone.get(draft.phone) : undefined,
  ].filter(Boolean);

  return candidates.find((candidate) => candidate.id !== owner?.id);
}

function dedupeConflict(draft, seen) {
  const fields = [
    ['loginId', draft.loginId],
    ['email', draft.email],
    ['phone', draft.phone],
  ];

  for (const [field, value] of fields) {
    if (!value) continue;
    const seenMemberId = seen[field].get(value);
    if (seenMemberId && seenMemberId !== draft.legacyMemberId) {
      return { field, value, ownerLegacyMemberId: seenMemberId };
    }
    seen[field].set(value, draft.legacyMemberId);
  }

  return undefined;
}

export function buildMigrationPlan(backup, existingUsers = [], env = {}) {
  const rows = backup.tables ?? {};
  const memberRows = rows.member ?? [];
  const withdrawnRefs = buildWithdrawnRefs(rows.member_withdraw ?? []);
  const existingIndexes = buildExistingIndexes(existingUsers);
  const memberByLegacyId = new Map();
  const memberByLoginId = new Map();
  const skippedMembers = [];
  const passwordResetRequiredRows = [];
  const members = [];
  const seen = {
    loginId: new Map(),
    email: new Map(),
    phone: new Map(),
  };

  for (const row of memberRows) {
    const result = buildMemberDraft(row, withdrawnRefs);
    if (result.skipped) {
      skippedMembers.push({ reason: result.reason, row });
      continue;
    }

    const draft = result.draft;
    const existingConflict = conflictingExistingUser(draft, existingIndexes);
    if (existingConflict) {
      skippedMembers.push({
        reason: 'existing_unique_conflict',
        legacyMemberId: draft.legacyMemberId,
        conflictUserId: existingConflict.id,
      });
      continue;
    }

    const duplicate = dedupeConflict(draft, seen);
    if (duplicate) {
      skippedMembers.push({
        reason: 'legacy_duplicate_unique_value',
        legacyMemberId: draft.legacyMemberId,
        ...duplicate,
      });
      continue;
    }

    const existing = existingIndexes.byLegacyMemberId.get(draft.legacyMemberId);
    const plan = {
      ...result,
      existingUserId: existing?.id,
      addresses: [],
      socials: [],
      points: [],
    };
    members.push(plan);
    memberByLegacyId.set(draft.legacyMemberId, plan);
    if (draft.loginId) memberByLoginId.set(draft.loginId, draft.legacyMemberId);

    if (result.requiresReset) {
      passwordResetRequiredRows.push({
        legacyMemberId: draft.legacyMemberId,
        loginId: draft.loginId,
      });
    }
  }

  const skippedAddresses = [];
  for (const row of rows.member_addrs ?? []) {
    const address = buildAddressDraft(row, memberByLegacyId, memberByLoginId);
    if (address.skipped) {
      skippedAddresses.push({ reason: address.reason, row: address.row });
    } else {
      memberByLegacyId.get(address.legacyMemberId)?.addresses.push(address.address);
    }
  }

  const skippedSocials = [];
  for (const row of rows.social_member ?? []) {
    const social = buildSocialDraft(row, env, memberByLegacyId, memberByLoginId);
    if (social.skipped) {
      skippedSocials.push({ reason: social.reason, row: social.row });
    } else {
      memberByLegacyId.get(social.legacyMemberId)?.socials.push(social.social);
    }
  }

  const skippedPoints = [];
  (rows.point_table ?? []).forEach((row, index) => {
    const point = buildPointDraft(row, memberByLegacyId, memberByLoginId, index);
    if (point.skipped) {
      skippedPoints.push({ reason: point.reason, row: point.row });
    } else {
      memberByLegacyId.get(point.legacyMemberId)?.points.push(point.point);
    }
  });

  for (const plan of members) {
    if (plan.draft.status === 'withdrawn') {
      plan.addresses = [];
      plan.socials = [];
      plan.points = [];
      continue;
    }
    plan.pointLedger = buildPointLedger(plan.points, plan.draft.legacyPointBalance);
  }

  return {
    members,
    report: {
      sourceCounts: Object.fromEntries(
        memberBackupTables.map((table) => [table, (rows[table] ?? []).length]),
      ),
      readyMembers: members.length,
      activeMembers: members.filter((member) => member.draft.status === 'active').length,
      withdrawnMembers: members.filter((member) => member.draft.status === 'withdrawn').length,
      existingLegacyUpdates: members.filter((member) => member.existingUserId).length,
      skippedMembers,
      skippedAddresses,
      skippedSocials,
      skippedPoints,
      passwordResetRequiredRows,
    },
  };
}

function definedData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function serializablePlanSummary(plan) {
  return {
    legacyMemberId: plan.draft.legacyMemberId,
    loginId: plan.draft.loginId,
    email: plan.draft.email,
    status: plan.draft.status,
    addressCount: (plan.defaultAddress ? 1 : 0) + plan.addresses.length,
    socialCount: plan.socials.length,
    pointEntryCount: plan.pointLedger?.length ?? 0,
  };
}

async function upsertBusinessProfile(tx, userId, profile) {
  if (!profile) return;
  await tx.userBusinessProfile.upsert({
    where: { userId },
    update: profile,
    create: { userId, ...profile },
  });
}

async function upsertRefundAccount(tx, userId, account) {
  if (!account) return;
  await tx.userRefundAccount.upsert({
    where: { userId },
    update: account,
    create: { userId, ...account },
  });
}

async function upsertAddress(tx, userId, address) {
  const data = {
    userId,
    legacyMemberId: address.legacyMemberId,
    label: address.label,
    receiver: address.receiver,
    phone: address.phone,
    zipCode: address.zipCode,
    address1: address.address1,
    address2: address.address2,
    isDefault: address.isDefault,
  };

  if (address.legacySeq) {
    await tx.userAddress.upsert({
      where: { legacySeq: address.legacySeq },
      update: data,
      create: { legacySeq: address.legacySeq, ...data },
    });
  } else {
    await tx.userAddress.create({ data });
  }
}

async function upsertSocial(tx, userId, social, report) {
  const existing = await tx.userSocialAccount.findUnique({
    where: {
      provider_providerUid: {
        provider: social.provider,
        providerUid: social.providerUid,
      },
    },
    select: { id: true, userId: true },
  });

  if (existing && existing.userId !== userId) {
    report.socialConflicts.push({
      provider: social.provider,
      providerUid: social.providerUid,
      existingUserId: existing.userId.toString(),
      targetUserId: userId.toString(),
    });
    return false;
  }

  if (existing) {
    await tx.userSocialAccount.update({
      where: { id: existing.id },
      data: { legacyUid: social.legacyUid },
    });
    return true;
  }

  await tx.userSocialAccount.create({
    data: {
      userId,
      provider: social.provider,
      providerUid: social.providerUid,
      legacyUid: social.legacyUid,
    },
  });
  return true;
}

async function replaceLegacyPointLedger(tx, userId, pointLedger) {
  await tx.userPointHistory.deleteMany({
    where: {
      userId,
      reason: { startsWith: legacyPointReasonPrefix },
    },
  });

  const rows = pointLedger.map((entry) =>
    definedData({
      userId,
      delta: entry.delta,
      balance: entry.balance,
      reason: entry.reason.startsWith(legacyPointReasonPrefix)
        ? entry.reason
        : `레거시 포인트: ${entry.reason}`,
      createdAt: entry.createdAt,
    }),
  );

  for (const rowChunk of chunk(rows, 1000)) {
    if (rowChunk.length === 0) continue;
    await tx.userPointHistory.createMany({
      data: rowChunk,
    });
  }
}

async function appendLegacyPointLedger(tx, userId, pointLedger) {
  const rows = pointLedger.map((entry) =>
    definedData({
      userId,
      delta: entry.delta,
      balance: entry.balance,
      reason: entry.reason.startsWith(legacyPointReasonPrefix)
        ? entry.reason
        : `레거시 포인트: ${entry.reason}`,
      createdAt: entry.createdAt,
    }),
  );

  for (const rowChunk of chunk(rows, 1000)) {
    if (rowChunk.length === 0) continue;
    await tx.userPointHistory.createMany({
      data: rowChunk,
    });
  }
}

async function writeMemberPlan(tx, plan, report) {
  const userData = userDataFromPlan(plan);
  const createData = userDataFromPlan(plan, true);

  const user = await tx.user.upsert({
    where: { legacyMemberId: plan.draft.legacyMemberId },
    update: userData,
    create: createData,
    select: { id: true },
  });

  report.writtenUsers += 1;

  if (plan.draft.status === 'withdrawn') return user.id;

  await upsertBusinessProfile(tx, user.id, plan.businessProfile);
  await upsertRefundAccount(tx, user.id, plan.refundAccount);

  await tx.userAddress.deleteMany({
    where: {
      userId: user.id,
      legacyMemberId: `member:${plan.draft.legacyMemberId}`,
    },
  });
  if (plan.defaultAddress) {
    await upsertAddress(tx, user.id, plan.defaultAddress);
    report.writtenAddresses += 1;
  }
  for (const address of plan.addresses) {
    await upsertAddress(tx, user.id, address);
    report.writtenAddresses += 1;
  }

  for (const social of plan.socials) {
    if (await upsertSocial(tx, user.id, social, report)) {
      report.writtenSocialAccounts += 1;
    }
  }

  if (plan.existingUserId) {
    await replaceLegacyPointLedger(tx, user.id, plan.pointLedger ?? []);
  } else {
    await appendLegacyPointLedger(tx, user.id, plan.pointLedger ?? []);
  }
  report.writtenPointEntries += plan.pointLedger?.length ?? 0;

  return user.id;
}

function userDataFromPlan(plan, includeCreatedAt = false) {
  return definedData({
    legacyMemberId: plan.draft.legacyMemberId,
    loginId: plan.draft.loginId,
    email: plan.draft.email,
    phone: plan.draft.phone,
    name: plan.draft.name,
    nickname: plan.draft.nickname,
    birth: plan.draft.birth,
    gender: plan.draft.gender,
    passwordHash: plan.draft.passwordHash,
    legacyPasswordHash: plan.draft.legacyPasswordHash,
    legacyPasswordAlgo: plan.draft.legacyPasswordAlgo,
    status: plan.draft.status,
    memberType: plan.draft.memberType,
    marketingAgreedAt: plan.draft.marketingAgreedAt,
    smsAgreedAt: plan.draft.smsAgreedAt,
    legacyPointBalance: plan.draft.legacyPointBalance,
    lastLoginAt: plan.draft.lastLoginAt,
    lastLoginIp: plan.draft.lastLoginIp,
    loginCount: plan.draft.loginCount,
    createdAt: includeCreatedAt ? plan.draft.createdAt : undefined,
  });
}

async function fetchMigratedUsers(prisma, legacyMemberIds) {
  const users = [];
  for (const idChunk of chunk(legacyMemberIds, 500)) {
    users.push(
      ...(await prisma.user.findMany({
        where: { legacyMemberId: { in: idChunk } },
        select: { id: true, legacyMemberId: true },
      })),
    );
  }
  return new Map(users.map((user) => [user.legacyMemberId, user.id]));
}

function addressDataFromPlan(plan, userId) {
  if (plan.draft.status === 'withdrawn') return [];
  return [plan.defaultAddress, ...plan.addresses].filter(Boolean).map((address) =>
    definedData({
      userId,
      legacySeq: address.legacySeq,
      legacyMemberId: address.legacyMemberId,
      label: address.label,
      receiver: address.receiver,
      phone: address.phone,
      zipCode: address.zipCode,
      address1: address.address1,
      address2: address.address2,
      isDefault: address.isDefault,
    }),
  );
}

function socialDataFromPlan(plan, userId) {
  if (plan.draft.status === 'withdrawn') return [];
  return plan.socials.map((social) =>
    definedData({
      userId,
      legacyUid: social.legacyUid,
      provider: social.provider,
      providerUid: social.providerUid,
    }),
  );
}

function pointDataFromPlan(plan, userId) {
  if (plan.draft.status === 'withdrawn') return [];
  return (plan.pointLedger ?? []).map((entry) =>
    definedData({
      userId,
      delta: entry.delta,
      balance: entry.balance,
      reason: entry.reason.startsWith(legacyPointReasonPrefix)
        ? entry.reason
        : `레거시 포인트: ${entry.reason}`,
      createdAt: entry.createdAt,
    }),
  );
}

async function deleteManyByChunks(model, field, values, extraWhere = {}) {
  const unique = [...new Set(values.filter(Boolean))];
  for (const valueChunk of chunk(unique, 1000)) {
    if (valueChunk.length === 0) continue;
    await model.deleteMany({
      where: {
        ...extraWhere,
        [field]: { in: valueChunk },
      },
    });
  }
}

async function createManyByChunks(model, rows, size = 1000, options = {}) {
  let count = 0;
  for (const rowChunk of chunk(rows, size)) {
    if (rowChunk.length === 0) continue;
    const result = await model.createMany({
      data: rowChunk,
      ...options,
    });
    count += result.count ?? rowChunk.length;
  }
  return count;
}

async function writeMigrationPlanBulk(prisma, plan, report) {
  for (const memberPlan of plan.members) {
    await prisma.user.upsert({
      where: { legacyMemberId: memberPlan.draft.legacyMemberId },
      update: userDataFromPlan(memberPlan),
      create: userDataFromPlan(memberPlan, true),
      select: { id: true },
    });
    report.writtenUsers += 1;
  }

  const legacyMemberIds = plan.members.map((memberPlan) => memberPlan.draft.legacyMemberId);
  const userIdByLegacyMemberId = await fetchMigratedUsers(prisma, legacyMemberIds);

  for (const memberPlan of plan.members) {
    const userId = userIdByLegacyMemberId.get(memberPlan.draft.legacyMemberId);
    if (!userId || memberPlan.draft.status === 'withdrawn') continue;
    await upsertBusinessProfile(prisma, userId, memberPlan.businessProfile);
    await upsertRefundAccount(prisma, userId, memberPlan.refundAccount);
  }

  const addressRows = [];
  const legacySeqs = [];
  const legacyAddressIds = [];
  const socialRows = [];
  const socialLegacyUids = [];
  const pointRows = [];
  const userIds = [];

  for (const memberPlan of plan.members) {
    const userId = userIdByLegacyMemberId.get(memberPlan.draft.legacyMemberId);
    if (!userId) continue;
    userIds.push(userId);

    for (const row of addressDataFromPlan(memberPlan, userId)) {
      addressRows.push(row);
      if (row.legacySeq) legacySeqs.push(row.legacySeq);
      if (row.legacyMemberId) legacyAddressIds.push(row.legacyMemberId);
    }

    for (const row of socialDataFromPlan(memberPlan, userId)) {
      socialRows.push(row);
      if (row.legacyUid) socialLegacyUids.push(row.legacyUid);
    }

    pointRows.push(...pointDataFromPlan(memberPlan, userId));
  }

  await deleteManyByChunks(prisma.userAddress, 'legacySeq', legacySeqs);
  await deleteManyByChunks(prisma.userAddress, 'legacyMemberId', legacyAddressIds);
  report.writtenAddresses = await createManyByChunks(prisma.userAddress, addressRows, 1000);

  await deleteManyByChunks(prisma.userSocialAccount, 'legacyUid', socialLegacyUids);
  report.writtenSocialAccounts = await createManyByChunks(
    prisma.userSocialAccount,
    socialRows,
    1000,
    {
      skipDuplicates: true,
    },
  );

  for (const userIdChunk of chunk(userIds, 1000)) {
    await prisma.userPointHistory.deleteMany({
      where: {
        userId: { in: userIdChunk },
        reason: { startsWith: legacyPointReasonPrefix },
      },
    });
  }
  report.writtenPointEntries = await createManyByChunks(prisma.userPointHistory, pointRows, 1000);
}

function chunk(values, size = 500) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function findExistingUsersByField(prisma, field, values) {
  const unique = [...new Set(values.filter(Boolean))];
  const rows = [];
  for (const valueChunk of chunk(unique)) {
    rows.push(
      ...(await prisma.user.findMany({
        where: { [field]: { in: valueChunk } },
        select: { id: true, legacyMemberId: true, loginId: true, email: true, phone: true },
      })),
    );
  }
  return rows;
}

export async function findExistingUsers(prisma, backup, env = {}) {
  const draftBackup = buildMigrationPlan(backup, [], env);
  const drafts = draftBackup.members.map((member) => member.draft);
  const rows = [
    ...(await findExistingUsersByField(
      prisma,
      'legacyMemberId',
      drafts.map((draft) => draft.legacyMemberId),
    )),
    ...(await findExistingUsersByField(
      prisma,
      'loginId',
      drafts.map((draft) => draft.loginId).filter(Boolean),
    )),
    ...(await findExistingUsersByField(
      prisma,
      'email',
      drafts.map((draft) => draft.email).filter(Boolean),
    )),
    ...(await findExistingUsersByField(
      prisma,
      'phone',
      drafts.map((draft) => draft.phone).filter(Boolean),
    )),
  ];

  return [...new Map(rows.map((row) => [row.id.toString(), row])).values()];
}

function reportFileName(dryRun) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').replace('Z', '');
  return `legacy-member-migration-${stamp}${dryRun ? '-dry-run' : ''}.json`;
}

export async function writeReport(reportDir, report) {
  await mkdir(reportDir, { recursive: true });
  const filePath = path.join(reportDir, reportFileName(report.dryRun));
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function runLegacyMemberMigration({ prisma, env = process.env, cwd = process.cwd() }) {
  const backupFile = compact(env.LEGACY_MEMBER_BACKUP_FILE);
  const dryRunValue = compact(env.LEGACY_MEMBER_MIGRATION_DRY_RUN);
  if (!backupFile) throw new Error('LEGACY_MEMBER_BACKUP_FILE is required.');
  if (!dryRunValue || !['0', '1'].includes(dryRunValue)) {
    throw new Error('LEGACY_MEMBER_MIGRATION_DRY_RUN must be 0 or 1.');
  }
  if (!compact(env.DATABASE_URL)) throw new Error('DATABASE_URL is required.');
  if (!compact(env.DIRECT_URL)) throw new Error('DIRECT_URL is required.');

  const dryRun = dryRunValue === '1';
  const backup = await loadBackupFile(path.resolve(cwd, backupFile));
  const existingUsers = await findExistingUsers(prisma, backup, env);
  const plan = buildMigrationPlan(backup, existingUsers, env);
  const report = {
    dryRun,
    backupFile: path.resolve(cwd, backupFile),
    generatedAt: new Date().toISOString(),
    note: '점검창 없이 백업한 경우 최종 백업 시점 이후 레거시 변경분은 포함되지 않습니다.',
    ...plan.report,
    plannedMembers: plan.members.map(serializablePlanSummary),
    writtenUsers: 0,
    writtenAddresses: 0,
    writtenSocialAccounts: 0,
    writtenPointEntries: 0,
    socialConflicts: [],
  };

  if (!dryRun) {
    await writeMigrationPlanBulk(prisma, plan, report);
  }

  const reportDir = path.resolve(
    cwd,
    env.LEGACY_MEMBER_REPORT_DIR ?? 'legacy-member-backups/reports',
  );
  const reportPath = await writeReport(reportDir, report);
  return { report, reportPath };
}
