import { Env, RateLimitEntry } from '../lib/types';

const MAX_REQUESTS_PER_WINDOW = 60;
const WINDOW_DURATION_MS = 3600 * 1000; // 1 hour

/**
 * Rate limiting middleware using KV.
 * Returns null if within limits, or a 429 Response if exceeded.
 */
export async function rateLimit(
  request: Request,
  env: Env
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${ip}`;

  const now = new Date();
  const entry = await env.RATELIMIT.get(key, 'json') as RateLimitEntry | null;

  if (entry) {
    const windowStart = new Date(entry.windowStart);
    const elapsed = now.getTime() - windowStart.getTime();

    if (elapsed < WINDOW_DURATION_MS) {
      // Within current window
      if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
        const retryAfter = Math.ceil((WINDOW_DURATION_MS - elapsed) / 1000);
        return new Response(
          JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
            },
          }
        );
      }

      // Increment counter
      const updated: RateLimitEntry = {
        count: entry.count + 1,
        windowStart: entry.windowStart,
      };
      await env.RATELIMIT.put(key, JSON.stringify(updated), { expirationTtl: 3600 });
      return null;
    }
  }

  // New window
  const newEntry: RateLimitEntry = {
    count: 1,
    windowStart: now.toISOString(),
  };
  await env.RATELIMIT.put(key, JSON.stringify(newEntry), { expirationTtl: 3600 });
  return null;
}
