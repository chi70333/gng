import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { AdminProductImageUploadInput } from '@/schemas/admin-product-image';
import { ValidationError } from '@/lib/errors';

const PRESIGN_EXPIRES_SECONDS = 300;
const REGION = 'auto';
const SERVICE = 's3';

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

export type PresignedProductImageUpload = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
};

const extensionByContentType: Record<AdminProductImageUploadInput['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

function requireR2Config(): R2Config {
  const config = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicUrl: process.env.R2_PUBLIC_URL,
  };

  if (
    !config.accountId ||
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.bucket ||
    !config.publicUrl
  ) {
    throw new ValidationError('이미지 업로드 CDN 환경변수가 설정되지 않았습니다.');
  }

  return config as R2Config;
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeKeyPath(key: string): string {
  return key.split('/').map(encodePathSegment).join('/');
}

function getSigningKey(secretAccessKey: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function createProductImageKey(input: AdminProductImageUploadInput): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const extension = extensionByContentType[input.contentType];
  return `products/draft/${year}/${month}/${randomUUID()}.${extension}`;
}

function canonicalQuery(params: URLSearchParams): string {
  return Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function hashCanonicalRequest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createPresignedProductImageUpload(
  input: AdminProductImageUploadInput,
): PresignedProductImageUpload {
  const config = requireR2Config();
  const key = createProductImageKey(input);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const { amzDate, dateStamp } = toAmzDate(now);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const signedHeaders = 'host';
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': PRESIGN_EXPIRES_SECONDS.toString(),
    'X-Amz-SignedHeaders': signedHeaders,
  });
  const canonicalUri = `/${encodePathSegment(config.bucket)}/${encodeKeyPath(key)}`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery(params),
    `host:${host}`,
    '',
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashCanonicalRequest(canonicalRequest),
  ].join('\n');
  const signature = hmacHex(getSigningKey(config.secretAccessKey, dateStamp), stringToSign);
  params.set('X-Amz-Signature', signature);

  return {
    key,
    uploadUrl: `https://${host}${canonicalUri}?${canonicalQuery(params)}`,
    publicUrl: `${config.publicUrl.replace(/\/+$/, '')}/${encodeKeyPath(key)}`,
    expiresIn: PRESIGN_EXPIRES_SECONDS,
    headers: {
      'Content-Type': input.contentType,
    },
  };
}
