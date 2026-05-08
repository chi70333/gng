'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const LABEL_LOGIN_ID = '\uC544\uC774\uB514';
const LABEL_PASSWORD = '\uBE44\uBC00\uBC88\uD638';
const BUTTON_LOGIN = '\uB85C\uADF8\uC778';
const BUTTON_PENDING = '\uB85C\uADF8\uC778 \uC911...';
const CREDENTIALS_ERROR =
  '\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.';

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const loginId = String(formData.get('loginId') ?? '');
    const password = String(formData.get('password') ?? '');

    const result = await signIn('credentials', {
      loginId,
      password,
      redirect: false,
      callbackUrl,
    });

    setIsPending(false);

    if (!result || result.error) {
      setError(CREDENTIALS_ERROR);
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          {LABEL_LOGIN_ID}
        </span>
        <input name="loginId" required autoComplete="username" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          {LABEL_PASSWORD}
        </span>
        <input name="password" type="password" required autoComplete="current-password" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-300" />
      </label>

      <button type="submit" disabled={isPending} className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400">
        {isPending ? BUTTON_PENDING : BUTTON_LOGIN}
      </button>
    </form>
  );
}
