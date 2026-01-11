import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
// Falls back to in-memory store if Upstash credentials not configured
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

/**
 * Rate limit configurations for different endpoints/actions
 */
export const rateLimiters = {
  // General API rate limit
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        analytics: true,
        prefix: 'ratelimit:api',
      })
    : null,

  // Auth endpoints (more restrictive)
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'ratelimit:auth',
      })
    : null,

  // Prediction endpoint (resource intensive)
  prediction: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 h'),
        analytics: true,
        prefix: 'ratelimit:prediction',
      })
    : null,

  // Simulation endpoint (very resource intensive)
  simulation: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        analytics: true,
        prefix: 'ratelimit:simulation',
      })
    : null,
}

/**
 * Subscription tier rate limits
 */
export const tierLimits = {
  free: {
    predictions_per_day: 3,
    simulations_per_day: 1,
    profiles: 2,
  },
  premium: {
    predictions_per_day: 50,
    simulations_per_day: 20,
    profiles: 10,
  },
  professional: {
    predictions_per_day: 200,
    simulations_per_day: 100,
    profiles: 50,
  },
}

/**
 * Check rate limit for a given identifier and limiter
 * Returns { success: true } if allowed, { success: false, reset: timestamp } if blocked
 */
export async function checkRateLimit(
  limiter: keyof typeof rateLimiters,
  identifier: string
): Promise<{ success: boolean; reset?: number; remaining?: number }> {
  const rateLimiter = rateLimiters[limiter]

  if (!rateLimiter) {
    // Rate limiting not configured, allow all requests
    console.warn('Rate limiting not configured - Upstash credentials missing')
    return { success: true }
  }

  const result = await rateLimiter.limit(identifier)

  return {
    success: result.success,
    reset: result.reset,
    remaining: result.remaining,
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  success: boolean
  reset?: number
  remaining?: number
}): Record<string, string> {
  const headers: Record<string, string> = {}

  if (result.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = result.remaining.toString()
  }

  if (result.reset !== undefined) {
    headers['X-RateLimit-Reset'] = result.reset.toString()
  }

  return headers
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimit(
  limiter: keyof typeof rateLimiters,
  getIdentifier: (request: Request) => string | Promise<string>
) {
  return function <T extends (...args: [Request, ...unknown[]]) => Promise<Response>>(
    handler: T
  ): T {
    return (async (request: Request, ...args: unknown[]) => {
      const identifier = await getIdentifier(request)
      const result = await checkRateLimit(limiter, identifier)

      if (!result.success) {
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            retryAfter: result.reset,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...getRateLimitHeaders(result),
            },
          }
        )
      }

      const response = await handler(request, ...args)

      // Add rate limit headers to successful responses
      const headers = new Headers(response.headers)
      Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
        headers.set(key, value)
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }) as T
  }
}
