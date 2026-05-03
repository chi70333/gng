import { logger } from '@/lib/logger';

type ExternalMemberRegisterInput = {
  email: string;
  fullName: string;
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

  if (!apiKey) {
    logger.warn({ email: input.email }, 'External member register API key is not configured');
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      email: input.email,
      full_name: input.fullName,
      username: input.username || undefined,
      phone: input.phone || undefined,
      source: '지앤지.shop',
    }),
  });

  const responseText = await response.text();
  let payload: ExternalMemberRegisterResponse | null = null;

  try {
    payload = responseText ? (JSON.parse(responseText) as ExternalMemberRegisterResponse) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success !== true) {
    logger.error(
      {
        status: response.status,
        email: input.email,
        response: payload ?? responseText,
      },
      'External member register webhook failed',
    );
    return;
  }

  logger.info(
    {
      status: response.status,
      email: input.email,
      userId: payload.user_id,
      isNew: payload.is_new,
    },
    'External member register webhook succeeded',
  );
}
