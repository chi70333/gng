export const DASHBOARD_ROTATION_CANDIDATE_COUNT = 34;
export const DASHBOARD_ROTATION_DISPLAY_COUNT = 8;
export const DASHBOARD_ROTATION_INTERVAL_MS = 60_000;

export function getDashboardRotationIndex(now = Date.now()): number {
  return Math.floor(now / DASHBOARD_ROTATION_INTERVAL_MS);
}

export function rotateDashboardProducts<T>(
  products: T[],
  rotationIndex = getDashboardRotationIndex(),
  displayCount = DASHBOARD_ROTATION_DISPLAY_COUNT,
): T[] {
  if (products.length <= displayCount) return products;

  const start = (rotationIndex * displayCount) % products.length;
  const rotated: T[] = [];

  for (let index = 0; index < displayCount; index += 1) {
    const product = products[(start + index) % products.length];
    if (product !== undefined) rotated.push(product);
  }

  return rotated;
}
