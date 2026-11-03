type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Best-effort per-instance throttle; production should also use an edge/WAF limit. */
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
