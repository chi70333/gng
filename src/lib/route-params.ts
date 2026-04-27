export function parseBigIntRouteParam(value: string): bigint | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  return BigInt(value);
}
