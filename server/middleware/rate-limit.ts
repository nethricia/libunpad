/**
 * Simple in-memory rate limiter for sensitive endpoints.
 *
 * Protects login, form submissions and the public proxies from abuse.
 * Note: state is per-process; for multi-instance deployments back this with
 * Redis or an edge limiter.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** path prefix -> [max requests, window in ms] */
const LIMITS: Array<[string, number, number]> = [
  ["/api/auth/callback", 20, 60_000],
  ["/api/auth/signin", 20, 60_000],
  ["/api/v1/kontak", 5, 60_000],
  ["/api/v1/visitor", 30, 60_000],
  ["/api/v1/digital-collections", 120, 60_000],
  ["/api/v1/koleksi/pustaka", 120, 60_000],
  ["/api/v1/units", 60, 60_000],
  ["/api/v1/scopus", 30, 60_000],
];

const getClientIp = (event: any) => {
  const forwarded = getHeader(event, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return getHeader(event, "x-real-ip") || event.node.req.socket?.remoteAddress || "unknown";
};

export default defineEventHandler((event) => {
  const path = event.path || "";

  const rule = LIMITS.find(([prefix]) => path.startsWith(prefix));
  if (!rule) return;

  const [, max, windowMs] = rule;
  const key = `${getClientIp(event)}:${rule[0]}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    setHeader(event, "Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
    throw createError({
      statusCode: 429,
      message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
    });
  }

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }
});
