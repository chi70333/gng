// Legacy sources: payaction.php, PG/*
// Cache: no-store. PG callbacks update payment/order state.

import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  paymentCallbackSchema,
  type PaymentCallbackInput,
} from '@/schemas/payment';
import { handlePaymentCallback } from '@/server/services/payment.service';
import { ValidationError, toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

type PaymentProvider = PaymentCallbackInput['provider'];

type CallbackPayload = Record<string, string>;

function getHeader(req: NextRequest, ...names: string[]): string | null {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value && value.length > 0) return value;
  }
  return null;
}

function timingSafeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function pickValue(payload: CallbackPayload, keys: string[]): string | undefined {
  const keySet = new Set(keys.map(normalizeKey));
  for (const [key, value] of Object.entries(payload)) {
    if (keySet.has(normalizeKey(key)) && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function normalizeMethod(value: string | undefined): PaymentCallbackInput['method'] {
  const source = (value ?? '').toUpperCase();
  if (source === 'CARD' || source === '1000000000') return 'card';
  if (source === 'BANK' || source === '2000000000') return 'bank';
  if (source === 'VACCOUNT' || source === 'VACCOUNTISSUE' || source === '6000000000') return 'vbank';
  if (source === 'MOBILE' || source === 'M000000000') return 'mobile';
  return 'unknown';
}

function normalizeStatus(payload: CallbackPayload): PaymentCallbackInput['status'] {
  const explicit = pickValue(payload, ['status']);
  if (explicit === 'approved' || explicit === 'failed' || explicit === 'cancelled') {
    return explicit;
  }

  const authyn = pickValue(payload, ['authyn']);
  if (authyn === 'O') return 'approved';
  if (authyn === 'X') return 'failed';

  const resultCode = pickValue(payload, ['resultcd', 'result_code', 'resultCode']);
  if (resultCode === '0000' || resultCode === '00') return 'approved';

  const cancelType = pickValue(payload, ['recncltype', 'cancelreq']);
  if (cancelType === '1' || cancelType?.toUpperCase() === 'Y') return 'cancelled';

  return 'failed';
}

function detectProvider(req: NextRequest, payload: CallbackPayload): PaymentProvider {
  const provider = pickValue(payload, ['provider']);
  if (provider === 'ksnet' || provider === 'kiwoompay' || provider === 'legacy-payaction') {
    return provider;
  }

  if (pickValue(payload, ['rewhcid', 'recommconid', 'authyn', 'trno', 'ordno'])) {
    return 'ksnet';
  }

  if (pickValue(payload, ['daoutrx', 'paymethod', 'returnurl', 'token'])) {
    return 'kiwoompay';
  }

  const mallId = getHeader(req, 'x-mall-id');
  return mallId ? 'legacy-payaction' : 'legacy-payaction';
}

function parseAmount(payload: CallbackPayload): number {
  const amount = pickValue(payload, ['amount', 'amt']);
  if (!amount) return 0;
  const parsed = Number.parseInt(amount, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePayload(
  req: NextRequest,
  payload: CallbackPayload,
  rawBody: string,
): PaymentCallbackInput {
  const provider = detectProvider(req, payload);
  const orderNo = pickValue(payload, ['orderno', 'order_number', 'ordno']);
  const method = normalizeMethod(pickValue(payload, ['paymethod', 'method', 'gm_shop_paymethod']));
  const status = normalizeStatus(payload);
  const callbackHash = createHash('sha256').update(rawBody).digest('hex');

  const parsed = paymentCallbackSchema.safeParse({
    orderNo,
    provider,
    providerTxId: pickValue(payload, ['providertxid', 'trxid', 'daoutrx', 'trno']),
    method,
    amount: parseAmount(payload),
    status,
    responseCode: pickValue(payload, ['resultcd', 'result_code', 'authno']),
    responseMessage: pickValue(payload, ['msg1', 'msg2', 'message']),
    callbackHash,
    rawResponse: payload,
  });

  if (!parsed.success) {
    throw new ValidationError('Invalid payment callback.', parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

function isPaymentCallbackAuthorized(req: NextRequest): boolean {
  const token = process.env.PAYMENT_CALLBACK_TOKEN;
  if (!token) return false;

  const apiKey = req.headers.get('x-api-key');
  const authorization = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return apiKey === token || authorization === token;
}

function isProviderSignatureValid(
  req: NextRequest,
  provider: PaymentProvider,
  payload: CallbackPayload,
  rawBody: string,
): boolean {
  if (provider === 'legacy-payaction') {
    const webhookKey = process.env.LEGACY_PAYACTION_WEBHOOK_KEY;
    if (webhookKey) {
      const value = getHeader(req, 'x-webhook-key');
      return typeof value === 'string' && timingSafeEquals(value, webhookKey);
    }
    return isPaymentCallbackAuthorized(req);
  }

  if (provider === 'ksnet') {
    const secret = process.env.KSNET_CALLBACK_SECRET;
    if (!secret) return isPaymentCallbackAuthorized(req);

    const signature = getHeader(req, 'x-ksnet-signature') ?? pickValue(payload, ['rehash']);
    if (!signature) return false;

    const rawExpected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (timingSafeEquals(signature, rawExpected)) return true;

    const compactExpected = createHmac('sha256', secret)
      .update(`${pickValue(payload, ['ordno', 'orderno']) ?? ''}|${parseAmount(payload)}|${pickValue(payload, ['trno']) ?? ''}`)
      .digest('hex');
    return timingSafeEquals(signature, compactExpected);
  }

  if (provider === 'kiwoompay') {
    const secret = process.env.KIWOOMPAY_CALLBACK_SECRET;
    if (!secret) return isPaymentCallbackAuthorized(req);

    const signature = getHeader(req, 'x-kiwoompay-signature');
    if (!signature) return false;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return timingSafeEquals(signature, expected);
  }

  return false;
}

async function parseCallbackPayload(req: NextRequest): Promise<{
  payload: CallbackPayload;
  rawBody: string;
}> {
  const rawBody = await req.text();
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const raw = JSON.parse(rawBody || '{}') as Record<string, unknown>;
    const payload = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, value == null ? '' : String(value)]),
    );
    return { payload, rawBody };
  }

  const form = new URLSearchParams(rawBody);
  const payload: CallbackPayload = {};
  for (const [key, value] of form.entries()) {
    payload[key] = value;
  }
  return { payload, rawBody };
}

export async function POST(req: NextRequest) {
  let payload: CallbackPayload;
  let rawBody: string;
  try {
    ({ payload, rawBody } = await parseCallbackPayload(req));
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Invalid payment callback.',
        },
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const normalized = normalizePayload(req, payload, rawBody);
    if (!isProviderSignatureValid(req, normalized.provider, payload, rawBody)) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid callback signature.' } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const data = await handlePaymentCallback(normalized);
    return NextResponse.json(
      { ok: true, data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const apiError = toApiError(err);
    return NextResponse.json(apiError.body, {
      status: apiError.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
