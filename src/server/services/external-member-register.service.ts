import { logger } from '@/lib/logger';
import { recordExternalMemberWebhookLog } from './external-member-webhook-log.service';

type ExternalMemberRegisterInput = {
  userId?: string | bigint | null;
  email: string;
  fullName: string;
  provider?: string;
  username?: string | null;
  phone?: string | null;
};

type ExternalMemberRegisterResponse = {
  success?: boolean;
  message?: string;
  user_id?: string;
  username?: string;
  is_new?: boolean;
  requires_password_reset?: boolean;
  error?: string;
};

const DEFAULT_WEBHOOK_URL =
  'https://eztlkzfbkjonfrscfztz.supabase.co/functions/v1/external-member-register';

export async function sendExternalMemberRegisterWebhook(
  input: ExternalMemberRegisterInput,
): Promise<void> {
  const apiKey = process.env.EXTERNAL_REGISTER_API_KEY;
  const webhookUrl = process.env.EXTERNAL_MEMBER_REGISTER_URL ?? DEFAULT_WEBHOOK_URL;
  const provider = input.provider ?? 'kakao';
  const requestPayload = {
    email: input.email,
    full_name: input.fullName,
    username: input.username || undefined,
    phone: input.phone || undefined,
    source: '지앤지.shop',
  };

  if (!apiKey) {
    const errorMessage = 'External member register API key is not configured';
    logger.warn({ email: input.email, loginId: input.username }, errorMessage);
    await recordExternalMemberWebhookLog({
      userId: input.userId,
      provider,
      loginId: input.username,
      name: input.fullName,
      email: input.email,
      phone: input.phone,
      endpoint: webhookUrl,
      success: false,
      errorMessage,
      requestPayload,
    });
    return;
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(requestPayload),
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'External member register fetch failed';
    await recordExternalMemberWebhookLog({
      userId: input.userId,
      provider,
      loginId: input.username,
      name: input.fullName,
      email: input.email,
      phone: input.phone,
      endpoint: webhookUrl,
      success: false,
      errorMessage,
      requestPayload,
    });
    throw err;
  }

  const responseText = await response.text();
  let payload: ExternalMemberRegisterResponse | null = null;

  try {
    payload = responseText ? (JSON.parse(responseText) as ExternalMemberRegisterResponse) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success !== true) {
    const errorMessage =
      payload?.error || payload?.message || `External webhook returned HTTP ${response.status}`;
    logger.error(
      {
        status: response.status,
        email: input.email,
        loginId: input.username,
        response: payload ?? responseText,
      },
      'External member register webhook failed',
    );
    await recordExternalMemberWebhookLog({
      userId: input.userId,
      provider,
      loginId: input.username,
      name: input.fullName,
      email: input.email,
      phone: input.phone,
      endpoint: webhookUrl,
      statusCode: response.status,
      success: false,
      errorMessage,
      requestPayload,
      responsePayload: payload ?? responseText,
    });
    return;
  }

  logger.info(
    {
      status: response.status,
      email: input.email,
      loginId: input.username,
      userId: payload.user_id,
      isNew: payload.is_new,
    },
    'External member register webhook succeeded',
  );
}
