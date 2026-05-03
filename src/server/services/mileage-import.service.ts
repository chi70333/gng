import type { MileageUploadRecord } from './mileage-spreadsheet.service';

export type MileageImportOperation = {
  userId: bigint;
  record: MileageUploadRecord;
};

export type MileageImportUser = {
  id: bigint;
  loginId: string | null;
  email: string;
  socialAccounts: {
    provider: string;
    providerUid: string;
  }[];
};

export function socialLoginIdParts(
  loginId: string,
): { provider: string; providerUid: string } | null {
  const match = /^(kakao|naver|google|apple)-(.+)$/i.exec(loginId.trim());
  if (!match) return null;
  return {
    provider: match[1]?.toLowerCase() ?? '',
    providerUid: match[2] ?? '',
  };
}

function canonicalSocialLoginId(loginId: string): string | null {
  const social = socialLoginIdParts(loginId);
  return social ? `${social.provider}-${social.providerUid}` : null;
}

export function resolveMileageImportOperations(
  records: MileageUploadRecord[],
  users: MileageImportUser[],
): { operations: MileageImportOperation[]; skipped: number } {
  const byId = new Map(users.map((user) => [user.id.toString(), user]));
  const byLoginId = new Map(
    users
      .filter((user): user is MileageImportUser & { loginId: string } => user.loginId !== null)
      .map((user) => [user.loginId, user]),
  );
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const bySocialLoginId = new Map<string, MileageImportUser>();

  users.forEach((user) => {
    user.socialAccounts.forEach((account) => {
      bySocialLoginId.set(`${account.provider}-${account.providerUid}`, user);
    });
  });

  let skipped = 0;
  const operations: MileageImportOperation[] = [];

  records.forEach((record) => {
    const user =
      (record.userId ? byId.get(record.userId.toString()) : undefined) ??
      (record.loginId ? byLoginId.get(record.loginId) : undefined) ??
      (record.loginId
        ? bySocialLoginId.get(canonicalSocialLoginId(record.loginId) ?? record.loginId)
        : undefined) ??
      (record.email ? byEmail.get(record.email.toLowerCase()) : undefined);

    if (!user) {
      skipped += 1;
      return;
    }

    operations.push({ userId: user.id, record });
  });

  return { operations, skipped };
}
