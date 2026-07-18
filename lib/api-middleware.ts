/**
 * ABOUTME: API middleware for rate limiting and CSRF protection
 * ABOUTME: Wraps API handlers with security checks
 */

import { NextResponse } from 'next/server'
import {
  rateLimit,
  rateLimitByIP,
  getClientIP,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from './rate-limiter'
import { createClient } from '@/lib/supabase/server'

type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS

interface MiddlewareOptions {
  rateLimit?: RateLimitType
  requireAuth?: boolean
  csrfProtection?: boolean
}

/**
 * Extract user ID from request (auth or localStorage)
 */
async function getUserId(request: Request): Promise<string | null> {
  // Try Supabase auth first
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id
  } catch {
    // Supabase not configured or error
  }

  // Fall back to localStorage user ID from header
  const localUserId = request.headers.get('x-user-id')
  if (localUserId) return localUserId

  return null
}

/**
 * Validate CSRF token from request
 * For SPA apps, we check that the request came from our origin
 */
function validateCSRF(request: Request): boolean {
  // Skip CSRF for GET/HEAD/OPTIONS (safe methods)
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  if (safeMethod) return true

  // Check origin header matches our app
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // For server-side requests (cron, webhooks), origin may be null
  if (!origin) {
    // Check for internal API key for cron jobs
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      return true
    }
    // Allow requests without origin in development
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    return false
  }

  // Validate origin matches our host
  try {
    const originUrl = new URL(origin)
    const expectedHost = host?.split(':')[0] // Remove port
    const actualHost = originUrl.hostname

    // Allow localhost variations in development
    if (process.env.NODE_ENV === 'development') {
      const localhosts = ['localhost', '127.0.0.1', '0.0.0.0']
      if (localhosts.includes(actualHost)) return true
    }

    // Check if origin matches host
    return actualHost === expectedHost
  } catch {
    return false
  }
}

/**
 * Create rate-limited API response
 */
function rateLimitedResponse(result: ReturnType<typeof rateLimit>): NextResponse {
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    }
  )
}

/**
 * Wrap an API handler with middleware (rate limiting, CSRF, auth)
 */
export function withMiddleware<T extends Request>(
  handler: (request: T) => Promise<Response>,
  options: MiddlewareOptions = {}
): (request: T) => Promise<Response> {
  const {
    rateLimit: rateLimitType = 'api',
    requireAuth = false,
    csrfProtection = true,
  } = options

  return async (request: T): Promise<Response> => {
    // CSRF protection
    if (csrfProtection && !validateCSRF(request)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid request origin' },
        { status: 403 }
      )
    }

    // Get user ID for rate limiting and auth
    const userId = await getUserId(request)

    // Auth check
    if (requireAuth && !userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting
    const config = RATE_LIMIT_CONFIGS[rateLimitType]
    const result = rateLimit(request, userId, config)

    if (!result.success) {
      return rateLimitedResponse(result)
    }

    // Call the actual handler
    const response = await handler(request)

    // Add rate limit headers to response
    const headers = getRateLimitHeaders(result)
    const newHeaders = new Headers(response.headers)
    for (const [key, value] of Object.entries(headers)) {
      newHeaders.set(key, value)
    }

    // Return response with rate limit headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  }
}

/**
 * Simple rate limit check for use in existing handlers
 * Returns null if allowed, or a 429 Response if rate limited
 */
export async function checkRateLimit(
  request: Request,
  type: RateLimitType = 'api'
): Promise<Response | null> {
  const userId = await getUserId(request)
  const config = RATE_LIMIT_CONFIGS[type]
  const result = rateLimit(request, userId, config)

  if (!result.success) {
    return rateLimitedResponse(result)
  }

  return null
}

/**
 * IP-only rate limit for auth endpoints
 */
export function checkAuthRateLimit(request: Request): Response | null {
  const ip = getClientIP(request)
  const result = rateLimitByIP(ip, RATE_LIMIT_CONFIGS.auth)

  if (!result.success) {
    return rateLimitedResponse(result) as Response
  }

  return null
}
