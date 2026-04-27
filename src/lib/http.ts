type JsonRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object;
  timeoutMs?: number;
};

export async function fetchJson<T>(
  url: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const { body, headers, timeoutMs = 5000, ...init } = options;
  const res = await fetch(url, {
    ...init,
    body: body && typeof body === 'object' && !(body instanceof FormData)
      ? JSON.stringify(body)
      : body,
    headers: {
      ...(body && typeof body === 'object' && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}
