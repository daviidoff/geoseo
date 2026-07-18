/**
 * ABOUTME: Production-ready rate limiter using sliding window
 * ABOUTME: Enforces per-IP and per-user limits with configurable windows
 */

interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (use Redis for multi-instance deployments)
const ipLimits = new Map<string, RateLimitEntry>()
const userLimits = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of ipLimits.entries()) {
    if (entry.resetAt < now) ipLimits.delete(key)
  }
  for (const [key, entry] of userLimits.entries()) {
    if (entry.resetAt < now) userLimits.delete(key)
  }
}, 5 * 60 * 1000)

// Default configs for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // Auth endpoints - strict to prevent brute force
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },  // 10 per 15 min

  // API endpoints - generous for normal usage
  api: { windowMs: 60 * 1000, maxRequests: 60 },  // 60 per minute

  // AI generation endpoints - more restrictive (expensive)
  generation: { windowMs: 60 * 1000, maxRequests: 20 },  // 20 per minute

  // Webhook endpoints - very restrictive
  webhook: { windowMs: 60 * 1000, maxRequests: 100 },  // 100 per minute
} as const

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number  // Unix timestamp when the window resets
  retryAfter?: number  // Seconds to wait (if rate limited)
}

/**
 * Check rate limit for an identifier (IP or user ID)
 */
function checkLimit(
  store: Map<string, RateLimitEntry>,
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(identifier)

  // No existing entry or window expired - create new
  if (!entry || entry.resetAt < now) {
    store.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: Math.ceil((now + config.windowMs) / 1000),
    }
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: Math.ceil(entry.resetAt / 1000),
      retryAfter,
    }
  }

  // Increment counter
  entry.count++
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: Math.ceil(entry.resetAt / 1000),
  }
}

/**
 * Rate limit by IP address
 */
export function rateLimitByIP(
  ip: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): RateLimitResult {
  return checkLimit(ipLimits, ip, config)
}

/**
 * Rate limit by user ID
 */
export function rateLimitByUser(
  userId: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): RateLimitResult {
  return checkLimit(userLimits, `user:${userId}`, config)
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback - shouldn't happen in production with proper proxy setup
  return '127.0.0.1'
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return headers
}

/**
 * Combined rate limit check (IP + user if authenticated)
 */
export function rateLimit(
  request: Request,
  userId: string | null,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): RateLimitResult {
  const ip = getClientIP(request)

  // Always check IP limit
  const ipResult = rateLimitByIP(ip, config)
  if (!ipResult.success) {
    return ipResult
  }

  // If authenticated, also check user limit (more generous)
  if (userId) {
    const userConfig = {
      ...config,
      maxRequests: Math.ceil(config.maxRequests * 1.5),  // 50% more for authenticated users
    }
    const userResult = rateLimitByUser(userId, userConfig)

    // Return the more restrictive result
    if (!userResult.success) {
      return userResult
    }

    // Return combined result (lower remaining of the two)
    return {
      success: true,
      limit: Math.min(ipResult.limit, userResult.limit),
      remaining: Math.min(ipResult.remaining, userResult.remaining),
      reset: Math.max(ipResult.reset, userResult.reset),
    }
  }

  return ipResult
}
