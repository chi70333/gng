// Legacy order_table.php generated tradecode as:
// 3 random uppercase letters + substr(time(), 5, 5) + REMOTE_ADDR last octet.
type LegacyOrderCodeInput = {
  now?: Date;
  clientIp?: string | null;
  random?: () => number;
};

function firstForwardedIp(clientIp?: string | null): string {
  return (clientIp ?? '').split(',')[0]?.trim() ?? '';
}

export function legacyIpLastOctet(clientIp?: string | null): string {
  const ip = firstForwardedIp(clientIp);
  const match = ip.match(/^(?:\d{1,3}\.){3}(\d{1,3})$/);
  return match?.[1] ?? '0';
}

export function legacyClientIpFromHeaders(headers: Pick<Headers, 'get'>): string | null {
  return (
    headers.get('x-forwarded-for') ??
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    null
  );
}

export function createLegacyOrderCode(input: LegacyOrderCodeInput = {}): string {
  const now = input.now ?? new Date();
  const random = input.random ?? Math.random;
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const legacyTime = timestamp.slice(5, 10);
  let prefix = '';

  for (let i = 0; i < 3; i += 1) {
    prefix += String.fromCharCode(65 + Math.floor(random() * 26));
  }

  return `${prefix}${legacyTime}${legacyIpLastOctet(input.clientIp)}`;
}
